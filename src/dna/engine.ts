import { RANKING_VERSION } from "../synergy/deckSpecific";
import { buildDeckStrategyProfile } from "./strategy";
import { scoreRecommendation } from "../synergy/recommendation";
import type { RecommendationData } from "../synergy/recommendation";
import type {
  DeckStrategyProfile,
  SynergyScoreDebug,
  StrategyScore,
} from "./strategy";
import type { CardMetadata, CollectionState } from "../models/collection";
import type { Deck } from "../models/deck";
import type { Assignment, AutoAnalysis, Evidence } from "../intelligence/types";
import { RULESET_VERSION } from "../intelligence/types";
import { effectiveAssignments, inputFingerprint } from "../intelligence/tagger";
import { tagDefinition } from "../intelligence/taxonomy";
import { stripReminderText } from "../utils/rulesText";
import { pluralCreatureType } from "../intelligence/subtypes";
import { deckCardAnalysis } from "../intelligence/canonicalAnalysis";
import { cardKeywords } from "../utils/cardKeywords";
import { extractCardFacts } from "../synergy/facts";
import { DNA_VERSION, families, tagFamily } from "./families";
export interface DnaInputCard {
  identity: string;
  card: CardMetadata;
  quantity: number;
  commander: boolean;
  analysis: AutoAnalysis;
  assignments: Assignment[];
}
export interface DnaInput {
  deckId: string;
  revision: string;
  cards: DnaInputCard[];
}
export interface Signal {
  themeId: string;
  tagId: string;
  label: string;
  strength: number;
  kind: "payoff" | "enabler" | "support" | "characteristic";
  evidence: Evidence[];
}
export interface CardSynergy {
  recommendation?: RecommendationData;
  debug: SynergyScoreDebug;
  reasons: string[];
  conflicts: string[];
  tier: "Recommended" | "Worth Considering" | "Other Legal Cards";
  identity: string;
  name: string;
  score: number;
  band: string;
  connections: {
    themeId: string;
    label: string;
    strength: number;
    signals: Signal[];
  }[];
  commanderConnections: { name: string; theme: string; evidence: Evidence[] }[];
  roles: string[];
  roleEvidence: { label: string; evidence: Evidence[] }[];
  components: { label: string; points: number }[];
  explanation: string;
}
export interface DnaTheme {
  id: string;
  label: string;
  percent: number;
  weight: number;
  deckWeight: number;
  commanderWeight: number;
  contributors: string[];
  subthemes: { id: string; label: string; cards: number }[];
  evidence: { name: string; commander: boolean; signals: Signal[] }[];
}
export interface DeckDna {
  strategyProfile: DeckStrategyProfile;
  version: string;
  rulesetVersion: string;
  revision: string;
  themes: DnaTheme[];
  cards: Record<string, CardSynergy>;
  byName: Record<string, string>;
  summary: string;
  core: { primary: string[]; support: string[]; payoff: string };
  central: { identity: string; name: string; score: number }[];
  warnings: string[];
}
const nameKey = (name: string) => name.normalize("NFKC").trim().toLowerCase();
const compare = (a: string, b: string) => a.localeCompare(b, "en");
// Canonical grouping is independent of collection quantities, assignment state and printing order.
export function deckDnaInput(state: CollectionState, deck: Deck): DnaInput {
  const oracleByName = new Map(
    Object.values(state.metadata)
      .filter((c) => c.oracleId)
      .map((c) => [nameKey(c.name), c.oracleId!]),
  );
  const rows = [
    ...deck.commanders.map((c) => ({
      id: c.scryfallId,
      quantity: 1,
      commander: true,
    })),
    ...(deck.entries
      ? deck.entries
          .filter((e) => e.board === "main")
          .map((e) => ({
            id: e.scryfallId,
            quantity: e.quantity,
            commander: false,
          }))
      : deck.assignments.map((a) => ({
          id: state.items.find((i) => i.id === a.itemId)!.scryfallId,
          quantity: a.quantity,
          commander: false,
        }))),
  ];
  const groups = new Map<
    string,
    { card: CardMetadata; quantity: number; commander: boolean }
  >();
  for (const row of rows) {
    const card = state.metadata[row.id];
    if (!card) continue;
    const identity =
      card.oracleId ||
      oracleByName.get(nameKey(card.name)) ||
      `name:${nameKey(card.name)}`;
    const key = `${identity}:${row.commander}`;
    const previous = groups.get(key);
    // Prefer the most complete metadata, then stable printing ID; never depend on ownership.
    const completeness = (c: CardMetadata) =>
      (c.oracleText?.length || 0) +
      (c.cardFaces?.length || 0) * 100 +
      (c.keywords?.length || 0) * 10;
    const preferred =
      !previous ||
      completeness(card) > completeness(previous.card) ||
      (completeness(card) === completeness(previous.card) &&
        compare(card.scryfallId, previous.card.scryfallId) < 0)
        ? card
        : previous.card;
    groups.set(key, {
      card: {
        ...preferred,
        oracleId:
          preferred.oracleId || oracleByName.get(nameKey(preferred.name)),
      },
      quantity: (previous?.quantity || 0) + row.quantity,
      commander: row.commander,
    });
  }
  const cards = [...groups.values()]
    .map((g) => {
      const analysis = deckCardAnalysis(state, g.card);
      const assignments = effectiveAssignments(
        analysis,
        state.intelligence?.overrides[analysis.cardIdentity] ||
          state.intelligence?.overrides[`name:${nameKey(g.card.name)}`],
      );
      return { ...g, identity: analysis.cardIdentity, analysis, assignments };
    })
    .sort(
      (a, b) =>
        compare(a.identity, b.identity) ||
        Number(a.commander) - Number(b.commander),
    );
  // Full stable content revision avoids timestamp collisions and ignores pricing/ownership/UI state.
  const revision = JSON.stringify(
    cards.map((c) => [
      c.identity,
      c.commander,
      c.quantity,
      inputFingerprint(c.card),
      c.card.manaValue,
      c.card.manaCost,
      c.card.colorIdentity,
      c.analysis.rulesetVersion,
      c.analysis.creatureTypes,
      c.assignments,
    ]),
  );
  return { deckId: deck.id, revision, cards };
}
const weights = {
  strategy: 3,
  mechanic: 2,
  role: 2,
  resource: 1.8,
  payoff: 4,
  enabler: 3,
  interaction: 1.5,
};
const ATTACK_TAGS = ["attack-triggers", "combat-damage-triggers", "extra-combat", "combat-trick"];
function cardSignals(
  card: DnaInputCard,
  types: Set<string>,
  deckTags: Set<string>,
  attackPlan = true,
): Signal[] {
  const signals: Signal[] = [];
  // Typed discard: only discard you control enables Mayhem/Madness/discard payoffs; opponent discard never does.
  if (["mayhem", "madness", "discard-payoff"].some((id) => deckTags.has(id))) {
    const own = extractCardFacts(card.card)
      .faces.flatMap((face) => face.discards)
      .filter((d) => d.who === "you" || d.who === "each_player");
    if (own.length)
      signals.push({
        themeId: "discard",
        tagId: "controlled-discard",
        label: own.some((d) => d.mode === "loot" || d.mode === "rummage")
          ? "Looting / Rummaging"
          : "Controlled Discard",
        strength: 3,
        kind: "enabler",
        evidence: own.map((d) => ({
          field: "oracleText",
          snippet: d.text.slice(0, 180),
          reason: `You choose to discard (${d.mode}), so cards with Mayhem or Madness can be cast and discard payoffs trigger.`,
        })),
      });
  }
  // A card that rewards opponents losing life (e.g. "Whenever an opponent loses life …") is a pings payoff.
  {
    const reward = stripReminderText(card.card.oracleText || card.card.cardFaces?.map((f) => f.oracleText || "").join("\n") || "").split(/[.\n]/).find(clause =>
      /\bwhenever (?:an? |each )?(?:opponents?|player) (?:loses?|lost) life\b|\bwhenever (?:an? )?(?:opponents?|player) (?:is|are) dealt damage\b|\bif an? opponent would lose life\b[^.\n]*\b(?:twice|double)\b/i.test(clause),
    );
    if (reward)
      signals.push({
        themeId: "pings",
        tagId: "life-loss-payoff",
        label: "Opponent Life Loss Payoff",
        strength: 3,
        kind: "payoff",
        evidence: [{ field: "oracleText", snippet: reward.trim().slice(0, 180), reason: "Rewards opponents losing life, so every ping, drain or punisher effect feeds it." }],
      });
  }
  for (const assignment of card.assignments) {
    const definition = tagDefinition(assignment.tagId);
    if (!definition) continue;
    const themeId = assignment.tagId.startsWith("typal:")
      ? assignment.tagId
      : tagFamily.get(assignment.tagId);
    if (!themeId) continue;
    // Resources/costs are not proof of a particular strategy without its actual context.
    if (
      assignment.tagId === "discard-outlet" &&
      !["graveyard", "self-mill", "recursion", "reanimator"].some((id) =>
        deckTags.has(id),
      )
    )
      continue;
    if (
      assignment.tagId === "drain" &&
      ![
        "aristocrats",
        "death-triggers",
        "sacrifice-outlet",
        "sacrifice-payoff",
      ].some((id) => deckTags.has(id))
    )
      continue;
    const typalEnabler =
      assignment.tagId.startsWith("typal:") &&
      card.assignments.some(
        (a) => a.tagId === "cost-reduction" || a.tagId === "tutor",
      );
    const kind = typalEnabler
      ? "enabler"
      : definition.category === "payoff" ||
          assignment.tagId.startsWith("typal:") ||
          ["aristocrats", "reanimator"].includes(assignment.tagId)
        ? "payoff"
        : definition.category === "enabler" ||
            ["cost-reduction", "plus-counters", "minus-counters"].includes(
              assignment.tagId,
            )
          ? "enabler"
          : "support";
    let strength = assignment.tagId.startsWith("typal:")
      ? 4
      : ["aristocrats", "reanimator"].includes(assignment.tagId)
        ? 3.5
        : weights[definition.category];
    if (
      assignment.tagId === "plus-counters" ||
      assignment.tagId === "minus-counters"
    )
      strength = 2;
    signals.push({
      themeId,
      tagId: assignment.tagId,
      label: definition.label,
      strength: strength * assignment.confidence,
      kind,
      evidence: assignment.evidence,
    });
  }
  for (const type of card.analysis.creatureTypes.own.filter((t) =>
    types.has(t),
  )) {
    signals.push({
      themeId: `typal:${type}`,
      tagId: `type:${type}`,
      label: `${type} creature`,
      strength: 0.35,
      kind: "characteristic",
      evidence: [
        {
          field: "typeLine",
          snippet: card.card.typeLine,
          reason: `Has the ${type} creature subtype; weaker evidence than an explicit payoff.`,
        },
      ],
    });
  }
  // Named combat keywords are weak characteristics, not proof of a combat win condition.
  const combat = cardKeywords(card.card).filter((k) =>
    [
      "flying",
      "trample",
      "haste",
      "double strike",
      "first strike",
      "menace",
    ].includes(k.toLowerCase()),
  );
  // Only when the deck repeatedly rewards attacking: fliers in a reanimator deck are not a combat plan.
  if (combat.length && attackPlan)
    signals.push({
      themeId: "combat",
      tagId: "keyword:combat",
      label: combat.join(" · "),
      strength: 0.6,
      kind: "characteristic",
      evidence: [
        {
          field: "keywords",
          snippet: combat.join(", "),
          reason:
            "Combat keywords provide weak support; no win condition is inferred.",
        },
      ],
    });
  return signals;
}
const signalWeight = (signals: Signal[]) => {
  const ordered = signals.map((s) => s.strength).sort((a, b) => b - a);
  return ordered.length
    ? ordered[0] +
        Math.min(
          1.2,
          ordered.slice(1).reduce((n, v) => n + v * 0.2, 0),
        )
    : 0;
};
const cardFitCache = new WeakMap<StrategyScore, CardSynergy>();
function scoreCard(
  c: DnaInputCard,
  ownSignals: Signal[],
  meaningful: DnaTheme[],
  commanders: { card: DnaInputCard; signals: Signal[] }[],
  profile: DeckStrategyProfile,
): CardSynergy {
  const scored = scoreRecommendation(profile, c);
  const cached = cardFitCache.get(scored);
  if (cached) return cached;
  const connections = meaningful
    .flatMap((theme) => {
      const matched = ownSignals.filter((s) => s.themeId === theme.id);
      if (!matched.length) return [];
      const typalSupport =
        theme.id.startsWith("typal:") &&
        theme.evidence.some((e) =>
          e.signals.some((s) => s.kind === "payoff" || s.kind === "enabler"),
        );
      const strength =
        typalSupport && matched.some((s) => s.kind === "characteristic")
          ? Math.max(2.8, signalWeight(matched))
          : signalWeight(matched);
      return [
        { themeId: theme.id, label: theme.label, strength, signals: matched },
      ];
    })
    .sort((a, b) => b.strength - a.strength || compare(a.themeId, b.themeId));
  const commanderConnections = commanders.flatMap(
    ({ card: cmdr, signals: commanderSignals }) =>
      connections.flatMap((connection) => {
        const matched = commanderSignals.filter(
          (s) => s.themeId === connection.themeId && s.strength >= 2,
        );
        return matched.length
          ? [
              {
                name: cmdr.card.name,
                theme: connection.label,
                evidence: matched.flatMap((s) => s.evidence),
              },
            ]
          : [];
      }),
  );
  const roleAssignments = c.assignments
    .filter((a) =>
      ["role", "payoff", "enabler", "interaction"].includes(
        tagDefinition(a.tagId)?.category || "",
      ),
    )
    .sort(
      (a, b) =>
        weights[tagDefinition(b.tagId)!.category] -
          weights[tagDefinition(a.tagId)!.category] ||
        compare(a.tagId, b.tagId),
    );
  const roles = roleAssignments.map((a) => tagDefinition(a.tagId)!.label);
  if (
    connections.some((con) => con.themeId === "ramp") &&
    c.card.manaValue <= 2 &&
    !/\bLand\b/.test(c.card.typeLine)
  )
    roles.push(`Early mana support (mana value ${c.card.manaValue})`);
  const roleEvidence = roleAssignments.map((a) => ({
    label: tagDefinition(a.tagId)!.label,
    evidence: a.evidence,
  }));
  const result: CardSynergy = {
    identity: c.identity,
    name: c.card.name,
    score: scored.score,
    band: scored.band,
    debug: scored.debug,
    recommendation: scored.recommendation,
    reasons: scored.reasons,
    conflicts: scored.conflicts,
    tier: scored.tier,
    connections,
    commanderConnections,
    roles: scored.recommendation ? scored.roles : [...new Set([...roles, ...scored.roles])],
    roleEvidence,
    components: scored.components,
    explanation: scored.explanation,
  };
  cardFitCache.set(scored, result);
  return result;
}

/** Repeated attack payoffs in the 99 (or an attacking Commander): the evidence a combat plan needs. */
function attackPlanOf(cards: DnaInputCard[]) {
  const main = cards.filter((c) => !c.commander);
  const payoffs = main.filter((c) => c.assignments.some((a) => ATTACK_TAGS.includes(a.tagId))).length;
  return payoffs >= Math.max(3, Math.ceil(main.length * 0.04)) || cards.some((c) => c.commander && c.assignments.some((a) => ATTACK_TAGS.includes(a.tagId)));
}
function deckSignals(cards: DnaInputCard[]) {
  const typeCounts = new Map<string, number>();
  for (const c of cards)
    for (const type of c.analysis.creatureTypes.own)
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
  const types = new Set(
    [...typeCounts].filter(([, n]) => n >= 3).map(([type]) => type),
  );
  for (const c of cards)
    for (const a of c.assignments)
      if (a.tagId.startsWith("typal:")) types.add(a.tagId.slice(6));
  const deckTags = new Set(
    cards.flatMap((c) => c.assignments.map((a) => a.tagId)),
  );
  const attackPlan = attackPlanOf(cards);
  const signals = new Map(
    cards.map((c) => [c, cardSignals(c, types, deckTags, attackPlan)]),
  );
  return { types, deckTags, signals, attackPlan };
}
export function analyzeDeckDna(input: DnaInput): DeckDna {
  const { cards } = input;
  const { types, signals } = deckSignals(cards);
  const repetitionFloor = Math.max(
    2,
    Math.ceil(cards.filter((c) => !c.commander).length * 0.06),
  );
  const familyById = new Map(families.map((f) => [f.id, f]));
  for (const type of types)
    familyById.set(`typal:${type}`, {
      id: `typal:${type}`,
      label: `${pluralCreatureType(type)} Matter`,
      tags: [`typal:${type}`],
      plan: `support ${type} creatures and their type-based interactions`,
    });
  const themes: DnaTheme[] = [];
  for (const family of familyById.values()) {
    const evidence = cards
      .map((c) => ({
        card: c,
        signals: signals.get(c)!.filter((s) => s.themeId === family.id),
      }))
      .filter((c) => c.signals.length);
    const main = evidence.filter((c) => !c.card.commander),
      commanders = evidence.filter((c) => c.card.commander);
    const normalWeight = main.reduce(
      (n, c) =>
        n +
        signalWeight(c.signals) *
          (1 + Math.log2(Math.min(c.card.quantity, 4)) * 0.35),
      0,
    );
    const commanderRaw = commanders.reduce(
      (n, c) => n + signalWeight(c.signals) * 2.5,
      0,
    );
    // Require repeated non-commander support; a commander can reinforce, never invent the 99's plan.
    const supported =
      main.length >= repetitionFloor ||
      (main.length >= Math.max(1, repetitionFloor - 1) &&
        normalWeight >= 2 &&
        commanders.some((c) => c.signals.some((s) => s.strength >= 2)));
    if (!supported || normalWeight < 1) continue;
    const commanderWeight = Math.min(commanderRaw, normalWeight * 0.45);
    const deckWeight =
      normalWeight * (1 + Math.min(0.6, Math.log2(main.length + 1) / 6));
    const subthemes = [
      ...new Set(evidence.flatMap((c) => c.signals.map((s) => s.tagId))),
    ]
      .sort(compare)
      .map((id) => ({
        id,
        label: evidence.flatMap((c) => c.signals).find((s) => s.tagId === id)!
          .label,
        cards: evidence.filter((c) => c.signals.some((s) => s.tagId === id))
          .length,
      }));
    themes.push({
      id: family.id,
      label: family.label,
      percent: 0,
      weight: deckWeight + commanderWeight,
      deckWeight,
      commanderWeight,
      contributors: main.map((c) => c.card.identity).sort(compare),
      subthemes,
      evidence: evidence
        .map((c) => ({
          name: c.card.card.name,
          commander: c.card.commander,
          signals: c.signals,
        }))
        .sort((a, b) => compare(a.name, b.name)),
    });
  }
  themes.sort((a, b) => b.weight - a.weight || compare(a.id, b.id));
  const meaningful = themes
    .filter((t) => t.weight >= Math.max(2, (themes[0]?.weight || 0) * 0.1))
    .slice(0, 7);
  const total = meaningful.reduce((n, t) => n + t.weight, 0);
  const fractions = meaningful.map((t) => {
    const exact = (t.weight / total) * 100;
    t.percent = Math.floor(exact);
    return { theme: t, fraction: exact - t.percent };
  });
  let remainder = 100 - meaningful.reduce((n, t) => n + t.percent, 0);
  for (const f of [...fractions].sort(
    (a, b) => b.fraction - a.fraction || compare(a.theme.id, b.theme.id),
  ))
    if (remainder-- > 0) f.theme.percent++;
  const strategyProfile = buildDeckStrategyProfile(input);
  const perCard: Record<string, CardSynergy> = {},
    byName: Record<string, string> = {};
  for (const c of cards.filter((c) => !c.commander)) {
    const ownSignals = signals.get(c)!;
    perCard[c.identity] = scoreCard(
      c,
      ownSignals,
      meaningful,
      cards
        .filter((card) => card.commander)
        .map((card) => ({ card, signals: signals.get(card)! })),
      strategyProfile,
    );
    byName[nameKey(c.card.name)] = c.identity;
  }
  const strategic = meaningful.filter((t) => !familyById.get(t.id)?.support),
    supporting = meaningful.filter((t) => familyById.get(t.id)?.support);
  const primary = strategic.slice(0, 2);
  const plan = primary.map((t) => {
    const tags = new Set(t.subthemes.map((s) => s.id));
    if (t.id === "graveyard")
      return [
        tags.has("self-mill")
          ? "fill the graveyard"
          : "use graveyard resources",
        tags.has("reanimator")
          ? "return creatures from graveyards to the battlefield"
          : tags.has("recursion")
            ? "recover graveyard cards"
            : "",
      ]
        .filter(Boolean)
        .join(" and ");
    if (t.id === "sacrifice")
      return tags.has("sacrifice-outlet") || tags.has("sacrifice-payoff")
        ? "use sacrifice and creature-death effects"
        : "use the recorded creature-death effects";
    if (t.id === "tokens")
      return tags.has("tokens")
        ? "create and support creature tokens"
        : "support a wide creature board";
    if (
      t.id === "combat" &&
      t.subthemes.every((s) => s.id === "keyword:combat")
    )
      return "support creatures with combat keywords";
    if (t.id.startsWith("typal:") && !tags.has(t.id))
      return `field ${t.id.slice(6)} creatures`;
    return familyById.get(t.id)!.plan;
  });
  const reinforced = meaningful
    .filter(
      (t) =>
        t.commanderWeight > 0 &&
        t.evidence.some(
          (e) => e.commander && e.signals.some((s) => s.strength >= 2),
        ),
    )
    .slice(0, 2);
  let summary = plan.length
    ? `This deck is built to ${plan.join(" and ")}.`
    : supporting.length
      ? `The clearest repeated signals are supporting roles: ${supporting.map((t) => t.label).join(" and ")}. A focused strategic plan is not established by the saved evidence.`
      : "There is not enough repeated strategic evidence to describe a focused plan yet.";
  if (reinforced.length && primary.length)
    summary += ` ${cards
      .filter((c) => c.commander)
      .map((c) => c.card.name)
      .join(
        " and ",
      )} reinforces ${reinforced.map((t) => t.label).join(" and ")} through its recorded abilities.`;
  // Strategic centrality, separate from general deck fit: primary-theme payoffs/enablers, verified Commander
  // relationships and how many verified relationships a card has with the rest of the deck. A generically efficient
  // card with no primary-theme or Commander connection never becomes a key card, whatever its fit score.
  const primaryIds = new Set(primary.map((t) => t.id));
  const centrality = Object.values(perCard)
    .filter((c) => !cards.find((card) => card.identity === c.identity)?.commander)
    .map((c) => {
      const themed = c.connections.filter((con) => primaryIds.has(con.themeId));
      const primaryStrength = themed.reduce((n, con) => n + con.strength, 0);
      const keySignal = themed.some((con) => con.signals.some((sig) => sig.kind === "payoff" || sig.kind === "enabler"));
      const links = c.recommendation?.links || [];
      const commanderLink = Math.max(0, ...links.filter((l) => l.commander).map((l) => l.strength));
      const engine = links.filter((l) => !l.commander).reduce((n, l) => n + l.strength, 0);
      const strategic = primaryStrength > 0 && (keySignal || commanderLink >= 0.5 || engine >= 1);
      return { c, strategic, value: 2 * Math.min(primaryStrength, 4) + 4 * commanderLink + 1.2 * Math.min(engine, 5) + c.score / 100 };
    })
    .filter((x) => x.strategic)
    .sort((a, b) => b.value - a.value || compare(a.c.name, b.c.name));
  // Core Plan payoff: an explicit payoff signal when one exists; otherwise a typed mechanical relationship, such as a
  // Commander trigger that rewards the primary theme's cards and is verified against several of them.
  const signalPayoff = primary.flatMap((t) =>
    t.evidence.flatMap((e) =>
      e.signals
        .filter((s) => s.kind === "payoff")
        .map((s) => `${s.label} via ${e.name}`),
    ),
  )[0];
  const relationshipPayoff = (() => {
    for (const theme of primary) {
      const rewarded = centrality.filter(
        (x) =>
          x.c.connections.some((con) => con.themeId === theme.id) &&
          (x.c.recommendation?.links || []).some((l) => l.commander && l.strength >= 0.8),
      );
      const commander = cards.find((card) => card.commander);
      const tag = strategyProfile.commanderSynergyTags.find((t) => t.controller !== "opponent" && !t.selfOnly && (t.objects.length || t.creatureTypes.length));
      if (rewarded.length >= 2 && commander && tag)
      {
        // Quote the Commander's whole ability line, so the reward (e.g. "draw a card") is visible, not only the trigger.
        const start = tag.evidence.snippet.trim().slice(0, 40).toLowerCase();
        const ability =
          (commander.card.oracleText || "").split("\n").find((line) => line.toLowerCase().includes(start)) || tag.evidence.snippet;
        return `${theme.label} payoff via ${commander.card.name}: ${ability.replace(/\s+/g, " ").trim().slice(0, 180)}`;
      }
      const engine = centrality.find((x) => x.c.connections.some((con) => con.themeId === theme.id) && (x.c.recommendation?.links || []).filter((l) => !l.commander).length >= 3);
      if (engine) return `${theme.label} payoff via ${engine.c.name}: connects ${(engine.c.recommendation?.links || []).filter((l) => !l.commander).length} cards in this deck`;
    }
    return undefined;
  })();
  const payoff = signalPayoff || relationshipPayoff || "No explicit primary payoff identified.";
  return {
    strategyProfile,
    version: DNA_VERSION,
    rulesetVersion: RULESET_VERSION,
    revision: input.revision,
    themes: meaningful,
    cards: perCard,
    byName,
    summary,
    core: {
      primary: primary.map((t) => t.label),
      support: [...supporting, ...strategic.filter((t) => !primary.includes(t))]
        .slice(0, 3)
        .map((t) => t.label),
      payoff,
    },
    central: centrality.slice(0, 3).map(({ c: { identity, name, score } }) => ({ identity, name, score })),
    warnings: [
      ...(meaningful.length < 4
        ? [
            "Fewer than four supported themes were found; incidental signals are not used to pad the result.",
          ]
        : []),
      ...(cards.some(
        (c) =>
          !c.card.oracleText && !c.card.cardFaces?.some((f) => f.oracleText),
      )
        ? [
            "Some saved metadata lacks Oracle text; explanations may be incomplete.",
          ]
        : []),
    ],
  };
}
export const cardSynergy = (
  dna: DeckDna,
  card: Pick<CardMetadata, "name" | "oracleId">,
) =>
  dna.cards[card.oracleId || `name:${nameKey(card.name)}`] ||
  dna.cards[dna.byName[nameKey(card.name)]];
export class DeckDnaCache {
  private entries = new Map<string, DeckDna>();
  constructor(private compute = analyzeDeckDna) {}
  get(state: CollectionState, deck: Deck, version = RULESET_VERSION, scoringVersion = RANKING_VERSION) {
    const start = performance.now();
    const input = deckDnaInput(state, deck);
    const key = JSON.stringify([
      input.deckId,
      input.revision,
      DNA_VERSION,
      version,
      scoringVersion,
    ]);
    const cached = this.entries.get(key);
    if (cached) return cached;
    const value = this.compute(input);
    performance.measure("mtg:deck-dna", { start, end: performance.now() });
    this.entries.set(key, value);
    if (this.entries.size > 64)
      this.entries.delete(this.entries.keys().next().value!);
    return value;
  }
}
export const deckDnaCache = new DeckDnaCache();

// Candidates are measured against the unchanged saved deck, never inserted into its DNA.
export function candidateScorer(
  state: CollectionState,
  deck: Deck,
  dna: DeckDna,
) {
  const { cards } = deckDnaInput(state, deck);
  const { types, deckTags, signals, attackPlan } = deckSignals(cards);
  const commanders = cards
    .filter((c) => c.commander)
    .map((card) => ({ card, signals: signals.get(card)! }));
  return (card: CardMetadata): CardSynergy => {
    const analysis = deckCardAnalysis(state, card);
    const assignments = effectiveAssignments(
      analysis,
      state.intelligence?.overrides[analysis.cardIdentity] ||
        state.intelligence?.overrides[`name:${nameKey(card.name)}`],
    );
    const input = {
      card,
      analysis,
      assignments,
      identity: analysis.cardIdentity,
      quantity: 1,
      commander: false,
    };
    return scoreCard(
      input,
      cardSignals(input, types, deckTags, attackPlan),
      dna.themes,
      commanders,
      dna.strategyProfile,
    );
  };
}
