import { stripReminderText } from "../utils/rulesText";
import type { DnaInputCard } from "../dna/engine";
import type {
  CommanderSynergyTag,
  DeckStrategyProfile,
  Role,
  RoleNeed,
  StrategyScore,
} from "../dna/strategy";
import { mechanicalRelationships } from "../dna/strategy";
import { extractCardFacts, hasCreatureType } from "./facts";
import type { CardFacts, TypedRole } from "./facts";

export const RECOMMENDATION_VERSION = "0.6.3";
// Calibrated from the proposed starting weights: needed, efficient interaction
// must be able to reach Worth Considering without invented tribal synergy.
export const SCORE_WEIGHTS = Object.freeze({
  commander: 0.2,
  theme: 0.2,
  roleNeed: 0.25,
  efficiency: 0.2,
  curve: 0.1,
  deckInteractions: 0.05,
});
export const RECOMMENDATION_LIMITS = Object.freeze({
  profiles: 4,
  cards: 10000,
  excellent: 80,
  excellentCap: 79,
  materialSwapDelta: 8,
});
export type Confidence = "High" | "Medium" | "Low";
export interface RecommendationEvidence {
  positives: string[];
  negatives: string[];
  commanderEvidence: string[];
  roleEvidence: string[];
  penalties: string[];
}
export interface RecommendationData {
  facts: CardFacts;
  confidence: Confidence;
  confidenceReasons: string[];
  commander: { score: number; direct: boolean; evidence: string[] };
  evidence: RecommendationEvidence;
  matchedThemes: string[];
  typedRoles: TypedRole[];
  gate: { excellentEligible: boolean; reasons: string[] };
  componentCaps: number[];
  roleNeedSeverity: number;
  efficiency: number;
}
interface TypedDeckProfile {
  facts: Map<string, CardFacts>;
  roles: Map<string, Partial<Record<Role, number>>>;
  roleNeeds: Record<Role, RoleNeed>;
  supportedTypes: string[];
  tokenTypePriorities: Record<string, number>;
  meaningfulTokenSources: number;
  genericTokenEngine: boolean;
  effects: Map<string, number>;
  weakAreas: string[];
  saturatedAreas: string[];
}
const inputFacts = new WeakMap<DnaInputCard, CardFacts>();
const factCache = new Map<string, CardFacts>();
const profiles = new Map<
  DeckStrategyProfile,
  { typed: TypedDeckProfile; scores: Map<string, StrategyScore> }
>();
const textOf = (input: DnaInputCard) =>
  stripReminderText(
    (input.card.cardFaces?.length
      ? input.card.cardFaces.map((f) => f.oracleText || "").join("\n")
      : input.card.oracleText || ""
    ).replace(/[’‘]/g, "'"),
  );
const keyOf = (input: DnaInputCard) =>
  JSON.stringify([
    input.identity,
    input.card.name,
    input.card.manaValue,
    input.card.manaCost,
    input.card.typeLine,
    input.card.oracleText,
    input.card.keywords,
    input.card.cardFaces,
    input.card.power,
    input.card.toughness,
    input.card.colors,
    input.card.colorIdentity,
    input.assignments,
  ]);
function factsOf(input: DnaInputCard) {
  const known = inputFacts.get(input);
  if (known) return known;
  const key = JSON.stringify([
    input.card.name,
    input.card.manaValue,
    input.card.typeLine,
    input.card.oracleText,
    input.card.keywords,
    input.card.cardFaces,
    input.card.colors,
    input.card.colorIdentity,
  ]);
  let facts = factCache.get(key);
  if (!facts) {
    facts = extractCardFacts(input.card);
    factCache.set(key, facts);
    if (factCache.size > RECOMMENDATION_LIMITS.cards)
      factCache.delete(factCache.keys().next().value!);
  }
  inputFacts.set(input, facts);
  return facts;
}
const has = (facts: CardFacts, role: TypedRole) =>
  facts.typedRoles.includes(role);
const ownFace = (facts: CardFacts, type: string) =>
  facts.faces.some((f) => f.cardTypes.includes(type));
function actualRoles(
  input: DnaInputCard,
  facts: CardFacts,
): Partial<Record<Role, number>> {
  const roles: Partial<Record<Role, number>> = {},
    text = textOf(input);
  if (ownFace(facts, "Land")) roles.lands = 1;
  const own = (effect: { controller: string }) =>
    effect.controller !== "opponent";
  const landRamp =
    facts.faces.some((face) =>
      face.searchesLibrary.some(
        (s) =>
          own(s) &&
          s.targetTypes.includes("Land") &&
          s.destination === "battlefield",
      ),
    ) || /you may play (?:an|one|two|\d+) additional land/i.test(text);
  const activatedMana = facts.faces.some((face) =>
    face.addsMana.some(
      (mana) =>
        own(mana) && mana.scope === "card" && mana.timing === "activated",
    ),
  );
  if (
    landRamp ||
    activatedMana ||
    facts.faces.some((face) => face.costReductions.some(own))
  )
    roles.ramp = 1;
  else if (
    facts.faces.some((face) =>
      face.createsTokens.some(
        (token) => own(token) && token.tokenTypes.includes("Treasure"),
      ),
    )
  )
    roles.ramp = 0.7;
  else if (
    facts.faces.some((face) =>
      face.addsMana.some(
        (mana) => own(mana) && mana.scope === "card" && mana.timing === "spell",
      ),
    )
  )
    roles.ramp = 0.3;
  else if (
    facts.faces.some((face) =>
      face.addsMana.some((mana) => own(mana) && mana.scope === "created-token"),
    )
  )
    roles.ramp = 0.15;
  if (
    facts.faces.some((face) => face.cardDrawEffects.some(own)) ||
    /exile the top[^.\n]*\b(?:play|cast)|(?:play|cast)[^.\n]*exiled card/i.test(
      text,
    )
  )
    roles.cardAdvantage = 1;
  if (
    facts.faces.some((f) =>
      f.removal.some(
        (r) => r.controller !== "opponent" && !/graveyard/i.test(r.text),
      ),
    ) ||
    /\bcounter target (?:noncreature |creature )?spell/i.test(text)
  )
    roles.removal = 1;
  if (
    /\b(?:destroy|exile) all (?:creatures|artifacts|nonland permanents)|deals?[^.\n]*damage to (?:each|all) (?:creature|permanent)/i.test(
      text,
    )
  ) {
    roles.boardWipes = 1;
    delete roles.removal;
  }
  if (
    /\b(?:target|you control)[^.\n]*\b(?:hexproof|indestructible|protection from)|equipped creature has[^.]*hexproof|counter target spell that targets/i.test(
      text,
    )
  )
    roles.protection = 1;
  if (
    /exile[^.\n]*\b(?:cards? from|target player's) (?:a |an opponent's |your |)graveyard/i.test(
      text,
    )
  )
    roles.graveyardHate = 1;
  if (
    facts.faces.some((f) =>
      f.searchesLibrary.some(
        (s) =>
          s.roles.some((r) => !/^(?:basic_land|land_tutor)/.test(r)) &&
          s.controller !== "opponent",
      ),
    )
  )
    roles.tutors = 1;
  if (
    /return[^.\n]*from (?:your|a) graveyard[^.\n]*(?:hand|battlefield)/i.test(
      text,
    )
  )
    roles.recursion = 1;
  if (
    /add[^.\n]*any color|mana of any color/i.test(text) &&
    !ownFace(facts, "Instant") &&
    !ownFace(facts, "Sorcery")
  )
    roles.manaFixing = 1;
  if (
    facts.faces.some((f) =>
      f.createsTokens.some((t) => t.controller !== "opponent"),
    )
  )
    roles.tokenGeneration = 1;
  if (
    /sacrifice (?:another |a |an? |any number of )?(?:creature|artifact|permanent)[^:]*:/i.test(
      text,
    )
  )
    roles.sacrificeOutlet = 1;
  if (
    facts.faces.some((f) =>
      f.triggers.some(
        (t) =>
          !/^When (?:this|~)/i.test(t) && /whenever|at the beginning/i.test(t),
      ),
    )
  )
    roles.payoff = 1;
  if (
    roles.ramp ||
    roles.sacrificeOutlet ||
    /additional time|twice|double|proliferate/i.test(text)
  )
    roles.enabler = 1;
  if (
    ownFace(facts, "Creature") &&
    input.card.manaValue >= 5 &&
    /flying|trample|double strike/i.test((input.card.keywords || []).join(" "))
  )
    roles.finishers = 1;
  return roles;
}
function buildTypedProfile(profile: DeckStrategyProfile): TypedDeckProfile {
  const start = performance.now(),
    facts = new Map<string, CardFacts>(),
    roles = new Map<string, Partial<Record<Role, number>>>();
  const supportedTypes = [
    ...new Set(
      profile.commanderSynergyTags
        .filter((r) => r.controller !== "opponent")
        .flatMap((r) => r.creatureTypes)
        .concat(
          profile.cards
            .filter((c) => c.card.commander)
            .flatMap((c) =>
              factsOf(c.card).faces.flatMap((f) =>
                f.tribalEffects
                  .filter((e) => e.controller !== "opponent")
                  .flatMap((e) => e.creatureTypes),
              ),
            ),
        ),
    ),
  ];
  if (!supportedTypes.length) {
    const counts = new Map<string, number>();
    for (const card of profile.cards)
      for (const effect of factsOf(card.card)
        .faces.flatMap((f) => f.tribalEffects)
        .filter((e) => e.controller !== "opponent"))
        for (const type of effect.creatureTypes)
          counts.set(type, (counts.get(type) || 0) + card.card.quantity);
    for (const [type, n] of counts) if (n >= 2) supportedTypes.push(type);
  }
  const genericTokenEngine =
    profile.commanderSynergyTags.some(
      (r) =>
        r.controller !== "opponent" &&
        !r.nontoken &&
        !r.creatureTypes.length &&
        !r.requiredKeywords.length &&
        (r.objects.includes("Token") ||
          (r.event === "enters" && r.objects.includes("Creature"))),
    ) ||
    profile.cards.some((c) =>
      c.receivers.some(
        (r) =>
          r.controller !== "opponent" &&
          !r.nontoken &&
          !r.creatureTypes.length &&
          !r.requiredKeywords.length &&
          r.objects.includes("Token"),
      ),
    );
  const tokenTypePriorities: Record<string, number> = Object.fromEntries(
    supportedTypes.map((type) => [type, 1]),
  );
  tokenTypePriorities.generic = genericTokenEngine
    ? 1
    : supportedTypes.length
      ? 0.1
      : 0.4;
  let meaningfulTokenSources = 0;
  const effects = new Map<string, number>();
  const roleNeeds = Object.fromEntries(
    Object.entries(profile.roleNeeds).map(([role, need]) => [
      role,
      { ...need, count: 0 },
    ]),
  ) as Record<Role, RoleNeed>;
  for (const c of profile.cards) {
    const f = factsOf(c.card),
      rs = actualRoles(c.card, f);
    const relevantToken = f.faces.some((face) =>
      face.createsTokens.some(
        (token) =>
          token.controller !== "opponent" &&
          token.creatureTypes.some((type) => supportedTypes.includes(type)),
      ),
    );
    if (supportedTypes.length && !genericTokenEngine && !relevantToken)
      delete rs.tokenGeneration;
    facts.set(c.card.identity, f);
    roles.set(c.card.identity, rs);
    if (!c.card.commander)
      for (const [role, amount] of Object.entries(rs))
        roleNeeds[role as Role].count += amount * c.card.quantity;
    const tokenMatch = f.faces.some((face) =>
      face.createsTokens.some(
        (token) =>
          token.controller !== "opponent" &&
          (genericTokenEngine ||
            token.creatureTypes.some((type) => supportedTypes.includes(type))),
      ),
    );
    if (tokenMatch) {
      const enablers = profile.cards.filter(
        (other) =>
          !other.card.commander &&
          c.receivers.some((r) => verifies(r, other.card)),
      ).length;
      meaningfulTokenSources += c.card.commander
        ? c.receivers.some((r) => r.event === "turn")
          ? 3
          : Math.min(3, enablers || (c.receivers.length ? 0 : 1))
        : c.card.quantity;
    }
    const effectKey = textOf(c.card).split(c.card.card.name).join("~").trim();
    if (effectKey)
      effects.set(effectKey, (effects.get(effectKey) || 0) + c.card.quantity);
  }
  for (const need of Object.values(roleNeeds)) {
    need.deficit =
      need.target > 0 ? Math.max(0, 1 - need.count / need.target) : 0;
    need.need =
      need.deficit >= 0.5
        ? "HIGH"
        : need.deficit > 0.15
          ? "MEDIUM"
          : need.deficit > 0
            ? "LOW"
            : "NONE";
  }
  const typed = {
    facts,
    roles,
    roleNeeds,
    supportedTypes,
    tokenTypePriorities,
    meaningfulTokenSources,
    genericTokenEngine,
    effects,
    weakAreas: Object.entries(roleNeeds)
      .filter(([, n]) => n.need === "HIGH")
      .map(([r]) => r),
    saturatedAreas: Object.entries(roleNeeds)
      .filter(([, n]) => n.target > 0 && n.count > n.target * 1.25)
      .map(([r]) => r),
  };
  performance.measure("mtg:recommendation-profile", {
    start,
    end: performance.now(),
  });
  return typed;
}
function stateFor(profile: DeckStrategyProfile) {
  let state = profiles.get(profile);
  if (!state) {
    state = { typed: buildTypedProfile(profile), scores: new Map() };
    profiles.set(profile, state);
    if (profiles.size > RECOMMENDATION_LIMITS.profiles)
      profiles.delete(profiles.keys().next().value!);
  }
  return state;
}
/** Inspectable derived data; not persisted and independent of physical ownership. */
export function recommendationProfile(profile: DeckStrategyProfile) {
  return stateFor(profile).typed;
}
function verifies(
  receiver: CommanderSynergyTag,
  source: DnaInputCard,
): boolean {
  const f = factsOf(source),
    text = textOf(source);
  if (receiver.controller === "opponent") {
    if (receiver.event === "draw")
      return f.faces.some((face) =>
        face.cardDrawEffects.some(
          (effect) =>
            effect.controller === "opponent" || effect.controller === "any",
        ),
      );
    if (receiver.event === "sacrifice")
      return /(?:target|each) opponent sacrifices? (?:a|one|an?) creature/i.test(
        text,
      );
    if (receiver.event === "enters" && !receiver.nontoken)
      return f.faces.some((face) =>
        face.createsTokens.some(
          (token) =>
            token.controller === "opponent" &&
            (!receiver.creatureTypes.length ||
              token.creatureTypes.some((type) =>
                receiver.creatureTypes.includes(type),
              )),
        ),
      );
    return false;
  }
  if (receiver.event === "counterspell")
    return /\bcounter target[^.]*spell/i.test(text);
  if (receiver.event === "draw")
    return f.faces.some((face) =>
      face.cardDrawEffects.some((effect) => effect.controller !== "opponent"),
    );
  if (receiver.event === "lifegain")
    return /\bgain(?:s)? (?:\d+|x|that much|that many|one|two|three) life/i.test(
      text,
    );
  if (receiver.event === "counters")
    return /\b(?:put|double|proliferate)[^.\n]*(?:counter|\bproliferate\b)|\bproliferate\b/i.test(
      text,
    );
  if (receiver.event === "damage") return /\bdeals?[^.\n]*damage/i.test(text);
  if (receiver.event === "sacrifice") {
    const effects = text
      .split(/[.\n]/)
      .map((line) => line.replace(/^(?:When(?:ever)?|If)\b[^,]*,\s*/i, ""))
      .join(".");
    if (!/\bsacrifice\b/i.test(effects)) return false;
    const creature =
      /sacrifice (?:another |a |an? |any number of )?creature/i.test(effects) ||
      (ownFace(f, "Creature") &&
        effects.includes(`Sacrifice ${source.card.name}`));
    if (receiver.objects.includes("Creature") && !creature) return false;
    if (
      receiver.objects.includes("Artifact") &&
      !/sacrifice[^.]*artifact/i.test(effects) &&
      !ownFace(f, "Artifact")
    )
      return false;
    return true;
  }
  if (receiver.event === "dies")
    return (
      ownFace(f, "Creature") ||
      /\bsacrifice\b/i.test(text) ||
      f.faces.some((face) => face.createsTokens.some((t) => t.isCreature))
    );
  if (receiver.event === "cast") {
    if (receiver.creatureTypes.length)
      return (
        f.faces.some(
          (face) =>
            face.cardTypes.includes("Creature") &&
            receiver.creatureTypes.some((t) => hasCreatureType(face, t)),
        ) && !/\bToken\b/.test(source.card.typeLine)
      );
    return true;
  }
  if (["enters", "attacks", "combat-damage"].includes(receiver.event)) {
    if (receiver.creatureTypes.length) {
      const body = f.faces.some(
        (face) =>
          face.cardTypes.includes("Creature") &&
          receiver.creatureTypes.some((t) => hasCreatureType(face, t)),
      );
      const tokens =
        !receiver.nontoken &&
        receiver.event !== "cast" &&
        f.faces.some((face) =>
          face.createsTokens.some(
            (t) =>
              t.controller !== "opponent" &&
              t.creatureTypes.some((type) =>
                receiver.creatureTypes.includes(type),
              ),
          ),
        );
      return body || tokens;
    }
    if (receiver.objects.includes("Token"))
      return f.faces.some((face) =>
        face.createsTokens.some((token) => token.controller !== "opponent"),
      );
    if (
      receiver.nontoken &&
      !f.faces.some((face) =>
        face.cardTypes.some((t) =>
          [
            "Creature",
            "Artifact",
            "Enchantment",
            "Land",
            "Planeswalker",
          ].includes(t),
        ),
      )
    )
      return has(f, "land_ramp") && receiver.objects.includes("Land");
  }
  return true;
}
const roleLabels: Record<Role, string> = {
  ramp: "Ramp",
  cardAdvantage: "Card advantage",
  removal: "Removal",
  boardWipes: "Board wipes",
  protection: "Protection",
  graveyardHate: "Graveyard hate",
  tutors: "Tutors",
  recursion: "Recursion",
  finishers: "Finishers",
  lands: "Lands",
  manaFixing: "Mana fixing",
  tokenGeneration: "Token generation",
  sacrificeOutlet: "Sacrifice outlets",
  payoff: "Payoffs",
  enabler: "Enablers",
};
export function recommendationBand(score: number) {
  return score >= 90
    ? "Exceptional Fit"
    : score >= 80
      ? "Excellent Fit"
      : score >= 70
        ? "Strong Fit"
        : score >= 60
          ? "Reasonable Fit"
          : score >= 50
            ? "Situational"
            : score >= 35
              ? "Weak Fit"
              : "Poor Fit";
}
export function scoreRecommendation(
  profile: DeckStrategyProfile,
  input: DnaInputCard,
): StrategyScore {
  const state = stateFor(profile),
    key = keyOf(input),
    cached = state.scores.get(key);
  if (cached) return cached;
  const f = factsOf(input),
    typed = state.typed,
    text = textOf(input),
    rs = actualRoles(input, f);
  const relationships = mechanicalRelationships(
    profile,
    input,
    verifies,
    (source) => {
      const facts = factsOf(source),
        sourceText = textOf(source),
        events = new Set<string>();
      const sourceTypes = facts.faces.flatMap((face) => face.creatureTypes);
      for (const face of facts.faces) {
        for (const type of face.cardTypes) events.add(type.toLowerCase());
        for (const type of face.creatureTypes) events.add(`typal:${type}`);
        if (face.cardDrawEffects.length) events.add("draw");
        for (const token of face.createsTokens) {
          events.add("token");
          if (token.isCreature) events.add("creature");
          if (token.tokenTypes.length) events.add("artifact");
          for (const type of token.creatureTypes) events.add(`typal:${type}`);
        }
        if (
          face.searchesLibrary.some(
            (search) =>
              search.targetTypes.includes("Land") &&
              search.destination === "battlefield",
          )
        )
          events.add("land");
      }
      if (
        /you may play (?:an?|one|two|\d+) additional lands?/i.test(sourceText)
      )
        events.add("land");
      if (/Equipment/.test(source.card.typeLine)) events.add("equipment");
      if (/Aura/.test(source.card.typeLine)) events.add("aura");
      if (/counter target[^.]*spell/i.test(sourceText))
        events.add("counterspell");
      if (/\bdeals?[^.]*damage/i.test(sourceText)) events.add("damage");
      if (
        /\bgain(?:s)? (?:\d+|x|that much|that many|one|two|three) life/i.test(
          sourceText,
        )
      )
        events.add("lifegain");
      if (
        /\b(?:put|double|proliferate)[^.\n]*(?:counter|\bproliferate\b)|\bproliferate\b/i.test(
          sourceText,
        )
      )
        events.add("counters");
      const sacrificeOutlet = !!actualRoles(source, facts).sacrificeOutlet;
      if (
        sacrificeOutlet ||
        /(?:additional cost[^.]*|^|:)\s*sacrifice (?:a|another|an?) creature/im.test(
          sourceText,
        )
      ) {
        events.add("sacrifice");
        events.add("dies");
      }
      return {
        events: [...events],
        creatureTypes: sourceTypes,
        changeling: facts.faces.some((face) => face.hasChangeling),
        sacrificeOutlet,
      };
    },
  );
  const addRelationship = (
    other: (typeof profile.cards)[number],
    strength: number,
    detail: string,
  ) => {
    const current = relationships.find(
      (r) => r.identity === other.card.identity,
    );
    if (current) {
      current.strength = Math.max(current.strength, strength);
      current.evidence.push(detail);
    } else
      relationships.push({
        identity: other.card.identity,
        name: other.card.card.name,
        commander: other.card.commander,
        strength,
        evidence: [detail],
      });
  };
  for (const other of profile.cards) {
    if (other.card.identity === input.identity) continue;
    const otherText = textOf(other.card),
      otherFacts = factsOf(other.card);
    const returnsCreature =
      /return[^.\n]*(?:creature|permanent) card[^.\n]*from (?:your|a) graveyard[^.\n]*(?:battlefield|hand)/i;
    if (
      (returnsCreature.test(text) &&
        /\bmill (?:\w+|\d+) cards|discard (?:a|one|two) cards?/i.test(
          otherText,
        )) ||
      (returnsCreature.test(otherText) &&
        /\bmill (?:\w+|\d+) cards|discard (?:a|one|two) cards?/i.test(text))
    )
      addRelationship(
        other,
        0.85,
        `Graveyard setup / return relationship: ${input.card.name} ↔ ${other.card.card.name}; ${text}; ${otherText}`,
      );
    const blink =
      /exile[^.\n]*(?:creature|permanent)[^.\n]*(?:return|then)[^.\n]*battlefield/i;
    const ownEtb = f.faces.some(
      (face) =>
        face.cardTypes.includes("Creature") &&
        face.triggers.some(
          (t) =>
            /^When (?:this creature|this permanent)/i.test(t) ||
            t.startsWith(`When ${face.name} enters`),
        ),
    );
    if (other.card.commander && blink.test(otherText) && ownEtb)
      addRelationship(
        other,
        1,
        `Reusable creature ETB: ${other.card.card.name} can reuse ${input.card.name}'s entry ability: ${text}; ${otherText}`,
      );
    const counterSource =
      /(?:put|enters?)[^.\n]*\+1\/\+1 counter|twice[^.\n]*counters?|counters?[^.\n]*twice/i;
    if (
      (/proliferate/i.test(otherText) && counterSource.test(text)) ||
      (/proliferate/i.test(text) && counterSource.test(otherText))
    )
      addRelationship(
        other,
        0.85,
        `Counter resources / proliferation: ${input.card.name} ↔ ${other.card.card.name}; counters must already exist: ${text}; ${otherText}`,
      );
    if (
      other.card.commander &&
      otherFacts.faces.some((face) =>
        face.costReductions.some(
          (effect) =>
            /artifact|enchantment|instant|sorcery/i.test(effect.text) &&
            f.faces.some((own) =>
              own.cardTypes.some((type) =>
                new RegExp(`\\b${type}\\b`, "i").test(effect.text),
              ),
            ),
        ),
      )
    )
      addRelationship(
        other,
        0.8,
        `Receives printed spell-type cost reduction from ${other.card.card.name}: ${otherText}`,
      );
  }
  const commanders = relationships.filter((r) => r.commander),
    links = relationships.filter((r) => !r.commander && r.strength >= 0.5);
  const commanderEvidence = commanders.flatMap((r) => r.evidence);
  const direct = commanders.some((r) => r.strength >= 0.8);
  const reciprocal = commanders.some((r) =>
    r.evidence.some(
      (e) =>
        e.includes(`${r.name} →`) || /Additional triggered abilities/.test(e),
    ),
  );
  const commanderScore = commanderEvidence.length
    ? Math.min(
        25,
        Math.round(Math.max(...commanders.map((r) => r.strength)) * 25) -
          (Math.max(...commanders.map((r) => r.strength)) === 1 && !reciprocal
            ? 2
            : 0),
      )
    : 0;
  if (
    f.faces.some((face) => face.hasChangeling) &&
    commanderScore > 0 &&
    typed.supportedTypes.length
  ) {
    const entryCommander = profile.cards.find(
      (c) =>
        c.card.commander &&
        c.receivers.some(
          (r) =>
            r.event === "enters" &&
            commanders.some(
              (link) =>
                link.identity === c.card.identity &&
                link.evidence.includes(
                  `${input.card.name} → ${c.card.card.name}: ${r.evidence.snippet}`,
                ),
            ),
        ),
    );
    commanderEvidence.unshift(
      `Changeling makes ${input.card.name} ${typed.supportedTypes.map((t) => `a ${t}`).join(" and ")}${entryCommander ? `, so entering triggers ${entryCommander.card.card.name}` : ", enabling the printed creature-type relationship"}.`,
    );
  }
  const positives: string[] = [],
    negatives: string[] = [],
    matchedThemes: string[] = [];
  let themeStrength = 0;
  for (const type of typed.supportedTypes) {
    if (
      f.faces.some(
        (face) =>
          hasCreatureType(face, type) ||
          face.tribalEffects.some((e) => e.creatureTypes.includes(type)),
      )
    ) {
      themeStrength = 1;
      matchedThemes.push(`typal:${type}`);
      positives.push(
        `Its ${type} type or printed ${type}-specific effect supports the deck’s verified ${type} engine.`,
      );
    } else if (
      f.faces.some((face) =>
        face.createsTokens.some(
          (t) => t.controller !== "opponent" && t.creatureTypes.includes(type),
        ),
      )
    ) {
      themeStrength = Math.max(themeStrength, 0.85);
      matchedThemes.push(`typal:${type}`);
      positives.push(
        `Creates ${type} tokens for the deck’s ${type} payoffs; tokens do not satisfy nontoken triggers.`,
      );
    }
  }
  if (links.length || commanderScore > 0) {
    const strength = Math.max(0, ...relationships.map((r) => r.strength));
    themeStrength = Math.max(
      themeStrength,
      typed.supportedTypes.length && !commanderScore && !matchedThemes.length
        ? Math.min(0.2, strength)
        : strength,
    );
    // These are labels for proven relationships, not sources of bonus points.
    for (const tag of profile.primaryArchetypes.filter(
      (p) => !p.tag.startsWith("typal:") && p.tag !== "goodstuff",
    ))
      matchedThemes.push(tag.tag);
  }
  if (has(f, "token_doubler")) {
    if (typed.meaningfulTokenSources >= 2) {
      themeStrength = Math.max(themeStrength, 0.9);
      positives.push(
        `Token replacement effect supports ${typed.meaningfulTokenSources} meaningful token sources in the saved deck.`,
      );
      matchedThemes.push("tokens");
    }
  }
  const ownTokens = f.faces
    .flatMap((face) => face.createsTokens)
    .filter((t) => t.controller !== "opponent");
  if (typed.genericTokenEngine && ownTokens.length) {
    themeStrength = Math.max(themeStrength, 0.8);
    matchedThemes.push("tokens");
  }
  const needed = Object.entries(rs)
    .map(([role, contribution]) => {
      let strength = contribution;
      if (
        role === "tokenGeneration" &&
        typed.supportedTypes.length &&
        !typed.genericTokenEngine &&
        !ownTokens.some((t) =>
          t.creatureTypes.some((type) => typed.supportedTypes.includes(type)),
        )
      )
        strength *= 0.1;
      if (role === "payoff" && themeStrength === 0) strength *= 0.2;
      return {
        role: role as Role,
        severity: typed.roleNeeds[role as Role].deficit * strength,
      };
    })
    .sort((a, b) => b.severity - a.severity);
  let roleSeverity = needed[0]?.severity || 0;
  const roleEvidence = needed
    .filter((n) => n.severity > 0)
    .map(
      (n) =>
        `${roleLabels[n.role]} ${typed.roleNeeds[n.role].count.toFixed(1)} / target ${typed.roleNeeds[n.role].target}; ${Math.round(n.severity * 100)}% unmet effective need.`,
    );
  const ownSmoothing =
    has(f, "land_smoothing") &&
    f.faces.some((face) =>
      face.searchesLibrary.some(
        (s) =>
          s.controller !== "opponent" &&
          s.targetTypes.includes("Land") &&
          s.destination === "hand",
      ),
    );
  if (ownSmoothing) {
    const smoothing = 0.5 * typed.roleNeeds.lands.deficit;
    roleSeverity = Math.max(roleSeverity, smoothing);
    roleEvidence.push(
      "Basic/land search to hand smooths future land drops; it is neither unrestricted tutoring nor mana ramp.",
    );
  }
  const effects = f.faces.reduce(
    (n, face) =>
      n +
      face.searchesLibrary.length +
      face.createsTokens.length +
      face.addsMana.filter((m) => m.scope === "card").length +
      face.removal.length +
      face.costReductions.length +
      (face.drawsCards ? 1 : 0),
    0,
  );
  const repeatable =
    /\bwhenever\b|at the beginning|would[^.]*instead/i.test(text) ||
    (/^[^\n]*:/m.test(text) && !/sacrifice this|discard this/i.test(text));
  let efficiency = text ? 0.4 : 0.1;
  if (input.card.manaValue <= 4) efficiency += 0.15;
  if (ownSmoothing) efficiency += 0.3;
  if (repeatable) efficiency += 0.2;
  if (commanderScore >= 20 && repeatable) efficiency += 0.15;
  if (effects >= 2) efficiency += 0.1;
  if (ownFace(f, "Instant")) efficiency += 0.1;
  if (rs.removal && input.card.manaValue <= 3) efficiency += 0.25;
  if (/draw (?:two|three|four|[2-9]) cards|additional time|twice/i.test(text))
    efficiency += 0.15;
  if (ownTokens.some((t) => t.isCreature) && repeatable) efficiency += 0.15;
  if (
    (input.card.keywords || []).some((k) =>
      /flying|haste|hexproof|indestructible|ward/i.test(k),
    )
  )
    efficiency += 0.05;
  efficiency = Math.min(1, efficiency);
  const bucket = Math.min(7, Math.floor(input.card.manaValue)),
    density =
      (profile.manaCurve.buckets[bucket] || 0) /
      Math.max(1, profile.manaCurve.nonlands);
  const curve = Math.max(0, 1 - Math.max(0, density - 0.15));
  const components = [
    {
      label: "Commander interaction",
      points: Math.round((SCORE_WEIGHTS.commander * 100 * commanderScore) / 25),
    },
    {
      label: "Deck / theme interaction",
      points: Math.round(SCORE_WEIGHTS.theme * 100 * themeStrength),
    },
    {
      label: "Needed role",
      points: Math.round(SCORE_WEIGHTS.roleNeed * 100 * roleSeverity),
    },
    {
      label: "Card quality / efficiency",
      points: Math.round(SCORE_WEIGHTS.efficiency * 100 * efficiency),
    },
    {
      label: "Curve fit",
      points: Math.round(SCORE_WEIGHTS.curve * 100 * curve),
    },
    {
      label: "Existing-card interaction",
      points: Math.round(
        SCORE_WEIGHTS.deckInteractions * 100 * Math.min(1, links.length / 2),
      ),
    },
  ];
  const penalties: { name: string; value: number; reason: string }[] = [];
  const penalize = (name: string, amount: number, reason: string) => {
    penalties.push({ name, value: -Math.round(amount), reason });
    negatives.push(reason);
  };
  const wrongBody =
    ownFace(f, "Creature") &&
    typed.supportedTypes.length > 0 &&
    !f.faces.some((face) =>
      typed.supportedTypes.some((type) => hasCreatureType(face, type)),
    );
  if (
    wrongBody &&
    commanderScore === 0 &&
    !(roleSeverity >= 0.8 && efficiency >= 0.9)
  )
    penalize(
      "wrong_tribal_type",
      10,
      "Its creature type does not support the deck’s primary tribal engine.",
    );
  if (
    typed.supportedTypes.length &&
    !typed.genericTokenEngine &&
    ownTokens.some((t) => t.isCreature) &&
    !ownTokens.some((t) =>
      t.creatureTypes.some((type) => typed.supportedTypes.includes(type)),
    )
  )
    penalize(
      "wrong_token_type",
      8,
      `Creates ${[...new Set(ownTokens.flatMap((t) => t.creatureTypes))].join(" / ") || "unmatched creature"} tokens, not ${typed.supportedTypes.join(" / ")} tokens; these do not satisfy the Commander’s tribal condition.`,
    );
  const redundant = Object.keys(rs).filter(
    (r) =>
      typed.saturatedAreas.includes(r) && !["lands", "enabler"].includes(r),
  );
  if (redundant.length)
    penalize(
      "role_redundancy",
      Math.min(8, (commanderScore >= 20 ? 1 : 3) + redundant.length * 2),
      `${redundant.map((r) => `${roleLabels[r as Role]} ${typed.roleNeeds[r as Role].count}/${typed.roleNeeds[r as Role].target}`).join(", ")} already exceeds the role target.`,
    );
  if (density > 0.25 && !rs.lands)
    penalize(
      "mana_curve_congestion",
      Math.min(8, (density - 0.2) * 20),
      `Crowded ${bucket === 7 ? "7+" : bucket}-mana slot: ${Math.round(density * 100)}% of nonlands.`,
    );
  if (
    input.card.manaValue >= 5 &&
    effects <= 1 &&
    !repeatable &&
    efficiency < 0.75
  )
    penalize(
      "poor_mana_efficiency",
      6,
      "Its limited recorded effects cost substantial mana.",
    );
  if (input.card.manaValue >= 4 && !effects && !commanderScore)
    penalize(
      "low_impact_card",
      6,
      "No substantial functional effect was resolved at this mana cost.",
    );
  const unsupportedPayoff =
    /whenever[^,]*(?:sacrifice|dies|gain life|counters?)[^,]*,/i.test(text) &&
    !links.length &&
    commanderScore === 0 &&
    themeStrength === 0;
  if (unsupportedPayoff)
    penalize(
      "unsupported_subtheme",
      8,
      "The payoff has no verified support from the deck’s main engines.",
    );
  if (has(f, "token_doubler") && typed.meaningfulTokenSources < 2)
    penalize(
      "requires_missing_enabler",
      8,
      "Too few meaningful token sources support this token multiplier.",
    );
  if (
    /if you control (?:seven|eight|nine|ten|[7-9]) or more/i.test(text) &&
    roleSeverity < 0.25
  )
    penalize(
      "win_more",
      4,
      "Its payoff requires an already-developed board and does not address a major role gap.",
    );
  if (
    (typed.effects.get(text.split(input.card.name).join("~").trim()) || 0) >= 2
  )
    penalize(
      "duplicate_function",
      6,
      "Several saved cards already provide this same printed function.",
    );
  const graveyardPlan = profile.cards.some(
    (c) => (typed.roles.get(c.card.identity)?.recursion || 0) > 0,
  );
  if (
    graveyardPlan &&
    /exile (?:all|each)[^.\n]*(?:all |cards? (?:in|from) )?(?:all |each |your )?graveyards?|if a card[^.\n]*graveyard[^.\n]*exile it instead/i.test(
      text,
    ) &&
    !/opponent[^.\n]*graveyard/i.test(text)
  )
    penalize(
      "nonbo",
      15,
      "Exiling or replacing your own graveyard conflicts with the deck’s recursion plan.",
    );
  if (
    /destroy all artifacts[.]?$/im.test(text) &&
    profile.cards.filter((c) => ownFace(factsOf(c.card), "Artifact")).length >=
      3
  )
    penalize(
      "nonbo",
      15,
      "Destroying all artifacts conflicts with the deck’s artifact engine.",
    );
  const illegal = input.card.colorIdentity.some(
    (color) => !profile.colorIdentity.includes(color),
  );
  if (illegal)
    penalize(
      "color_or_identity_issue",
      20,
      "The card’s color identity is outside this Commander identity.",
    );
  // Noninteraction is not intrinsically bad. Reject a claimed interaction only
  // when evidence exists but its source fails the typed validation above.
  if (!commanderScore && commanders.some((r) => r.evidence.length))
    penalize(
      "commander_noninteraction",
      6,
      "An apparent Commander relationship did not pass typed validation.",
    );
  if (
    !commanderScore &&
    !links.length &&
    /(?:if|whenever)[^.\n]*artifact[^.\n]*(?:sacrifice|dies)/i.test(text) &&
    !profile.cards.some((c) => ownFace(factsOf(c.card), "Artifact"))
  )
    penalize(
      "requires_missing_enabler",
      8,
      "The printed artifact-dependent payoff has no available artifact engine in this deck.",
    );
  const confidenceReasons: string[] = [];
  if (f.uncertainties.length) confidenceReasons.push(...f.uncertainties);
  if (/choose (?:one|two)|at random|exchange|mutate|phase out/i.test(text))
    confidenceReasons.push(
      "Modal or unusual rules interactions require review.",
    );
  const confidence: Confidence =
    (input.card.oracleText === undefined && !input.card.cardFaces?.length) ||
    f.uncertainties.length > 1
      ? "Low"
      : confidenceReasons.length
        ? "Medium"
        : "High";
  if (!confidenceReasons.length)
    confidenceReasons.push(
      "Canonical type, effect and role evidence is deterministic; this is not a guarantee of game outcome.",
    );
  const eligibleReasons = [];
  if (commanderScore >= 20 && direct && commanderEvidence.length)
    eligibleReasons.push("Strong verified Commander interaction.");
  const engineSet = new Set(
    links
      .filter((r) => r.strength >= 0.8)
      .flatMap((r) =>
        r.evidence.map((e) => {
          if (e.startsWith("Graveyard setup")) return "graveyard";
          if (e.startsWith("Counter resources")) return "counters";
          const ability = e.slice(e.indexOf(":") + 1).split(",")[0];
          return /enters?|ETB/i.test(ability)
            ? "enters"
            : /attack/i.test(ability)
              ? "attacks"
              : /dies|sacrifice/i.test(ability)
                ? "death"
                : /cast/i.test(ability)
                  ? "cast"
                  : "unresolved";
        }),
      ),
  );
  engineSet.delete("unresolved");
  const majorEngines = engineSet;

  if (majorEngines.size >= 2)
    eligibleReasons.push(
      "Strong verified relationships with at least two distinct deck engines.",
    );
  if (roleSeverity >= 0.95 && efficiency >= 0.9 && !penalties.length)
    eligibleReasons.push(
      "Extremely high role need, excellent efficiency and no resolved conflict.",
    );
  let raw =
    components.reduce((n, c) => n + c.points, 0) +
    penalties.reduce((n, p) => n + p.value, 0);
  if (!eligibleReasons.length && raw >= 80) {
    penalize(
      "Excellent fit gate",
      raw - 79,
      "An 80+ score requires a verified major interaction or exceptional unmet role need.",
    );
    raw = 79;
  }
  if (illegal && raw > 0) {
    penalize(
      "Eligibility gate",
      raw,
      "An incompatible color identity cannot be recommended for this deck.",
    );
    raw = 0;
  }
  const score = Math.max(0, Math.min(100, raw));
  const factPositives = f.faces.flatMap((face) =>
    face.searchesLibrary
      .filter((s) => s.controller !== "opponent")
      .map(
        (s) =>
          `Searches for ${s.basicOnly ? "a basic land" : s.targetTypes.join(" / ") || "a card"} to ${s.destination}${s.destination === "hand" && s.targetTypes.includes("Land") ? ", helping future land drops" : ""}.`,
      ),
  );
  positives.push(...factPositives);
  const evidence: RecommendationEvidence = {
    positives,
    negatives,
    commanderEvidence,
    roleEvidence,
    penalties: penalties.map((p) => `${p.name}: ${p.value}; ${p.reason}`),
  };
  let summary = "No strong interaction or missing role was resolved.";
  const commanderName = profile.commanders[0]?.name || "the Commander";
  if (
    commanderScore > 0 &&
    f.faces.some((face) => face.hasChangeling) &&
    typed.supportedTypes.length
  )
    summary = commanderEvidence[0];
  else if (commanderScore > 0 && has(f, "tribal_cost_reduction"))
    summary = `Its printed ${typed.supportedTypes[0] || "creature-type"} spell discount supports the Commander and matching creatures.`;
  else if (
    commanderScore > 0 &&
    f.faces.some((face) => face.tribalEffects.length)
  )
    summary = `The Commander matches this card’s printed ${typed.supportedTypes[0] || "creature-type"} payoff condition.`;
  else if (commanderScore > 0)
    summary = `Its printed effects have a verified rules interaction with ${commanderName}; inspect the score details for the exact condition.`;
  else if (ownTokens.length)
    summary = `Creates ${[...new Set(ownTokens.flatMap((t) => [...t.creatureTypes, ...t.tokenTypes]))].join(" / ") || (ownTokens.some((t) => t.isCopy) ? "copy" : "creature")} tokens${typed.supportedTypes.length && !themeStrength ? `, with no verified ${typed.supportedTypes[0]} interaction` : ""}.`;
  else if (roleSeverity > 0 && needed[0])
    summary = `Provides needed ${roleLabels[needed[0].role].toLowerCase()} without claiming Commander synergy.`;
  else if (positives.length) summary = positives[0];
  let concern = "";
  if (penalties.some((p) => p.name === "nonbo"))
    concern = "Some effects work against the deck’s existing engines.";
  else if (penalties.some((p) => p.name === "wrong_token_type"))
    concern = `These tokens do not satisfy ${commanderName}’s printed tribal condition.`;
  else if (penalties.some((p) => p.name === "role_redundancy"))
    concern = `This deck already has plenty of ${redundant[0] === "payoff" ? "payoff cards" : "cards serving these roles"}.`;
  else if (penalties.some((p) => p.name === "wrong_tribal_type"))
    concern = "Its creature type does not support the deck’s main tribal plan.";
  else if (penalties.some((p) => p.name === "requires_missing_enabler"))
    concern = "The needed supporting engine is missing.";
  else if (penalties.some((p) => p.name === "mana_curve_congestion"))
    concern = "The deck already has many cards at this mana cost.";
  const explanation = `${summary}${factPositives.length && commanderScore > 0 ? ` ${factPositives[0]}` : concern ? ` ${concern}` : ""}`;
  const debug = {
    cardId: input.identity,
    version: RECOMMENDATION_VERSION,
    profileRevision: profile.revision,
    commanderSynergy: commanderScore,
    archetypeFit: components[1].points,
    roleNeed: components[2].points,
    packageMatch: components[5].points,
    cardQuality: components[3].points,
    genericOverlap: 0,
    curveFit: components[4].points,
    penalties,
    matchedTags: [...new Set(matchedThemes)],
    commanderInteractions: commanderEvidence,
    packageInteractions: links.flatMap((r) => r.evidence).slice(0, 8),
    componentReasons: components.map((c, i) => ({
      label: c.label,
      reason: [
        commanderEvidence.join(" ") || "No verified Commander interaction.",
        positives.join(" ") || "No verified theme relationship.",
        roleEvidence.join(" ") || "No unmet typed role.",
        `Efficiency ${Math.round(efficiency * 100)}%; ${effects} factual effects; ${repeatable ? "repeatable" : "one-shot/limited"}.`,
        `${Math.round(density * 100)}% of nonlands occupy this mana slot.`,
        links
          .flatMap((r) => r.evidence)
          .slice(0, 6)
          .join(" ") || "No verified existing-card interaction.",
      ][i],
    })),
    rawScore: raw,
    finalScore: score,
  };
  const result: StrategyScore = {
    score,
    band: recommendationBand(score),
    tier:
      score >= 70
        ? "Recommended"
        : score >= 50
          ? "Worth Considering"
          : "Other Legal Cards",
    components: [
      ...components,
      ...penalties.map((p) => ({ label: p.name, points: p.value })),
    ],
    debug,
    roles: [
      ...Object.keys(rs).map((r) => roleLabels[r as Role]),
      ...(ownSmoothing ? ["Basic land to hand / smoothing"] : []),
    ],
    reasons: [
      ...commanderEvidence,
      ...links.flatMap((r) => r.evidence).slice(0, 2),
      ...positives,
      ...roleEvidence,
    ],
    conflicts: negatives,
    explanation,
    recommendation: {
      facts: f,
      confidence,
      confidenceReasons,
      commander: { score: commanderScore, direct, evidence: commanderEvidence },
      evidence,
      matchedThemes: [...new Set(matchedThemes)],
      typedRoles: f.typedRoles,
      gate: {
        excellentEligible: eligibleReasons.length > 0,
        reasons: eligibleReasons,
      },
      componentCaps: Object.values(SCORE_WEIGHTS).map((w) => w * 100),
      roleNeedSeverity: roleSeverity,
      efficiency,
    },
  };
  state.scores.set(key, result);
  if (state.scores.size > RECOMMENDATION_LIMITS.cards)
    state.scores.delete(state.scores.keys().next().value!);
  return result;
}
