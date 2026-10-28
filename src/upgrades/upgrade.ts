// Mode 2 — Improve My Current Deck. A one-for-one replacement optimizer, not a 99-card solver.
// For each owned candidate: simulate replacing every reasonable cut, recompute an explainable utility
// vector, keep the best valid swap. Upgrade Value = utility after best swap − current utility.
// Protect functions, not card identities: a cut is invalid only if the post-swap deck loses an essential
// function the candidate does not replace.
import type { CardMetadata } from "../models/collection";
import type { DeckDna, DnaInputCard } from "../dna/engine";
import type { RecommendationData } from "../synergy/recommendation";
import type { AnswerTarget } from "../synergy/facts";
import { deckCardFunction, needLabels } from "./cardFunction";
import { SupplyIndex } from "./conditions";
import type { CardFunction, EnginePieces, Need } from "./cardFunction";
import type { CommanderBlueprint } from "./blueprint";
import { baseline } from "./blueprint";

export const UPGRADE_VERSION = "1.0.0";
export type UpgradeLabel = "Major Upgrade" | "Strong Upgrade" | "Moderate Upgrade" | "Minor Upgrade" | "Sidegrade" | "Downgrade";
// Utility-point thresholds, calibrated by the regression and mutation fixtures (not a universal power scale).
export const UPGRADE_BANDS: [number, UpgradeLabel][] = [[2, "Major Upgrade"], [1, "Strong Upgrade"], [0.45, "Moderate Upgrade"], [0.15, "Minor Upgrade"], [-0.15, "Sidegrade"], [-Infinity, "Downgrade"]];
export const upgradeLabel = (value: number) => UPGRADE_BANDS.find(([min]) => value >= min)![1];
export const COMPONENTS = ["commanderPlan", "mana", "curve", "cardAdvantage", "interaction", "protection", "resilience", "engines", "finishing", "quality", "redundancy", "dependency"] as const;
export type Component = (typeof COMPONENTS)[number];
export const COMPONENT_WEIGHTS: Record<Component, number> = {
  commanderPlan: 0.13,
  mana: 0.13,
  curve: 0.06,
  cardAdvantage: 0.11,
  interaction: 0.12,
  protection: 0.06,
  resilience: 0.04,
  engines: 0.14,
  finishing: 0.09,
  quality: 0.08,
  redundancy: 0.02,
  dependency: 0.02,
};
export const componentLabels: Record<Component, string> = {
  commanderPlan: "Commander plan",
  mana: "Mana",
  curve: "Curve",
  cardAdvantage: "Card advantage",
  interaction: "Interaction",
  protection: "Protection",
  resilience: "Resilience",
  engines: "Synergy engines",
  finishing: "Finishing power",
  quality: "Card quality",
  redundancy: "Redundancy",
  dependency: "Commander dependency",
};
type Vector = Record<Component, number>;
const COVERAGE: [AnswerTarget, number][] = [["creature", 0.32], ["artifact", 0.2], ["enchantment", 0.2], ["planeswalker", 0.06], ["graveyard", 0.1], ["spell", 0.12]];
const ROLE_NEEDS: Need[] = ["ramp", "cardAdvantage", "interaction", "wipes", "protection", "recursion", "tutors", "finishers", "tokens", "sacrificeOutlets", "controlledDiscard", "defense"];
interface Contribution {
  quantity: number;
  land: number;
  nonland: number;
  roles: Record<Need, number>;
  coverage: Record<AnswerTarget, number>;
  commanderLink: number;
  heavyDependency: number;
  threat: number;
  impact: number;
  mvSum: number;
  highMv: number;
  engines: EnginePieces;
}
interface Totals extends Omit<Contribution, "quantity" | "engines"> {
  engines: EnginePieces;
  links: number;
}
export interface DeckCardModel {
  identity: string;
  name: string;
  quantity: number;
  commander: boolean;
  fn: CardFunction;
  contribution: Contribution;
  commanderLink: number;
  links: Map<string, number>;
  impact: number;
  /** One copy's contribution and the deck links lost when that copy leaves: precomputed for swap simulation. */
  single: Contribution;
  lostLinks: number;
}
export interface DeckModel {
  cards: DeckCardModel[];
  totals: Totals;
  targets: Record<Need, number>;
  /** Why each target is what it is: the Commander Blueprint's reasons plus what the 99 itself shows. */
  targetReasons: Record<Need, string[]>;
  vector: Vector;
  utility: number;
  blueprint: CommanderBlueprint;
  /** The deck's cards as suppliers of conditions ("creature spells with power 4+"), shared by every evaluation. */
  supply: SupplyIndex;
}
export interface SwapResult {
  cut: string;
  cutName: string;
  after: Vector;
  utility: number;
  delta: number;
  deltas: Partial<Vector>;
}
export interface UpgradeEvaluation {
  identity: string;
  name: string;
  upgradeValue: number;
  label: UpgradeLabel;
  best?: SwapResult;
  alternatives: SwapResult[];
  reasons: string[];
  concerns: string[];
  cutReasons: string[];
  confidence: "High" | "Medium" | "Low";
  trace: UpgradeTrace;
}
export interface UpgradeTrace {
  candidate: string;
  commanderRelationships: string[];
  deckRelationships: string[];
  scopedEngines: string[];
  roleChanges: string[];
  curve: string;
  bestCut?: string;
  before: Vector;
  after?: Vector;
  invalidCuts: { name: string; reason: string }[];
  final: string;
  confidence: string;
  uncertainties: string[];
}
const sat = (x: number, target: number) => (target <= 0 ? (x > 0 ? 100 : 100) : 100 * (1 - Math.exp((-1.6 * Math.max(0, x)) / target)));
// Diminishing value of the matching sources a multiplier can amplify.
const g = (n: number) => 3 * (1 - Math.exp(-Math.max(0, n) / 6));
const emptyEngines = (): EnginePieces => ({ noncombatDamageSources: 0, combatThreat: 0, attackTriggers: 0, damageMultipliers: 0, extraCombats: 0, tokenSourcesByScope: {}, tokenMultipliers: {}, controlledDiscard: 0, wantsDiscard: 0 });
const emptyRoles = () => Object.fromEntries(ROLE_NEEDS.map((r) => [r, 0])) as Record<Need, number>;
const emptyCoverage = () => Object.fromEntries([...COVERAGE.map(([t]) => t), "permanent", "nonland_permanent", "land", "battle"].map((t) => [t, 0])) as Record<AnswerTarget, number>;
function contributionOf(fn: CardFunction, quantity: number, commanderLink: number): Contribution {
  const roles = emptyRoles();
  for (const need of ROLE_NEEDS) roles[need] = (fn.roles[need] || 0) * quantity;
  const coverage = emptyCoverage();
  for (const answer of fn.answers) for (const t of answer.targets) coverage[t] += quantity;
  const engines = emptyEngines();
  for (const key of ["noncombatDamageSources", "combatThreat", "attackTriggers", "damageMultipliers", "extraCombats", "controlledDiscard", "wantsDiscard"] as const)
    engines[key] = fn.engines[key] * quantity;
  for (const [scope, n] of Object.entries(fn.engines.tokenSourcesByScope)) engines.tokenSourcesByScope[scope] = n * quantity;
  for (const [scope, n] of Object.entries(fn.engines.tokenMultipliers)) engines.tokenMultipliers[scope] = n * quantity;
  return {
    quantity,
    land: fn.isLand ? quantity : 0,
    nonland: fn.isLand ? 0 : quantity,
    roles,
    coverage,
    commanderLink: commanderLink * quantity,
    heavyDependency: commanderLink >= 0.8 && fn.impact < 0.3 ? quantity : 0,
    threat: (fn.engines.combatThreat * 0.6 + (fn.roles.finishers || 0) * 0.4) * quantity,
    impact: fn.isLand ? 0 : fn.impact * quantity,
    mvSum: fn.isLand ? 0 : fn.effectiveManaValue * quantity,
    highMv: !fn.isLand && fn.effectiveManaValue >= 6 ? quantity : 0,
    engines,
  };
}
function addInto(totals: Totals, c: Contribution, sign: 1 | -1) {
  totals.land += sign * c.land;
  totals.nonland += sign * c.nonland;
  totals.commanderLink += sign * c.commanderLink;
  totals.heavyDependency += sign * c.heavyDependency;
  totals.threat += sign * c.threat;
  totals.impact += sign * c.impact;
  totals.mvSum += sign * c.mvSum;
  totals.highMv += sign * c.highMv;
  for (const r of ROLE_NEEDS) totals.roles[r] += sign * c.roles[r];
  for (const t of Object.keys(c.coverage) as AnswerTarget[]) totals.coverage[t] += sign * c.coverage[t];
  const e = totals.engines;
  for (const key of ["noncombatDamageSources", "combatThreat", "attackTriggers", "damageMultipliers", "extraCombats", "controlledDiscard", "wantsDiscard"] as const) e[key] += sign * c.engines[key];
  for (const [scope, n] of Object.entries(c.engines.tokenSourcesByScope)) e.tokenSourcesByScope[scope] = (e.tokenSourcesByScope[scope] || 0) + sign * n;
  for (const [scope, n] of Object.entries(c.engines.tokenMultipliers)) e.tokenMultipliers[scope] = (e.tokenMultipliers[scope] || 0) + sign * n;
}
const cloneTotals = (t: Totals): Totals => ({ ...t, roles: { ...t.roles }, coverage: { ...t.coverage }, engines: { ...t.engines, tokenSourcesByScope: { ...t.engines.tokenSourcesByScope }, tokenMultipliers: { ...t.engines.tokenMultipliers } } });
/** Scoped engine value: each multiplier is worth only the matching sources it amplifies, with diminishing returns. */
export function scopedEngineValue(e: EnginePieces) {
  const parts: { name: string; value: number }[] = [];
  if (e.damageMultipliers) parts.push({ name: "damage multiplier × damage sources", value: e.damageMultipliers * g(e.noncombatDamageSources + 0.6 * e.combatThreat) });
  if (e.extraCombats) parts.push({ name: "extra combat × attack triggers / threats", value: e.extraCombats * g(1.2 * e.attackTriggers + 0.8 * e.combatThreat) });
  for (const [scope, strength] of Object.entries(e.tokenMultipliers)) if (strength > 0) parts.push({ name: `${scope === "any" ? "token" : scope} multiplier × matching ${scope === "any" ? "token" : scope} sources`, value: strength * g(e.tokenSourcesByScope[scope] || 0) });
  if (e.wantsDiscard || e.controlledDiscard) parts.push({ name: "discard enablers × discard payoffs", value: Math.min(e.wantsDiscard, 6) * 0.4 * g(e.controlledDiscard) });
  return parts;
}
export function vectorOf(t: Totals, targets: Record<Need, number>): Vector {
  const coverage = COVERAGE.reduce((n, [target, w]) => {
    const broad = target === "graveyard" || target === "spell" ? 0 : 0.7 * (t.coverage.permanent + (target === "creature" ? 0 : t.coverage.nonland_permanent));
    return n + w * (1 - Math.exp(-1.1 * (t.coverage[target] + broad)));
  }, 0);
  const nonland = Math.max(1, t.nonland);
  const average = t.mvSum / nonland;
  const landGap = t.land - targets.lands;
  // Engine density per nonland card plus scoped multiplier value, so one engine card is never invisible.
  const linkDensity = (2 * t.links) / nonland;
  const scoped = scopedEngineValue(t.engines).reduce((n, p) => n + p.value, 0);
  const excess = ROLE_NEEDS.reduce((n, r) => n + (targets[r] > 0 ? Math.max(0, t.roles[r] - 1.7 * targets[r]) : 0), 0);
  return {
    // Tribal/Commander compatibility saturates: once the plan is well supported, another on-plan card adds little.
    commanderPlan: sat(t.commanderLink, 20),
    mana: 0.55 * sat(t.roles.ramp, targets.ramp) + 0.45 * Math.max(0, 100 - (landGap < 0 ? 15 : 6) * Math.abs(landGap)),
    curve: Math.max(0, 100 - Math.max(0, average - 3.2) * 20 - Math.max(0, t.highMv / nonland - 0.12) * 100),
    cardAdvantage: sat(t.roles.cardAdvantage, targets.cardAdvantage),
    interaction: 0.45 * sat(t.roles.interaction, targets.interaction) + 40 * coverage + 0.15 * sat(t.roles.wipes, targets.wipes),
    // Protection climbs gradually: each piece helps, but one piece never outweighs a real engine.
    protection: sat(t.roles.protection, Math.max(2, 2 * targets.protection)),
    resilience: 0.75 * sat(t.roles.recursion, Math.max(1, targets.recursion)) + 0.25 * sat(t.roles.tutors, Math.max(1, targets.tutors)),
    engines: 0.6 * sat(linkDensity, 6) + 0.4 * sat(scoped, 6),
    finishing: sat(t.roles.finishers + 0.3 * t.threat, Math.max(2, 2 * targets.finishers)),
    quality: 100 * (1 - Math.exp(-2 * (t.impact / nonland))),
    redundancy: Math.max(0, 100 - excess * 4),
    dependency: Math.max(0, 100 - Math.max(0, t.heavyDependency / nonland - 0.3) * 200),
  };
}
export const utilityOf = (v: Vector) => COMPONENTS.reduce((n, c) => n + COMPONENT_WEIGHTS[c] * v[c], 0);
const linkOf = (rec: RecommendationData | undefined) => ({
  commander: Math.max(0, ...(rec?.links || []).filter((l) => l.commander).map((l) => l.strength)),
  deck: new Map((rec?.links || []).filter((l) => !l.commander && l.strength >= 0.5).map((l) => [l.identity, l.strength])),
});
/** The saved deck as a utility model; built once per deck revision. */
export function buildDeckModel(dna: DeckDna, blueprint: CommanderBlueprint): DeckModel {
  const supply = new SupplyIndex(dna.strategyProfile.cards.map((c) => ({ card: c.card.card, quantity: c.card.quantity, commander: c.card.commander })));
  const cards: DeckCardModel[] = dna.strategyProfile.cards.map((c) => {
    const input: DnaInputCard = c.card;
    const fn = deckCardFunction(input.card, supply);
    const { commander, deck } = linkOf(dna.cards[input.identity]?.recommendation);
    const link = input.commander ? 0 : commander;
    return {
      identity: input.identity,
      name: input.card.name,
      quantity: input.quantity,
      commander: input.commander,
      fn,
      contribution: contributionOf(fn, input.commander ? 0 : input.quantity, link),
      commanderLink: link,
      links: deck,
      impact: fn.impact,
      single: contributionOf(fn, 1, link),
      lostLinks: 0,
    };
  });
  const { targets, reasons: targetReasons } = deckTargets(dna, blueprint, cards);
  const totals: Totals = { land: 0, nonland: 0, roles: emptyRoles(), coverage: emptyCoverage(), commanderLink: 0, heavyDependency: 0, threat: 0, impact: 0, mvSum: 0, highMv: 0, engines: emptyEngines(), links: 0 };
  for (const card of cards) addInto(totals, card.contribution, 1);
  // Commanders are always available as engine sources (e.g. Lathliss makes Dragon tokens), never as cuts, and the roles
  // they fill themselves (Niv-Mizzet's card draw, Kenrith's reanimation) count toward the deck's totals.
  for (const card of cards.filter((c) => c.commander)) {
    for (const need of ROLE_NEEDS) totals.roles[need] += card.fn.roles[need] || 0;
    const e = card.fn.engines;
    for (const [scope, n] of Object.entries(e.tokenSourcesByScope)) totals.engines.tokenSourcesByScope[scope] = (totals.engines.tokenSourcesByScope[scope] || 0) + n;
    totals.engines.noncombatDamageSources += e.noncombatDamageSources;
    totals.engines.attackTriggers += e.attackTriggers;
    totals.engines.combatThreat += e.combatThreat;
    totals.engines.controlledDiscard += e.controlledDiscard;
    totals.engines.wantsDiscard += e.wantsDiscard;
  }
  const ids = new Set(cards.filter((c) => !c.commander).map((c) => c.identity));
  let links = 0;
  for (const card of cards.filter((c) => !c.commander))
    for (const [other, strength] of card.links)
      if (ids.has(other) && other !== card.identity) {
        links += strength / 2;
        card.lostLinks += strength;
      }
  totals.links = links;
  const vector = vectorOf(totals, targets);
  return { cards, totals, targets, targetReasons, vector, utility: utilityOf(vector), blueprint, supply };
}
// Strategy-specific needs rise only when the 99 itself pursues that plan, whatever the Commander's text suggests.
const PLAN_NEEDS: [Need, string, number][] = [
  ["recursion", "graveyard", 5],
  ["tokens", "tokens", 8],
  ["sacrificeOutlets", "sacrifice", 3],
  ["controlledDiscard", "discard", 6],
];
/** Role targets for this deck: the Commander Blueprint as a prior, adjusted by the curve and themes of the actual 99. */
function deckTargets(dna: DeckDna, blueprint: CommanderBlueprint, cards: DeckCardModel[]) {
  const targets = Object.fromEntries(Object.entries(blueprint.needs).map(([n, v]) => [n, v.target])) as Record<Need, number>;
  const reasons = Object.fromEntries(Object.entries(blueprint.needs).map(([n, v]) => [n, [...v.reasons]])) as Record<Need, string[]>;
  const main = cards.filter((c) => !c.commander && !c.fn.isLand);
  const count = main.reduce((n, c) => n + c.quantity, 0);
  if (count >= 20) {
    const average = main.reduce((n, c) => n + c.fn.effectiveManaValue * c.quantity, 0) / count;
    const shift = Math.max(-4, Math.min(3, Math.round(3 * (average - 3.2))));
    if (shift) {
      targets.ramp = Math.max(4, targets.ramp + shift);
      reasons.ramp.push(`The 99's average mana value is ${average.toFixed(1)}, so this deck needs ${shift < 0 ? "less" : "more"} acceleration (target ${targets.ramp}).`);
    }
  }
  // Card velocity: a deck that draws far more than the baseline finds its land drops with fewer lands.
  const draw = main.reduce((n, c) => n + (c.fn.roles.cardAdvantage || 0) * c.quantity, 0) + cards.filter((c) => c.commander).reduce((n, c) => n + (c.fn.roles.cardAdvantage || 0), 0);
  if (draw >= 2 * targets.cardAdvantage && targets.lands > 33) {
    targets.lands -= 2;
    reasons.lands.push(`This deck draws heavily (${draw.toFixed(1)} card-advantage pieces), so it needs fewer lands (target ${targets.lands}).`);
  }
  // Defense is optional; a deck that already runs several pillowfort / restriction cards gets a row to track it.
  const defense = main.filter((c) => c.fn.roles.defense).length;
  if (defense >= 3 && !targets.defense) {
    targets.defense = 3;
    reasons.defense.push(`This deck runs ${defense} pillowfort or restriction cards, so Defense is tracked.`);
  }
  const theme = (id: string) => dna.themes.find((t) => t.id === id);
  for (const [need, family, planTarget] of PLAN_NEEDS) {
    const t = theme(family);
    const pursued = !!t && (t.percent >= 15 || (dna.core.primary.includes(t.label) && t.percent >= 10));
    const prior = baseline[need][0];
    if (pursued && targets[need] < planTarget) {
      targets[need] = planTarget;
      reasons[need].push(`${t!.label} is one of this deck's main themes (${t!.percent}%).`);
    } else if (!pursued && targets[need] > prior && (t?.percent || 0) < 10) {
      targets[need] = prior;
      reasons[need].push(`The Commander suggests it, but this deck's 99 doesn't pursue ${family} (${t ? `${t.percent}% of the deck` : "no theme"}), so the target stays at ${prior}.`);
    }
  }
  return { targets, reasons };
}
const ESSENTIAL: Need[] = ["ramp", "cardAdvantage", "interaction", "protection", "wipes", "finishers"];
function invalidReason(model: DeckModel, before: Totals, after: Totals, cut: DeckCardModel, fn: CardFunction): string | null {
  if (cut.commander) return "The Commander is never a cut.";
  if (cut.fn.isLand !== fn.isLand) return fn.isLand ? "A land only replaces a land." : "Lands are never cut for a spell; land count is preserved.";
  for (const need of ESSENTIAL) {
    const floor = need === "protection" || need === "wipes" || need === "finishers" ? 0.5 : Math.max(1, 0.5 * model.targets[need]);
    if (before.roles[need] >= floor && after.roles[need] < floor && !(fn.roles[need] || 0))
      return `Would drop ${needLabels[need].toLowerCase()} below a working minimum (${after.roles[need].toFixed(1)}), and the candidate does not replace it.`;
  }
  for (const [target] of COVERAGE) {
    if (target === "spell" || target === "graveyard") continue;
    const covered = (t: Totals) => t.coverage[target] + t.coverage.permanent + (target === "creature" ? 0 : t.coverage.nonland_permanent);
    if (covered(before) >= 0.5 && covered(after) < 0.5) return `Would remove the deck's only ${target} answer.`;
  }
  if (model.targets.controlledDiscard > 0 && before.roles.controlledDiscard >= 1 && after.roles.controlledDiscard < 1) return "Would remove the deck's only controlled discard for its discard mechanic.";
  return null;
}
interface CandidateContext {
  fn: CardFunction;
  contribution: Contribution;
  deck: Map<string, number>;
  /** Sum of the candidate's links to non-Commander cards in this deck. */
  linkTotal: number;
}
function candidateContext(model: DeckModel, card: CardMetadata, rec: RecommendationData | undefined): CandidateContext {
  const fn = deckCardFunction(card, model.supply);
  const { commander, deck } = linkOf(rec);
  let linkTotal = 0;
  for (const c of model.cards) if (!c.commander) linkTotal += deck.get(c.identity) || 0;
  return { fn, contribution: contributionOf(fn, 1, commander), deck, linkTotal };
}
function simulate(model: DeckModel, candidate: CandidateContext, cut: DeckCardModel): SwapResult | { invalid: string } {
  const fn = candidate.fn;
  if (cut.fn.isLand !== fn.isLand) return { invalid: fn.isLand ? "A land only replaces a land." : "Lands are never cut for a spell; land count is preserved." };
  const after = cloneTotals(model.totals);
  // One copy leaves; basics and other multi-copy entries lose one copy, not the whole entry.
  addInto(after, cut.single, -1);
  addInto(after, candidate.contribution, 1);
  after.links = model.totals.links - (cut.quantity === 1 ? cut.lostLinks : 0) + candidate.linkTotal - (cut.quantity === 1 ? candidate.deck.get(cut.identity) || 0 : 0);
  const reason = invalidReason(model, model.totals, after, cut, fn);
  if (reason) return { invalid: reason };
  const vector = vectorOf(after, model.targets);
  const utility = utilityOf(vector);
  const deltas: Partial<Vector> = {};
  for (const c of COMPONENTS) {
    const d = vector[c] - model.vector[c];
    if (Math.abs(d) >= 0.05) deltas[c] = Math.round(d * 10) / 10;
  }
  return { cut: cut.identity, cutName: cut.name, after: vector, utility, delta: utility - model.utility, deltas };
}
/** A user-chosen comparison: simulate exactly this one-for-one swap (never writes the deck). */
export function simulateSwap(model: DeckModel, card: CardMetadata, rec: RecommendationData | undefined, cutIdentity: string): SwapResult | { invalid: string } {
  const cut = model.cards.find((c) => c.identity === cutIdentity);
  if (!cut) return { invalid: "That card is not in this deck." };
  return simulate(model, candidateContext(model, card, rec), cut);
}
const confidenceRank = { High: 3, Medium: 2, Low: 1 } as const;
export function evaluateUpgrade(model: DeckModel, card: CardMetadata, identity: string, rec: RecommendationData | undefined): UpgradeEvaluation {
  const candidate = candidateContext(model, card, rec);
  const { fn, deck } = candidate;
  const { commander } = linkOf(rec);
  const ids = new Map(model.cards.map((c) => [c.identity, c]));
  const results: SwapResult[] = [];
  const invalid: { name: string; reason: string }[] = [];
  for (const cut of model.cards) {
    if (cut.commander || cut.identity === identity) continue;
    const swap = simulate(model, candidate, cut);
    if ("invalid" in swap) invalid.push({ name: cut.name, reason: swap.invalid });
    else results.push(swap);
  }
  results.sort((a, b) => b.delta - a.delta || a.cutName.localeCompare(b.cutName, "en"));
  const best = results[0];
  const lowest = Math.min(confidenceRank[rec?.confidence || "Medium"], confidenceRank[fn.confidence]);
  const confidence = lowest === 3 ? "High" : lowest === 2 ? "Medium" : "Low";
  let value = best ? Math.round(best.delta * 100) / 100 : -Infinity;
  let label = best ? upgradeLabel(value) : "Downgrade";
  const concerns: string[] = [];
  // Low confidence never becomes high recommendation certainty.
  if (confidence === "Low" && ["Major Upgrade", "Strong Upgrade", "Moderate Upgrade"].includes(label)) {
    label = "Minor Upgrade";
    concerns.push("Oracle parsing is incomplete, so this swap claim is capped; review it manually.");
  }
  if (!best) {
    value = 0;
    concerns.push("No valid one-for-one cut keeps the deck's essential functions.");
  }
  const reasons: string[] = [];
  const cutReasons: string[] = [];
  const scoped = scopedEngineValue(model.totals.engines);
  const commanderNames = model.cards.filter((c) => c.commander).map((c) => c.name);
  if (best) {
    const d = best.deltas;
    const linked = [...deck.keys()].map((id) => ids.get(id)?.name).filter((n): n is string => !!n && n !== best.cutName);
    // A reason needs a visible change (a point or more out of 100), not rounding noise.
    if ((d.commanderPlan || 0) >= 1 && commander >= 0.5) reasons.push(`Strengthens the ${commanderNames.join(" + ")} plan${model.vector.commanderPlan > 85 ? " (already well supported, so the gain is small)" : ""}.`);
    if ((d.engines || 0) >= 1) reasons.push(`Improves existing engines${linked.length ? `: ${linked.slice(0, 3).join(", ")}` : ""}.`);
    if ((d.finishing || 0) >= 1) reasons.push("Improves finishing power.");
    if ((d.interaction || 0) >= 1) reasons.push(`Improves interaction${fn.coverage.length ? ` (${fn.coverage.join(" / ").replaceAll("_", " ")} answers)` : ""}.`);
    if ((d.cardAdvantage || 0) >= 1) reasons.push("Improves card advantage.");
    if ((d.mana || 0) >= 1) reasons.push("Improves mana.");
    if ((d.protection || 0) >= 1) reasons.push("Adds protection.");
    if ((d.curve || 0) >= 1) reasons.push("Smooths the curve.");
    for (const [c, v] of Object.entries(d) as [Component, number][]) if (v < -0.5) concerns.push(`${componentLabels[c]} ${v.toFixed(1)}.`);
    if (fn.lowImpactBody) concerns.push("Adds little beyond its creature type and body.");
    for (const c of fn.conditions || []) {
      if (c.factor >= 0.5 && c.understood) reasons.push(`Its "${c.needs}" ability has ${c.suppliers.length} cards here to feed it: ${c.suppliers.slice(0, 3).join(", ")}${c.suppliers.length > 3 ? "…" : ""}.`);
      else if (c.understood) concerns.push(`Its "${c.needs}" ability ${c.suppliers.length ? `has only ${c.suppliers.join(", ")} to feed it` : "has nothing in this deck to feed it"}, so it gets ${c.factor > 0 ? "little" : "no"} credit.`);
      else concerns.push(`Couldn't check what feeds "${c.line.slice(0, 80)}" in this deck; that ability gets half credit.`);
    }
    if (commander >= 0.8 && model.vector.commanderPlan > 85) concerns.push("The Commander plan is already saturated; another on-plan card adds little.");
    const cut = ids.get(best.cut)!;
    if (cut.impact < fn.impact) cutReasons.push(`${cut.name} has lower standalone impact (${Math.round(cut.impact * 100)} vs ${Math.round(fn.impact * 100)}).`);
    if (cut.fn.lowImpactBody) cutReasons.push(`${cut.name} contributes little beyond its body and type.`);
    if (!cut.commanderLink && !cut.links.size) cutReasons.push(`${cut.name} has no verified relationship with the Commander or deck engines.`);
    const overfull = (Object.keys(cut.fn.roles) as Need[]).filter((r) => model.targets[r] > 0 && model.totals.roles[r] > 1.25 * model.targets[r]);
    if (overfull.length) cutReasons.push(`${needLabels[overfull[0]]} is above target (${model.totals.roles[overfull[0]].toFixed(1)} / ${model.targets[overfull[0]]}).`);
    if (!cutReasons.length) cutReasons.push(`Removing ${cut.name} costs the deck the least utility among valid cuts.`);
  }
  const roleChanges = best
    ? ROLE_NEEDS.flatMap((r) => {
        const cut = ids.get(best.cut)!.fn.roles[r] || 0;
        const add = fn.roles[r] || 0;
        return add !== cut ? [`${needLabels[r]} ${add - cut > 0 ? "+" : ""}${(add - cut).toFixed(1)}`] : [];
      })
    : [];
  const final = `${label} (${value >= 0 ? "+" : ""}${value.toFixed(2)})`;
  return {
    identity,
    name: card.name,
    upgradeValue: value,
    label,
    best,
    alternatives: results.slice(1).filter((r) => best && r.delta >= best.delta - 0.5).slice(0, 2),
    reasons,
    concerns,
    cutReasons,
    confidence,
    trace: {
      candidate: card.name,
      commanderRelationships: (rec?.commander.evidence || []).slice(0, 4),
      deckRelationships: [...deck].map(([id, s]) => `${ids.get(id)?.name || id} (${s.toFixed(2)})`),
      scopedEngines: scoped.map((p) => `${p.name}: ${p.value.toFixed(2)}`),
      roleChanges,
      curve: `MV ${fn.manaValue}${best ? ` replacing MV ${ids.get(best.cut)!.fn.manaValue}` : ""}`,
      bestCut: best?.cutName,
      before: model.vector,
      after: best?.after,
      invalidCuts: invalid.slice(0, 12),
      final,
      confidence,
      uncertainties: [...fn.uncertainties, ...(rec?.confidenceReasons.filter((r) => !/^Canonical type/.test(r)) || [])],
    },
  };
}
const bandIndex = (label: UpgradeLabel) => UPGRADE_BANDS.findIndex(([, l]) => l === label);
// Within one label, a confident result outranks an uncertain one: low confidence never reads as certainty.
export const compareUpgrade = (a: UpgradeEvaluation, b: UpgradeEvaluation) =>
  bandIndex(a.label) - bandIndex(b.label) ||
  confidenceRank[b.confidence] - confidenceRank[a.confidence] ||
  b.upgradeValue - a.upgradeValue || confidenceRank[b.confidence] - confidenceRank[a.confidence] || a.name.localeCompare(b.name, "en") || a.identity.localeCompare(b.identity, "en");
