// Mode 1 — Build Around My Commander. Two independent answers:
//   Commander Fit:  does this card belong conceptually in this Commander's strategy?
//   Build Priority: building from scratch, how much should I want it in the deck?
// A weak card can fit strongly; a strong staple can fit weakly. Neither number is lowered to match the other.
import type { DnaInputCard } from "../dna/engine";
import { cardFeatures } from "../dna/strategy";
import { scoreRecommendation } from "../synergy/recommendation";
import { benefitsYou, hasCreatureType } from "../synergy/facts";
import { cardFunction, needLabels } from "./cardFunction";
import type { CardFunction, Need } from "./cardFunction";
import type { CommanderBlueprint } from "./blueprint";

export const BUILD_VERSION = "1.0.0";
export type FitLabel = "Exceptional" | "Excellent" | "Strong" | "Good" | "Situational" | "Weak";
export type PriorityLabel = "Core" | "High Priority" | "Strong Consideration" | "Consider" | "Situational" | "Low Priority";
export type Dependency = "Standalone" | "Moderate Commander dependency" | "Heavy Commander dependency";
export type Confidence = "High" | "Medium" | "Low";
// Initial calibrated boundaries; regression fixtures pin the behavior they produce.
export const FIT_BANDS: [number, FitLabel][] = [[90, "Exceptional"], [80, "Excellent"], [68, "Strong"], [55, "Good"], [35, "Situational"], [0, "Weak"]];
export const PRIORITY_BANDS: [number, PriorityLabel][] = [[85, "Core"], [72, "High Priority"], [60, "Strong Consideration"], [47, "Consider"], [34, "Situational"], [0, "Low Priority"]];
export const fitLabel = (score: number) => FIT_BANDS.find(([min]) => score >= min)![1];
export const priorityLabel = (score: number) => PRIORITY_BANDS.find(([min]) => score >= min)![1];
export interface BuildEvaluation {
  identity: string;
  name: string;
  commanderFit: number;
  fitLabel: FitLabel;
  fitReasons: string[];
  buildPriority: number;
  priorityLabel: PriorityLabel;
  priorityReasons: string[];
  priorityConcerns: string[];
  dependency: Dependency;
  timing?: string;
  confidence: Confidence;
  trace: Record<string, unknown>;
}
const rank = { High: 3, Medium: 2, Low: 1 } as const;
const lower = (a: Confidence, b: Confidence): Confidence => (rank[a] <= rank[b] ? a : b);
const generalFeatures = new Set(["lands", "artifacts", "enchantments", "spells", "drawEngine", "damage", "goodstuff"]);
/** `fn` is the card's function in this deck (conditions checked against its cards); context-free when omitted. */
export function evaluateForBuild(blueprint: CommanderBlueprint, input: DnaInputCard, fn: CardFunction = cardFunction(input.card)): BuildEvaluation {
  const scored = scoreRecommendation(blueprint.profile, input);
  const rec = scored.recommendation!;
  const faces = fn.facts.faces;
  const components: { name: string; value: number; reason: string }[] = [];
  // 1. Verified typed interaction with the Commander's printed abilities (shared v0.6.3 engine).
  if (rec.commander.score > 0)
    components.push({
      name: "commander",
      // A verified trigger alone is Strong; additional distinct mechanics raise it further.
      value: Math.min(90, 42 + rec.commander.score * 1.3),
      reason: rec.commander.evidence[0] || `Verified rules interaction with ${blueprint.commanders.join(" + ")}.`,
    });
  // 2. Creature type the Commander cares about: compatibility, not quality.
  const typed = blueprint.supportedTypes.filter((t) => faces.some((f) => f.cardTypes.includes("Creature") && hasCreatureType(f, t)));
  if (typed.length)
    components.push({ name: "type", value: 62, reason: `${fn.changeling ? "Changeling — counts as " : ""}${typed.join(" / ")} creature for ${blueprint.commanders[0]}.` });
  const tokenTypes = blueprint.supportedTypes.filter((t) => faces.some((f) => f.createsTokens.some((k) => benefitsYou(k.controller) && k.creatureTypes.includes(t))));
  if (tokenTypes.length)
    components.push({ name: "tokens", value: 56, reason: `Creates ${tokenTypes.join(" / ")} tokens (tokens never satisfy nontoken conditions).` });
  // 3. Shared strategic mechanics with the Commander.
  const features = cardFeatures(input);
  // Tokens only count when this card's own typed token effects can feed the plan (never tokens for other players,
  // never a multiplier scoped to a token type the Commander does not make).
  const ownTokenScopes = Object.keys(fn.engines.tokenSourcesByScope);
  const multiplierMatches = Object.keys(fn.engines.tokenMultipliers).some((s) => s === "any" || blueprint.tokenTypes.includes(s));
  const tokenFeed = ownTokenScopes.length > 0 || multiplierMatches || fn.facts.typedRoles.includes("token_payoff");
  const shared = blueprint.features.filter(
    (f) => !generalFeatures.has(f) && !f.startsWith("typal:") && (features.get(f) || 0) >= 1 && (f !== "tokens" || tokenFeed),
  );
  if (shared.length)
    components.push({ name: "mechanics", value: Math.min(72, 52 + 8 * (shared.length - 1)), reason: `Shares the Commander's ${shared.join(", ")} plan.` });
  // 4. Scoped engine relationships with what the Commander produces.
  const commanderFunctions = blueprint.profile.cards.filter((c) => c.card.commander).map((c) => cardFunction(c.card.card));
  const combatPlan = blueprint.mechanics.some((m) => /^(?:attacks|combat-damage)/.test(m.id)) || commanderFunctions.some((c) => c.engines.combatThreat > 0.5 || Object.keys(c.engines.tokenSourcesByScope).length > 0);
  if (fn.engines.damageMultipliers && (combatPlan || commanderFunctions.some((c) => c.engines.noncombatDamageSources > 0)))
    components.push({ name: "damage", value: 60, reason: "Multiplies the damage the Commander's plan already deals." });
  if (fn.engines.extraCombats && (combatPlan || blueprint.mechanics.some((m) => m.id.startsWith("attacks"))))
    components.push({ name: "combat", value: blueprint.mechanics.some((m) => m.id.startsWith("attacks")) ? 70 : 58, reason: "Extra combat repeats the Commander's attack plan." });
  for (const scope of Object.keys(fn.engines.tokenMultipliers)) {
    const matches = scope === "any" ? blueprint.tokenTypes.length > 0 || blueprint.needs.tokens.target > 0 : blueprint.tokenTypes.includes(scope);
    if (matches) components.push({ name: "token-multiplier", value: 70, reason: `Multiplies ${scope === "any" ? "every token" : `${scope} tokens`} the Commander's plan creates.` });
  }
  if (fn.engines.controlledDiscard && commanderFunctions.some((c) => c.engines.wantsDiscard))
    components.push({ name: "discard", value: 66, reason: "Controlled discard enables the Commander's discard mechanic." });
  // 5. Structural support only: the blueprint needs it, but it is not about this Commander.
  const roles = (Object.keys(fn.roles) as Need[]).filter((r) => r !== "lands" || !fn.isBasicLand);
  const emphasized = roles.filter((r) => blueprint.needs[r].weight >= 1);
  if (roles.length)
    components.push({
      name: "structure",
      value: Math.min(42, 22 + 10 * Math.max(0, ...roles.map((r) => blueprint.needs[r].weight - 0.6))),
      reason: emphasized.length
        ? `Fills ${emphasized.map((r) => needLabels[r].toLowerCase()).join(" and ")}, which this Commander's deck needs (general support, not Commander-specific).`
        : `General ${roles.map((r) => needLabels[r].toLowerCase()).join(" / ")} support.`,
    });
  const nonbo = scored.debug.penalties.some((p) => p.name === "nonbo");
  // Evasion matters when the Commander's plan attacks with (or makes) evasive creatures.
  const evasive = fn.isCreature && /flying|trample|menace/i.test((input.card.keywords || []).join(" "));
  if (evasive && combatPlan && components.some((c) => c.name === "commander" || c.name === "type"))
    components.push({ name: "evasion", value: 3, reason: "Evasion supports the Commander's attacking plan." });
  components.sort((a, b) => b.value - a.value);
  // The type match restates the Commander trigger when both exist; count distinct mechanics only once.
  const distinct = components.slice(1).filter((c) => c.value >= 50 && !(c.name === "type" && components.some((o) => o.name === "commander")));
  let fit = components.length
    ? components[0].value + 5 * Math.min(3, distinct.length) + components.filter((c) => c.name === "evasion").reduce((n, c) => n + c.value, 0)
    : 15;
  const fitReasons = components.filter((c) => c.value >= 30).map((c) => c.reason);
  if (nonbo) {
    fit -= 20;
    fitReasons.push("Works against an engine the Commander relies on.");
  }
  fit = Math.round(Math.max(0, Math.min(100, fit)));
  // Commander dependency: how much of the value disappears without the Commander.
  const direct = components.some((c) => c.name === "commander");
  const dependency: Dependency = !direct ? "Standalone" : fn.impact < 0.3 ? "Heavy Commander dependency" : "Moderate Commander dependency";
  const timing = direct && /enters|being cast|cast/.test(components.find((c) => c.name === "commander")!.reason)
    ? "Its Commander interaction needs the Commander on the battlefield when it is cast or enters."
    : undefined;
  // Build Priority: probabilistic union of strategic fit and standalone impact, with role importance.
  const roleFactor = roles.length ? Math.max(0.85, Math.min(1.35, Math.max(...roles.map((r) => blueprint.needs[r].weight)))) : 1;
  const value = Math.min(0.98, fn.impact * roleFactor);
  const dependencyFactor = dependency === "Heavy Commander dependency" ? 0.75 : dependency === "Moderate Commander dependency" ? 0.9 : 1;
  let priority = 100 * (1 - (1 - 0.5 * (fit / 100) * dependencyFactor) * (1 - value));
  const concerns: string[] = [];
  if (fn.lowImpactBody) {
    priority -= 8;
    concerns.push("Low standalone impact: little beyond its creature type and body.");
  }
  if (nonbo) priority -= 15;
  if (dependency === "Heavy Commander dependency") concerns.push("Most of its value depends on the Commander being on the battlefield.");
  if (fn.manaValue >= 6 && !fn.roles.finishers) concerns.push(`Costs ${fn.manaValue} mana without finishing power.`);
  else if (fn.manaValue >= 6) concerns.push(`High impact, but ${fn.manaValue} mana.`);
  priority = Math.round(Math.max(0, Math.min(100, priority)));
  const confidence = lower(rec.confidence, fn.confidence);
  if (confidence === "Low") concerns.push("Oracle parsing is incomplete for this card; review it manually.");
  return {
    identity: input.identity,
    name: input.card.name,
    commanderFit: fit,
    fitLabel: fitLabel(fit),
    fitReasons: fitReasons.length ? fitReasons : ["No direct relationship with the Commander's mechanics."],
    buildPriority: priority,
    priorityLabel: priorityLabel(priority),
    // Conditional abilities always come with the deck cards that feed them (or the note that none do).
    priorityReasons: [...fn.impactReasons.slice(0, 3), ...(fn.conditionNotes || [])],
    priorityConcerns: concerns,
    dependency,
    timing,
    confidence,
    trace: { components, impact: fn.impact, roleFactor, dependencyFactor, roles, commanderScore: rec.commander.score, uncertainties: fn.uncertainties },
  };
}
export const compareBuild = (a: BuildEvaluation, b: BuildEvaluation) =>
  b.buildPriority - a.buildPriority ||
  b.commanderFit - a.commanderFit ||
  rank[b.confidence] - rank[a.confidence] ||
  a.name.localeCompare(b.name, "en") ||
  a.identity.localeCompare(b.identity, "en");
