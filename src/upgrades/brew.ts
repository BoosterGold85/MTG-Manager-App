// Brew Score v1: "How interesting and unusually useful is this card in THIS deck?" A separate lens from Synergy
// ("how strongly does it support the deck?"). Deck-relative only: every component reads this deck's own packages
// (Deck DNA themes and their contributing cards), typed links to its actual cards and the condition suppliers from
// v0.6.12. No popularity, price, archetype template or named-card table. Reading it never changes Synergy or Upgrades.
import type { CardMetadata } from "../models/collection";
import type { CardSynergy, DeckDna } from "../dna/engine";
import type { DeckModel } from "./upgrade";
import type { CardFunction, Need } from "./cardFunction";
import { deckCardFunction, needLabels } from "./cardFunction";
import { stripReminderText } from "../utils/rulesText";
import { hasSelfEntryAbility } from "./abilityScope";
import { families } from "../dna/families";

export const BREW_VERSION = "1.0.1";
/** Maximum positive points per component (total 100). Penalties are signed and the result is clamped to 0–100. */
export const BREW_WEIGHTS = Object.freeze({ contextualSynergy: 25, interaction: 20, bridge: 20, novelty: 15, multiplicative: 10, commander: 5, role: 5 });
export type BrewBand = "Hidden Gem" | "Interesting Brew" | "Some Brew Potential" | "Conventional / Weak Brew Fit";
export const BREW_BANDS: [number, BrewBand][] = [[85, "Hidden Gem"], [70, "Interesting Brew"], [50, "Some Brew Potential"], [0, "Conventional / Weak Brew Fit"]];
export const brewBand = (score: number) => BREW_BANDS.find(([min]) => score >= min)![1];
/** Low-confidence deck analysis never earns a "Hidden Gem" claim. */
export const brewLabel = (score: number, analysis: "High" | "Medium" | "Low") => (brewBand(score) === "Hidden Gem" && analysis === "Low" ? "Potential Brew" : brewBand(score));
export interface BrewLine {
  title: string;
  text: string;
}
export interface BrewResult {
  score: number;
  band: BrewBand;
  /** "Potential Brew" replaces "Hidden Gem" when the deck analysis itself is Low confidence. */
  label: string;
  synergy: number;
  components: { name: string; points: number }[];
  penalties: { name: string; points: number }[];
  bridge?: { from: string; to: string; strength: number; existing: string[] };
  /** One line for the candidate card: the bridge, or the strongest interaction. */
  headline: string;
  summary: string;
  why: BrewLine[];
  negatives: string[];
  confidence: "High" | "Medium" | "Low";
}
interface Package {
  id: string;
  label: string;
  members: Set<string>;
  presence: number;
  support: boolean;
}
export interface BrewContext {
  dna: DeckDna;
  model: DeckModel;
  packages: Package[];
  names: Map<string, string>;
  copiers: { name: string; ignoresLegend: boolean }[];
  blinkers: string[];
  commanders: string[];
  confidence: "High" | "Medium" | "Low";
}
// Families that describe what a deck needs rather than what it is about: a bridge into them counts less.
const SUPPORT = new Set(["ramp", "advantage", "interaction"]);
// What a card's own role produces, in Deck DNA family terms.
const ROLE_FAMILY: Partial<Record<Need, string>> = {
  recursion: "graveyard",
  cardAdvantage: "advantage",
  ramp: "ramp",
  tokens: "tokens",
  sacrificeOutlets: "sacrifice",
  interaction: "interaction",
  wipes: "interaction",
  controlledDiscard: "discard",
};
const CONFLICTS = new Set(["requires_missing_enabler", "unsupported_subtheme", "wrong_token_type", "wrong_tribal_type", "win_more"]);
const textOf = (c: CardMetadata) => stripReminderText(c.oracleText || c.cardFaces?.map((f) => f.oracleText || "").join("\n") || "");
const list = (names: string[], max = 3) => (names.length > max ? `${names.slice(0, max).join(", ")} and ${names.length - max} more` : names.join(", "));
const sat = (x: number, scale: number) => 1 - Math.exp(-Math.max(0, x) / scale);

export function brewContext(dna: DeckDna, model: DeckModel, confidence: "High" | "Medium" | "Low"): BrewContext {
  const names = new Map(model.cards.map((c) => [c.identity, c.name]));
  const packages: Package[] = dna.themes
    .filter((t) => t.percent >= 8 && t.contributors.length >= 3)
    .map((t) => ({ id: t.id, label: t.label, members: new Set(t.contributors), presence: Math.min(1, t.contributors.length / 8), support: SUPPORT.has(t.id) }));
  const main = dna.strategyProfile.cards.filter((c) => !c.card.commander).map((c) => c.card);
  const tagged = (tags: string[]) => main.filter((c) => c.assignments.some((a) => tags.includes(a.tagId)));
  return {
    dna,
    model,
    packages,
    names,
    copiers: tagged(["clones", "copy-creature-spells"]).map((c) => ({ name: c.card.name, ignoresLegend: /(?:isn't|not) legendary/i.test(textOf(c.card)) })),
    blinkers: tagged(["blink"]).map((c) => c.card.name),
    commanders: model.cards.filter((c) => c.commander).map((c) => c.name),
    confidence,
  };
}
/** The Deck DNA family a condition belongs to: Hardened Scales-style counters → Counters, instants → Spells, Dragons → Dragons. */
function conditionFamily(key: string): string | undefined {
  const [kind, subject = ""] = key.split(":");
  if (kind === "counters") return "counters";
  if (kind === "graveyard-leave" || kind === "self-mill") return "graveyard";
  if (kind === "dies" || kind === "sacrifice") return "sacrifice";
  if (kind === "noncombat-damage") return "pings";
  if (["token", "lifegain", "discard"].includes(kind)) return { token: "tokens", lifegain: "lifegain", discard: "discard" }[kind];
  if (kind === "enters" && subject === "land") return "lands";
  if (/\b(?:instant|sorcery|noncreature)\b/.test(subject)) return "spells";
  if (/\benchantment\b/.test(subject)) return "enchantments";
  if (/\bVehicle\b/i.test(subject)) return "vehicles";
  if (/\b(?:aura|equipment)\b/i.test(subject)) return "voltron";
  if (/\bartifact\b/.test(subject)) return "artifacts";
  const type = subject.match(/\b([A-Z][a-z-]+)\b/);
  return type ? `typal:${type[1]}` : undefined;
}
interface Source {
  id: string;
  label: string;
  presence: number;
  suppliers: string[];
  /** Families this source feeds through the card; undefined means any of the card's own outputs. */
  feeds?: Set<string>;
  conditionKey?: string;
}
const familyLabel = (id: string, ctx: BrewContext) => ctx.packages.find((p) => p.id === id)?.label || families.find((f) => f.id === id)?.label || id;
/** What the card draws on in this deck (fed conditions, or payoff signals in a package) and what it feeds. */
function relations(ctx: BrewContext, synergy: CardSynergy, fn: CardFunction) {
  const sources: Source[] = [];
  for (const c of fn.conditions || []) {
    if (!c.understood || c.factor < 0.5 || c.key === "crew") continue;
    const outputs = new Set(c.adds.map((n) => ROLE_FAMILY[n as Need]).filter((f): f is string => !!f));
    const family = conditionFamily(c.key);
    const pkg = ctx.packages.find((p) => p.id === family);
    sources.push(
      pkg
        ? { id: pkg.id, label: pkg.label, presence: pkg.presence, suppliers: c.suppliers, feeds: outputs, conditionKey: c.key }
        : { id: `condition:${c.key}`, label: c.needs[0].toUpperCase() + c.needs.slice(1), presence: 0.8 * Math.min(1, c.supply / 8), suppliers: c.suppliers, feeds: outputs, conditionKey: c.key },
    );
  }
  // Payoff signals stand in only for cards without a typed condition: a condition says exactly what the card draws on.
  const conditional = sources.length > 0 || (fn.conditions || []).some((c) => c.key !== "crew");
  for (const con of conditional ? [] : synergy.connections) {
    const pkg = ctx.packages.find((p) => p.id === con.themeId);
    if (pkg && con.signals.some((s) => s.kind === "payoff") && !sources.some((s) => s.id === pkg.id))
      sources.push({ id: pkg.id, label: pkg.label, presence: pkg.presence, suppliers: [...pkg.members].map((id) => ctx.names.get(id)!).filter(Boolean) });
  }
  const feeds = new Set<string>();
  for (const [need, family] of Object.entries(ROLE_FAMILY) as [Need, string][]) if ((fn.roles[need] || 0) >= 0.5) feeds.add(family);
  for (const con of synergy.connections) if (con.signals.some((s) => s.kind === "enabler" || s.kind === "support") && con.strength >= 2) feeds.add(con.themeId);
  return { sources, feeds };
}
export function evaluateBrew(ctx: BrewContext, card: CardMetadata, synergy: CardSynergy): BrewResult {
  const fn = deckCardFunction(card, ctx.model.supply);
  const rec = synergy.recommendation;
  const text = textOf(card);
  const why: BrewLine[] = [];
  const negatives: string[] = [];
  const penalties: { name: string; points: number }[] = [];
  const copierNames = new Set(ctx.copiers.map((c) => c.name));
  // A. Contextual synergy: the existing deck-relative Synergy score, unchanged.
  const contextual = (BREW_WEIGHTS.contextualSynergy * synergy.score) / 100;
  // B. Interaction quality: verified links to this deck's cards (copy effects are scored under E) and fed conditions.
  const links = (rec?.links || []).filter((l) => !l.commander && l.strength >= 0.5 && !copierNames.has(l.name)).sort((a, b) => b.strength - a.strength || a.name.localeCompare(b.name, "en"));
  const fed = (fn.conditions || []).filter((c) => c.understood && c.factor > 0);
  const mass = links.reduce((n, l) => n + Math.min(1, l.strength), 0) + fed.reduce((n, c) => n + 2 * c.factor, 0);
  const interaction = BREW_WEIGHTS.interaction * sat(mass, 5);
  for (const c of fed) why.push({ title: "Interaction", text: `${c.suppliers.length} cards here feed its "${c.needs}" ability: ${list(c.suppliers, 4)}.` });
  if (links.length) why.push({ title: "Strongest interactions", text: `Works directly with ${list(links.map((l) => l.name), 4)}.` });
  // C. Bridge: it draws on one of this deck's packages (or a condition the deck supplies) and feeds a different one.
  const { sources, feeds } = relations(ctx, synergy, fn);
  let bridge: BrewResult["bridge"];
  let bridgeSource: Source | undefined;
  for (const source of sources) {
    for (const to of source.feeds ?? feeds) {
      if (to === source.id) continue;
      const q = ctx.packages.find((x) => x.id === to);
      // Feeding a support need the deck doesn't have as a package still counts, at a discount.
      const qPresence = q ? q.presence : SUPPORT.has(to) ? 0.5 : 0;
      const strength = source.presence * qPresence * (SUPPORT.has(to) ? 0.6 : 1);
      if (strength <= (bridge?.strength || 0)) continue;
      const existing = ctx.model.cards
        .filter((c) => !c.commander && c.name !== card.name)
        .filter((c) =>
          source.conditionKey && !ctx.packages.some((p) => p.id === source.id)
            ? (c.fn.conditions || []).some((x) => x.key === source.conditionKey && x.adds.some((n) => ROLE_FAMILY[n as Need] === to))
            : ctx.dna.cards[c.identity]?.connections.some((x) => x.themeId === source.id) && ctx.dna.cards[c.identity]?.connections.some((x) => x.themeId === to),
        )
        .map((c) => c.name);
      bridge = { from: source.label, to: familyLabel(to, ctx), strength, existing };
      bridgeSource = source;
    }
  }
  const bridgePoints = BREW_WEIGHTS.bridge * (bridge?.strength || 0);
  if (bridge && bridgeSource)
    why.unshift({ title: "Bridge", text: `${bridge.from} → ${bridge.to}. ${bridgeSource.suppliers.length} cards here supply it (${list(bridgeSource.suppliers)}); ${card.name} turns it into ${bridge.to} value.` });
  // D. Novelty: how little the deck already does this. Being unusual only counts when the card actually interacts.
  const relevance = Math.min(1, (interaction + bridgePoints) / 15);
  let novelty: number;
  if (bridge) {
    novelty = BREW_WEIGHTS.novelty * Math.exp(-bridge.existing.length / 3);
    why.push({ title: "Novelty", text: bridge.existing.length ? `Only ${bridge.existing.length} other card${bridge.existing.length === 1 ? "" : "s"} here connect${bridge.existing.length === 1 ? "s" : ""} ${bridge.from} and ${bridge.to}: ${list(bridge.existing)}.` : `Nothing else here connects ${bridge.from} and ${bridge.to}.` });
  } else {
    const keys = new Set((fn.conditions || []).map((c) => c.needs));
    const same = keys.size ? ctx.model.cards.filter((c) => !c.commander && (c.fn.conditions || []).some((x) => keys.has(x.needs))).length : Infinity;
    novelty = Number.isFinite(same) ? BREW_WEIGHTS.novelty * 0.6 * Math.exp(-same / 3) : 0;
  }
  novelty *= relevance;
  // E. Multiplicative potential: copies and blink effects that would repeat a still-useful effect.
  const creature = /\bCreature\b/.test((card.cardFaces?.[0]?.typeLine || card.typeLine).split("—")[0]);
  const legendary = /\bLegendary\b/.test(card.typeLine);
  const oncePerTurn = /\bonly once each turn\b|\bonce per turn\b/i.test(text);
  const ownEtb = hasSelfEntryAbility(card) && fn.impact > 0.3;
  const usefulCopies = creature && fn.repeatable ? ctx.copiers.filter((c) => !legendary || c.ignoresLegend) : [];
  const reuse = usefulCopies.length * (oncePerTurn ? 0.5 : 1) + (ownEtb ? ctx.blinkers.length : 0);
  const multiplicative = BREW_WEIGHTS.multiplicative * sat(reuse, 3) * relevance;
  if (usefulCopies.length) why.push({ title: "Copy support", text: `${usefulCopies.length} card${usefulCopies.length === 1 ? "" : "s"} here can copy it, and each copy works independently: ${list(usefulCopies.map((c) => c.name))}.` });
  if (ownEtb && ctx.blinkers.length) why.push({ title: "Repeat support", text: `${ctx.blinkers.length} blink effect${ctx.blinkers.length === 1 ? "" : "s"} here can reuse its entry ability: ${list(ctx.blinkers)}.` });
  if (creature && fn.repeatable && legendary && ctx.copiers.length && !usefulCopies.length) negatives.push("It's legendary, so this deck's copy effects can't make extra working copies.");
  if (oncePerTurn && usefulCopies.length) negatives.push("Its ability works only once each turn, so copies add less.");
  // F. Role value: it also fills something this deck is short of.
  let role = 0, roleNeed: Need | undefined;
  for (const [need, amount] of Object.entries(fn.roles) as [Need, number][]) {
    const target = ctx.model.targets[need] || 0;
    if (!target || need === "lands") continue;
    const gap = Math.max(0, 1 - ctx.model.totals.roles[need] / target) * Math.min(1, amount);
    if (gap > role) [role, roleNeed] = [gap, need];
  }
  const rolePoints = BREW_WEIGHTS.role * role;
  if (roleNeed && role >= 0.2) why.push({ title: "Role", text: `Also adds ${needLabels[roleNeed].toLowerCase()}, which this deck is short of (${ctx.model.totals.roles[roleNeed].toFixed(1)} / ${ctx.model.targets[roleNeed]}).` });
  // G. Commander connection: a real, verified link (not mere color or type compatibility).
  const commanderLink = Math.max(0, ...(rec?.links || []).filter((l) => l.commander).map((l) => l.strength));
  const commanderPoints = commanderLink >= 0.5 ? BREW_WEIGHTS.commander * Math.min(1, commanderLink) : 0;
  if (commanderPoints) {
    const evidence = (rec?.commander.evidence[0] || "").replace(/^[^:]*→[^:]*:\s*/, "");
    why.push({ title: "Commander", text: `Interacts with ${ctx.commanders.join(" + ")}${evidence ? `: ${evidence.length > 180 ? `${evidence.slice(0, 180).replace(/\s+\S*$/, "")}…` : evidence}` : "."}` });
  }
  // H–K. Penalties.
  if (bridge && bridge.existing.length >= 3) penalties.push({ name: "Redundancy", points: -Math.min(8, (bridge.existing.length - 2) * 2) });
  const main = Object.entries(fn.roles).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0]?.[0] as Need | undefined;
  if (main && main !== "lands" && ctx.model.targets[main] > 0 && ctx.model.totals.roles[main] > 1.5 * ctx.model.targets[main]) {
    penalties.push({ name: "Redundancy", points: -5 });
    negatives.push(`This deck already has plenty of ${needLabels[main].toLowerCase()} (${ctx.model.totals.roles[main].toFixed(1)} / ${ctx.model.targets[main]}).`);
  }
  const unfed = (fn.conditions || []).filter((c) => c.understood && c.factor < 0.5);
  if (unfed.length) {
    penalties.push({ name: "Setup cost", points: -Math.min(12, 6 * unfed.length) });
    for (const c of unfed) negatives.push(`Its "${c.needs}" ability has ${c.suppliers.length ? `only ${list(c.suppliers)}` : "nothing"} here to feed it.`);
  }
  const graveyard = ctx.packages.find((p) => p.id === "graveyard" && !p.support);
  if (graveyard && fn.answers.some((a) => a.targets.includes("graveyard"))) {
    penalties.push({ name: "Anti-synergy", points: -10 });
    negatives.push(`It exiles graveyard cards, working against this deck's own graveyard package (${list([...graveyard.members].map((id) => ctx.names.get(id)!).filter(Boolean))}).`);
  }
  // Only genuine conflicts with this deck; curve, redundancy and efficiency penalties already shape Synergy (A).
  const conflicts = synergy.debug.penalties.filter((p) => CONFLICTS.has(p.name));
  if (conflicts.length) {
    penalties.push({ name: "Anti-synergy", points: -Math.min(9, 3 * conflicts.length) });
    negatives.push(...conflicts.slice(0, 2).map((c) => c.reason));
  }
  const uncertain = (fn.conditions || []).filter((c) => !c.understood);
  if (uncertain.length || fn.confidence === "Low") {
    penalties.push({ name: "Speculation", points: -5 });
    negatives.push(uncertain.length ? `Couldn't check what feeds "${uncertain[0].line.slice(0, 80)}" in this deck.` : "Part of its text couldn't be read reliably.");
  }
  const components = [
    { name: "Contextual synergy", points: contextual },
    { name: "Interaction quality", points: interaction },
    { name: "Bridge strength", points: bridgePoints },
    { name: "Novelty", points: novelty },
    { name: "Multiplicative potential", points: multiplicative },
    { name: "Commander connection", points: commanderPoints },
    { name: "Role value", points: rolePoints },
  ].map((c) => ({ name: c.name, points: Math.round(c.points * 10) / 10 }));
  const raw = components.reduce((n, c) => n + c.points, 0) + penalties.reduce((n, p) => n + p.points, 0);
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const band = brewBand(score);
  const confidence = ctx.confidence === "Low" || fn.confidence === "Low" ? "Low" : ctx.confidence === "Medium" || fn.confidence === "Medium" ? "Medium" : "High";
  const headline = bridge ? `Connects ${bridge.from} → ${bridge.to}` : links.length ? `Works with ${list(links.map((l) => l.name), 2)}` : fed.length ? `Fed by ${list(fed[0].suppliers, 2)}` : "No unusual interaction in this deck";
  // The headline already names the bridge, so the summary starts with its evidence.
  const summary = (why.find((w) => w.title === "Bridge")?.text.replace(/^[^.]*→[^.]*\.\s*/, "") || why[0]?.text || "It doesn't create a notable interaction with this deck's cards.").trim();
  return {
    score,
    band,
    label: brewLabel(score, confidence),
    synergy: synergy.score,
    components,
    penalties,
    bridge,
    headline,
    summary,
    why,
    negatives,
    confidence,
  };
}
/** Brew High → Low, then Synergy, then name A–Z: deterministic. */
export const compareBrew = (a: { brew: BrewResult; name: string }, b: { brew: BrewResult; name: string }) =>
  b.brew.score - a.brew.score || b.brew.synergy - a.brew.synergy || a.name.localeCompare(b.name, "en");
