// Commander Blueprint: what a deck built around this Commander needs, derived generically from the
// Commander's typed mechanics plus normal Commander structure. Never from an empty-99 deck analysis,
// never from card-name exceptions.
import type { DnaInput, DnaInputCard } from "../dna/engine";
import type { DeckStrategyProfile } from "../dna/strategy";
import { buildDeckStrategyProfile } from "../dna/strategy";
import { cardFunction, needLabels } from "./cardFunction";
import type { Need } from "./cardFunction";

export const BLUEPRINT_VERSION = "1.0.0";
export interface BlueprintNeed {
  target: number;
  weight: number;
  reasons: string[];
}
export interface BlueprintMechanic {
  id: string;
  label: string;
  evidence: string;
}
export interface CommanderBlueprint {
  version: string;
  commanders: string[];
  manaValue: number;
  colorIdentity: string[];
  mechanics: BlueprintMechanic[];
  supportedTypes: string[];
  tokenTypes: string[];
  features: string[];
  needs: Record<Need, BlueprintNeed>;
  plan: string[];
  /** Typed relationship profile of the Commander alone: used for Commander Fit, never for role counts. */
  profile: DeckStrategyProfile;
}
// Normal structure of a 100-card Commander deck before any Commander-specific adjustment.
const baseline: Record<Need, [number, number, string]> = {
  lands: [36, 1, "Every Commander deck needs a reliable land base."],
  ramp: [10, 1, "Acceleration lets the deck cast its Commander and threats on time."],
  cardAdvantage: [10, 1, "Card flow keeps resources coming after the first turns."],
  interaction: [8, 0.9, "Targeted answers handle opposing threats."],
  wipes: [2, 0.55, "A few board wipes reset losing boards."],
  protection: [3, 0.55, "Protection keeps key pieces alive."],
  recursion: [2, 0.35, "Recursion recovers lost resources."],
  tutors: [2, 0.35, "Tutors find key pieces."],
  finishers: [4, 0.7, "Finishers convert a board into a win."],
  tokens: [0, 0.3, "Token generation is optional unless the plan wants bodies."],
  sacrificeOutlets: [0, 0.2, "Sacrifice outlets are optional unless the plan uses them."],
  controlledDiscard: [0, 0.2, "Controlled discard is optional unless cards want to be discarded."],
};
const mechanicLabel = (event: string, objects: string[], types: string[], nontoken: boolean) => {
  const subject = [nontoken ? "nontoken" : "", ...types, ...objects.filter((o) => !types.length || o !== "Creature")].filter(Boolean).join(" ") || "permanents";
  const verb: Record<string, string> = {
    enters: "entering",
    cast: "being cast",
    attacks: "attacking",
    "combat-damage": "dealing combat damage",
    dies: "dying",
    sacrifice: "being sacrificed",
    lifegain: "life gain",
    draw: "card draw",
    counters: "counters being placed",
    damage: "damage being dealt",
    graveyard: "graveyard events",
    counterspell: "countering spells",
    turn: "each turn",
  };
  return event === "turn" ? "Acts every turn" : `Rewards ${subject} ${verb[event] || event}`;
};
export function buildCommanderBlueprint(commanders: DnaInputCard[]): CommanderBlueprint {
  const input: DnaInput = { deckId: "blueprint", revision: commanders.map((c) => c.identity).join("+"), cards: commanders.map((c) => ({ ...c, commander: true, quantity: 1 })) };
  const profile = buildDeckStrategyProfile(input);
  const mechanics: BlueprintMechanic[] = [];
  for (const tag of profile.commanderSynergyTags) {
    if (tag.controller === "opponent") continue;
    mechanics.push({
      id: `${tag.event}:${[...tag.creatureTypes, ...tag.objects].join("+") || "any"}${tag.nontoken ? ":nontoken" : ""}${tag.selfOnly ? ":self" : ""}`,
      label: tag.selfOnly ? `${tag.commander} itself ${mechanicLabel(tag.event, [], [], false).replace(/^Rewards permanents /, "")}` : mechanicLabel(tag.event, tag.objects, tag.creatureTypes, tag.nontoken),
      evidence: tag.evidence.snippet,
    });
  }
  const functions = commanders.map((c) => cardFunction(c.card));
  const tokenTypes = [...new Set(functions.flatMap((f) => f.facts.faces.flatMap((face) => face.createsTokens.flatMap((t) => [...t.creatureTypes, ...t.tokenTypes]))))];
  for (const f of functions) {
    for (const type of tokenTypes) mechanics.push({ id: `creates:${type}`, label: `Creates ${type} tokens`, evidence: f.facts.faces.flatMap((face) => face.createsTokens).map((t) => t.text)[0] || "" });
    if (f.engines.wantsDiscard) mechanics.push({ id: "discard:cast", label: "Wants to be discarded (Mayhem / Madness / discard payoff)", evidence: f.facts.faces.flatMap((face) => face.castFromDiscard).map((c) => c.text)[0] || "" });
    if (f.engines.controlledDiscard) mechanics.push({ id: "discard:enabler", label: "Discards cards on demand", evidence: f.facts.faces.flatMap((face) => face.discards).map((d) => d.text)[0] || "" });
    if (f.engines.damageMultipliers) mechanics.push({ id: "damage:multiplier", label: "Multiplies damage", evidence: "" });
  }
  const features = [...new Set(profile.cards.filter((c) => c.card.commander).flatMap((c) => [...c.features].filter(([, w]) => w >= 1).map(([k]) => k)))].sort();
  const supportedTypes = [...new Set([
    ...profile.commanderSynergyTags.filter((t) => t.controller !== "opponent").flatMap((t) => t.creatureTypes),
    ...functions.flatMap((f) => f.facts.faces.flatMap((face) => face.tribalEffects.flatMap((e) => e.creatureTypes))),
    ...features.filter((k) => k.startsWith("typal:") && commanders.some((c) => c.assignments.some((a) => a.tagId === k))).map((k) => k.slice(6)),
  ])].sort();
  const needs = Object.fromEntries(Object.entries(baseline).map(([need, [target, weight, reason]]) => [need, { target, weight, reasons: [reason] }])) as Record<Need, BlueprintNeed>;
  const adjust = (need: Need, target: number, weight: number, reason: string) => {
    needs[need].target = Math.max(0, needs[need].target + target);
    needs[need].weight = Math.max(0.1, Math.min(1.5, needs[need].weight + weight));
    needs[need].reasons.push(reason);
  };
  const mv = Math.max(...commanders.map((c) => c.card.manaValue || 0), 0);
  if (mv >= 6) adjust("ramp", 2, 0.25, `The Commander costs ${mv}: acceleration and reliable mana matter more.`);
  else if (mv === 5) adjust("ramp", 1, 0.15, "A five-mana Commander benefits from extra acceleration.");
  else if (mv <= 2) adjust("ramp", -2, -0.15, "A low-cost Commander needs less acceleration.");
  else if (mv === 3) adjust("ramp", -1, -0.05, "A three-mana Commander needs slightly less acceleration.");
  const tags = profile.commanderSynergyTags.filter((t) => t.controller !== "opponent");
  if (tags.some((t) => !t.selfOnly && t.event !== "turn") || tags.some((t) => t.event === "turn"))
    adjust("protection", 1, 0.15, "The Commander's abilities work only while it stays on the battlefield.");
  if (tags.some((t) => t.selfOnly && (t.event === "attacks" || t.event === "combat-damage")) || features.includes("voltron")) {
    adjust("protection", 2, 0.25, "The Commander wins by attacking itself, so protection is essential.");
    adjust("finishers", -1, 0, "The Commander is itself the main threat.");
  }
  const has = (feature: string) => features.includes(feature);
  if (has("graveyard") || tags.some((t) => t.event === "graveyard" || t.event === "dies")) adjust("recursion", 3, 0.4, "Graveyard mechanics make recursion and self-mill important.");
  if (has("spells") || tags.some((t) => t.event === "cast" && t.objects.some((o) => o === "Instant" || o === "Sorcery"))) {
    adjust("cardAdvantage", 2, 0.15, "A spell-casting plan needs extra card flow.");
    adjust("interaction", 0, 0.1, "Cheap instant-speed interaction doubles as spell fuel.");
  }
  if (has("tokens") || tokenTypes.length || tags.some((t) => t.objects.includes("Token"))) adjust("tokens", 8, 0.35, "The Commander's plan wants many bodies or tokens.");
  if (has("sacrifice") || tags.some((t) => t.event === "sacrifice" || t.event === "dies")) adjust("sacrificeOutlets", 3, 0.35, "Death and sacrifice payoffs need reliable sacrifice outlets.");
  if (has("lands") || tags.some((t) => t.objects.includes("Land"))) {
    adjust("lands", 2, 0.1, "A lands plan wants extra land drops.");
    adjust("ramp", 0, 0.2, "Land-based ramp also triggers land payoffs.");
  }
  if (functions.some((f) => f.engines.wantsDiscard) || has("discard")) adjust("controlledDiscard", 6, 0.6, "Mayhem / Madness / discard payoffs need controlled discard outlets.");
  if (supportedTypes.length) adjust("finishers", 0, 0.05, `${supportedTypes.join(" / ")} creatures carry the plan; type matters, quality still decides inclusion.`);
  const plan = [
    ...mechanics.slice(0, 4).map((m) => m.label),
    ...Object.entries(needs).filter(([, n]) => n.reasons.length > 1).map(([need, n]) => `${needLabels[need as Need]}: ${n.reasons.at(-1)}`),
  ];
  return {
    version: BLUEPRINT_VERSION,
    commanders: commanders.map((c) => c.card.name),
    manaValue: mv,
    colorIdentity: [...new Set(commanders.flatMap((c) => c.card.colorIdentity))].sort(),
    mechanics: mechanics.filter((m, i, all) => all.findIndex((o) => o.id === m.id) === i),
    supportedTypes,
    tokenTypes,
    features,
    needs,
    plan,
    profile,
  };
}
