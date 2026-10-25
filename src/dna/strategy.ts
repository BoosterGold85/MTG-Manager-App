import type { CardMetadata } from "../models/collection";
import type { DnaInput, DnaInputCard } from "./engine";
import type { Evidence } from "../intelligence/types";
import { tagDefinition } from "../intelligence/taxonomy";
import { creatureTypePatterns } from "../intelligence/subtypes";
import { cardKeywords, oracleText } from "../utils/cardKeywords";

export const SYNERGY_VERSION = "0.6.1";
export type Role =
  | "ramp"
  | "cardAdvantage"
  | "removal"
  | "boardWipes"
  | "protection"
  | "graveyardHate"
  | "tutors"
  | "recursion"
  | "finishers"
  | "lands"
  | "manaFixing"
  | "tokenGeneration"
  | "sacrificeOutlet"
  | "payoff"
  | "enabler";
export interface WeightedTag {
  tag: string;
  label: string;
  weight: number;
  evidence: Evidence[];
}
export interface RoleNeed {
  count: number;
  target: number;
  deficit: number;
  need: "HIGH" | "MEDIUM" | "LOW" | "NONE";
}
export type DeckRoleNeeds = Record<Role, RoleNeed>;
export interface ManaCurveProfile {
  buckets: Record<number, number>;
  nonlands: number;
  average: number;
  commanderCost: number;
  rampCount: number;
  coloredPips: Record<string, number>;
}
export interface CommanderSynergyTag {
  commander: string;
  event: string;
  objects: string[];
  creatureTypes: string[];
  nontoken: boolean;
  noncreature: boolean;
  requiredKeywords: string[];
  selfOnly: boolean;
  damageAmount?: number;
  evidence: Evidence;
}
export interface SynergyPackage extends WeightedTag {
  members: string[];
}
interface Characteristics {
  card: DnaInputCard;
  features: Map<string, number>;
  roles: Set<Role>;
  types: string[];
  text: string;
  receivers: CommanderSynergyTag[];
  emits: Set<string>;
  quality: number;
  repeatable: boolean;
  effects: number;
}
export interface DeckStrategyProfile {
  version: string;
  revision: string;
  commanders: CardMetadata[];
  colorIdentity: string[];
  primaryArchetypes: WeightedTag[];
  secondaryArchetypes: WeightedTag[];
  commanderMechanics: WeightedTag[];
  commanderSynergyTags: CommanderSynergyTag[];
  creatureTypes: WeightedTag[];
  mechanicalThemes: WeightedTag[];
  roleNeeds: DeckRoleNeeds;
  manaCurve: ManaCurveProfile;
  cardTypeDistribution: Record<string, number>;
  synergyPackages: SynergyPackage[];
  powerBaseline: number;
  tribalDensity: number;
  primaryCreatureType?: string;
  // Internal immutable inputs, not persisted or exported with collection data.
  cards: Characteristics[];
}
export interface SynergyScoreDebug {
  cardId: string;
  version: string;
  profileRevision: string;
  commanderSynergy: number;
  archetypeFit: number;
  roleNeed: number;
  packageMatch: number;
  cardQuality: number;
  genericOverlap: number;
  curveFit: number;
  penalties: { name: string; value: number; reason: string }[];
  matchedTags: string[];
  commanderInteractions: string[];
  packageInteractions: string[];
  componentReasons: { label: string; reason: string }[];
  rawScore: number;
  finalScore: number;
}
export interface StrategyScore {
  score: number;
  band: string;
  tier: "Recommended" | "Worth Considering" | "Other Legal Cards";
  components: { label: string; points: number }[];
  debug: SynergyScoreDebug;
  roles: string[];
  reasons: string[];
  conflicts: string[];
  explanation: string;
}
const roleTags: Record<Role, string[]> = {
  ramp: [
    "ramp",
    "mana-dork",
    "mana-rock",
    "cost-reduction",
    "extra-land-drops",
  ],
  cardAdvantage: ["card-draw", "impulse-draw", "looting"],
  removal: [
    "removal",
    "creature-removal",
    "permanent-removal",
    "artifact-enchantment-removal",
    "counterspell",
  ],
  boardWipes: ["board-wipe"],
  protection: ["protection", "hexproof-ward"],
  graveyardHate: ["graveyard-hate"],
  tutors: ["tutor"],
  recursion: ["recursion", "reanimator", "land-recursion"],
  finishers: ["extra-combat", "go-tall"],
  lands: [],
  manaFixing: ["mana-fixing"],
  tokenGeneration: ["tokens"],
  sacrificeOutlet: ["sacrifice-outlet"],
  payoff: [],
  enabler: [],
};
const labels: Record<string, string> = {
  spells: "Spellslinger",
  tokens: "Tokens",
  sacrifice: "Aristocrats / Sacrifice",
  graveyard: "Graveyard / Reanimator",
  lands: "Landfall / Lands",
  counters: "+1/+1 Counters",
  voltron: "Equipment / Auras",
  artifacts: "Artifacts",
  enchantments: "Enchantress",
  blink: "Creature ETB / Blink",
  lifegain: "Lifegain",
  treasure: "Treasure",
  combat: "Attack / Combat Engines",
  drawEngine: "Draw Engines",
  damage: "Damage Engines",
  goodstuff: "Efficient Flexible Utility",
};
const featureTags: Record<string, string[]> = {
  spells: ["spellslinger", "instants-sorceries", "copy-spells"],
  tokens: ["tokens", "token-payoff", "populate", "go-wide"],
  sacrifice: [
    "aristocrats",
    "sacrifice-payoff",
    "sacrifice-outlet",
    "sacrifice-fodder",
    "death-triggers",
  ],
  graveyard: [
    "reanimator",
    "recursion",
    "self-mill",
    "graveyard-payoff",
    "land-recursion",
  ],
  lands: ["landfall", "lands-matter", "extra-land-drops", "land-recursion"],
  counters: ["plus-counters", "counter-payoff", "proliferate"],
  voltron: ["voltron", "equipment", "auras", "go-tall"],
  artifacts: ["artifacts"],
  enchantments: ["enchantments"],
  blink: ["blink"],
  lifegain: ["lifegain", "lifegain-payoff"],
  treasure: ["treasure"],
  combat: ["extra-combat", "attack-triggers", "combat-damage-triggers"],
  drawEngine: [],
  damage: [],
};
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
const genericTags = new Set([
  "card-draw",
  "impulse-draw",
  "looting",
  "ramp",
  "mana-dork",
  "mana-rock",
  "removal",
  "creature-removal",
  "permanent-removal",
  "attack-triggers",
  "combat-damage-triggers",
  "etb",
  "instants-sorceries",
]);
const objects = [
  "Creature",
  "Artifact",
  "Enchantment",
  "Equipment",
  "Aura",
  "Instant",
  "Sorcery",
  "Land",
  "Token",
  "Counter",
];
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
};
const evidence = (snippet: string, reason: string): Evidence => ({
  field: "oracleText",
  snippet,
  reason,
});
const label = (id: string) =>
  id.startsWith("typal:") ? `${id.slice(6)} Typal` : labels[id] || id;
function receivers(c: DnaInputCard): CommanderSynergyTag[] {
  const result: CommanderSynergyTag[] = [];
  for (const clause of oracleText(c.card)
    .split(/[.\n]/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    if (!/\b(?:whenever|when|at the beginning)\b/i.test(clause)) continue;
    const trigger = clause.split(",")[0];
    // Keep the Commander's own abilities, but never let another card masquerade as their subject.
    const selfOnly =
      (/^(?:when|whenever) this (?:creature|permanent|artifact|enchantment)/i.test(
        trigger,
      ) ||
        ["when ", "whenever "].some((prefix) =>
          trigger.toLowerCase().startsWith(prefix + c.card.name.toLowerCase()),
        )) &&
      !/\bor another\b/i.test(trigger);
    const event = /\bcast\b/i.test(trigger)
      ? "cast"
      : /\benter(?:s|ed)?\b/i.test(trigger)
        ? "enters"
        : /\bdie(?:s)?\b/i.test(trigger)
          ? "dies"
          : /combat damage/i.test(trigger)
            ? "combat-damage"
            : /\battack(?:s)?\b/i.test(trigger)
              ? "attacks"
              : /\bsacrific/i.test(trigger)
                ? "sacrifice"
                : /\bgain.*life/i.test(trigger)
                  ? "lifegain"
                  : /\bdraw\b/i.test(trigger)
                    ? "draw"
                    : /\bcounters?\b/i.test(trigger) &&
                        /put|place|remove|proliferat/i.test(trigger)
                      ? "counters"
                      : /counter(?:s|ed)? (?:a |an? |target )?(?:spell|ability)/i.test(
                            trigger,
                          )
                        ? "counterspell"
                        : /deals?[^,]{0,50}damage/i.test(trigger)
                          ? "damage"
                          : /graveyard/i.test(trigger)
                            ? "graveyard"
                            : "turn";
    const types = c.analysis.creatureTypes.synergy.filter((type) =>
      creatureTypePatterns
        .find((p) => p.type === type)
        ?.reference.test(trigger),
    );
    result.push({
      commander: c.card.name,
      event,
      objects: objects.filter((o) =>
        new RegExp(`\\b${o}(?:s)?\\b`, "i").test(trigger),
      ),
      creatureTypes: types,
      selfOnly,
      damageAmount: /deals? (?:exactly )?(\d+) damage/i.exec(trigger)
        ? Number(/deals? (?:exactly )?(\d+) damage/i.exec(trigger)![1])
        : undefined,
      nontoken: /nontoken/i.test(trigger),
      noncreature: /noncreature/i.test(trigger),
      requiredKeywords: ["flying", "haste", "trample", "defender"].filter(
        (keyword) => new RegExp(`with ${keyword}`, "i").test(trigger),
      ),
      evidence: evidence(
        clause,
        "Explicit triggered ability and its referenced objects.",
      ),
    });
  }
  return result;
}
function characteristics(c: DnaInputCard): Characteristics {
  const fields = [
    "name",
    "scryfallId",
    "oracleId",
    "manaValue",
    "manaCost",
    "typeLine",
    "oracleText",
    "colorIdentity",
    "keywords",
    "cardFaces",
    "power",
    "toughness",
    "loyalty",
    "layout",
    "producedMana",
    "imageUrl",
    "thumbnailUrl",
    "setCode",
    "setName",
    "collectorNumber",
    "rarity",
    "artist",
    "aliases",
    "printedLanguage",
  ] as const;
  c = {
    ...c,
    card: Object.fromEntries(
      fields.filter((k) => c.card[k] !== undefined).map((k) => [k, c.card[k]]),
    ) as CardMetadata,
  };

  const tags = new Set(c.assignments.map((a) => a.tagId)),
    text = oracleText(c.card),
    types = cardKeywords(c.card).some((k) => k.toLowerCase() === "changeling")
      ? creatureTypePatterns.map((p) => p.type)
      : c.analysis.creatureTypes.own;
  const features = new Map<string, number>();
  for (const [id, ids] of Object.entries(featureTags))
    if (ids.some((t) => tags.has(t))) features.set(id, 1);
  for (const type of types) features.set(`typal:${type}`, 0.85);
  for (const a of c.assignments)
    if (a.tagId.startsWith("typal:")) features.set(a.tagId, 1);
  const own = c.card.typeLine.split("—")[0];
  if (/\b(?:Instant|Sorcery)\b/.test(own))
    features.set("spells", Math.max(0.85, features.get("spells") || 0));
  if (/\bArtifact\b/.test(own))
    features.set("artifacts", Math.max(0.85, features.get("artifacts") || 0));
  if (/\bEnchantment\b/.test(own))
    features.set(
      "enchantments",
      Math.max(0.85, features.get("enchantments") || 0),
    );
  if (/\b(?:Equipment|Aura)\b/.test(c.card.typeLine))
    features.set("voltron", 1);
  if (/\bLand\b/.test(own)) features.set("lands", 0.85);
  if (tags.has("etb") && /\bCreature\b/.test(own)) features.set("blink", 0.9);
  if (tags.has("card-draw") || tags.has("impulse-draw"))
    features.set("drawEngine", 0.85);
  const rs = receivers(c);
  for (const r of rs) if (r.event === "draw") features.set("drawEngine", 1);
  const roles = new Set<Role>();
  if (rs.some((r) => !r.selfOnly && r.event !== "turn")) roles.add("payoff");
  if (
    /trigger[^.\n]{0,110}(?:additional time|twice)|copy target triggered ability/i.test(
      text,
    )
  )
    roles.add("enabler");
  for (const [role, ids] of Object.entries(roleTags))
    if (ids.some((t) => tags.has(t))) roles.add(role as Role);
  if (/\bLand\b/.test(own)) roles.add("lands");
  if (c.assignments.some((a) => tagDefinition(a.tagId)?.category === "payoff"))
    roles.add("payoff");
  if (c.assignments.some((a) => tagDefinition(a.tagId)?.category === "enabler"))
    roles.add("enabler");
  if (
    /\bCreature\b/.test(own) &&
    c.card.manaValue >= 5 &&
    (/flying|trample|double strike/i.test(cardKeywords(c.card).join(" ")) ||
      features.size > 1)
  )
    roles.add("finishers");
  const emits = new Set(
    objects
      .filter((o) => new RegExp(`\\b${o}\\b`, "i").test(own))
      .map((o) => o.toLowerCase()),
  );
  for (const type of types) emits.add(`typal:${type}`);
  if (/\bEquipment\b/.test(c.card.typeLine)) emits.add("equipment");
  if (/\bAura\b/.test(c.card.typeLine)) emits.add("aura");
  if (
    tags.has("extra-land-drops") ||
    /search[^.\n]{0,120}land[^.\n]{0,150}(?:put|onto)[^.\n]{0,35}battlefield/i.test(
      text,
    )
  )
    emits.add("land");
  if (tags.has("tokens")) {
    emits.add("token");
    emits.add("creature");
    for (const type of c.analysis.creatureTypes.referenced)
      if (
        new RegExp(
          `create[^.\\n]{0,130}\\b${type}\\b[^.\\n]{0,35}token`,
          "i",
        ).test(text)
      ) {
        emits.add(`typal:${type}`);
        features.set(
          `typal:${type}`,
          Math.max(0.8, features.get(`typal:${type}`) || 0),
        );
      }
  }
  if (tags.has("treasure")) {
    emits.add("token");
    emits.add("artifact");
  }
  const effectText = text
    .split(/[.\n]/)
    .map((clause) =>
      /^(?:when|whenever|at the beginning)/i.test(clause.trim())
        ? clause.slice(clause.indexOf(",") + 1)
        : clause,
    )
    .join(".");
  if (/deals?[^.\n]{0,80}damage/i.test(effectText)) {
    emits.add("damage");
    features.set("damage", Math.max(0.85, features.get("damage") || 0));
  }
  if (tags.has("counterspell")) emits.add("counterspell");
  if (roles.has("cardAdvantage")) emits.add("draw");
  if (tags.has("lifegain")) emits.add("lifegain");
  if (tags.has("plus-counters") || tags.has("proliferate"))
    emits.add("counters");
  if (roles.has("sacrificeOutlet") || tags.has("sacrifice-fodder")) {
    emits.add("sacrifice");
    emits.add("dies");
  }
  if (tags.has("self-mill") || roles.has("recursion")) emits.add("graveyard");
  const effects = c.assignments.filter(
    (a) =>
      !["strategy", "mechanic"].includes(
        tagDefinition(a.tagId)?.category || "",
      ),
  ).length;
  const repeatable =
    /\bwhenever\b|at the beginning|would[^.\n]{0,100}instead/i.test(text) ||
    (/Creature|Artifact|Enchantment|Planeswalker/.test(own) &&
      /^[^.\n]{1,100}:/m.test(text) &&
      !/discard this card|sacrifice this (?:creature|artifact|permanent)/i.test(
        text,
      ));
  const mana = c.card.manaValue;
  // Transparent local efficiency proxy, never price, rarity, popularity or a universal power rating.
  let quality = text ? 3 : 0;
  if (text && mana <= 2) quality += 2;
  else if (text && mana <= 4) quality++;
  if (repeatable) quality += 2;
  if (effects >= 2) quality++;
  if (
    /trigger[^.\n]{0,110}(?:additional time|twice)|copy target triggered ability/i.test(
      text,
    )
  )
    quality += 3;

  if (
    cardKeywords(c.card).some((k) =>
      /^(?:indestructible|hexproof|ward)$/i.test(k),
    )
  )
    quality++;
  if (/\bInstant\b/.test(own) || /choose (?:one|two)|choose up to/i.test(text))
    quality++;
  if (/draw (?:two|three|four|[2-9]) cards|add (?:\{[^}]+\}){2,}/i.test(text))
    quality++;
  const power = Number(c.card.power);
  if (
    Number.isFinite(power) &&
    power > 0 &&
    power >= Math.max(3, mana) &&
    /flying|trample|haste|double strike/i.test(cardKeywords(c.card).join(" "))
  )
    quality++;
  return {
    card: c,
    features,
    roles,
    types,
    text,
    receivers: rs,
    emits,
    quality: Math.min(10, quality),
    repeatable,
    effects,
  };
}
function interaction(
  receiver: CommanderSynergyTag,
  source: Characteristics,
): number {
  if (receiver.event === "turn" || receiver.selfOnly) return 0;
  if (
    receiver.event === "damage" &&
    receiver.damageAmount !== undefined &&
    !new RegExp(`deals? ${receiver.damageAmount} damage`, "i").test(source.text)
  )
    return 0;
  if (receiver.event === "combat-damage")
    return source.emits.has("creature") &&
      (!receiver.creatureTypes.length ||
        receiver.creatureTypes.some((t) => source.types.includes(t)))
      ? 0.8
      : 0;
  const own = source.card.card.typeLine.split("—")[0];
  if (/\bToken\b/.test(own) && (receiver.nontoken || receiver.event === "cast"))
    return 0;
  if (
    receiver.requiredKeywords.some(
      (keyword) =>
        !cardKeywords(source.card.card).some(
          (k) => k.toLowerCase() === keyword,
        ) &&
        !(
          source.emits.has("token") &&
          new RegExp(`token[^.\n]{0,50}${keyword}`, "i").test(source.text)
        ),
    )
  )
    return 0;
  const matchesType = receiver.creatureTypes.some((type) =>
    source.types.includes(type),
  );
  if (receiver.noncreature && /\bCreature\b/.test(own) && !matchesType)
    return 0;
  if (
    receiver.noncreature &&
    !/\bCreature\b/.test(own) &&
    receiver.event === "cast"
  )
    return 1;
  if (receiver.event === "cast") {
    if (receiver.creatureTypes.length)
      return receiver.creatureTypes.some((t) => source.types.includes(t))
        ? 1
        : 0;
    if (receiver.objects.length)
      return receiver.objects.some((o) =>
        new RegExp(`\\b${o}\\b`, "i").test(own),
      )
        ? 1
        : 0;
    return 0.25; // Unqualified spell overlap is intentionally weak.
  }
  if (["enters", "attacks"].includes(receiver.event)) {
    if (receiver.creatureTypes.length) {
      if (source.types.some((t) => receiver.creatureTypes.includes(t)))
        return 1;
      return !receiver.nontoken &&
        receiver.event === "enters" &&
        receiver.creatureTypes.some((t) => source.emits.has(`typal:${t}`))
        ? 0.9
        : 0;
    }
    if (receiver.objects.length) {
      const hits = receiver.objects.filter(
        (o) => o !== "Token" && o !== "Counter",
      );
      if (receiver.objects.includes("Token") && !source.emits.has("token"))
        return 0;
      if (
        receiver.nontoken &&
        source.emits.has("token") &&
        !/Creature|Artifact|Enchantment/.test(own)
      )
        return 0;
      return hits.some((o) => source.emits.has(o.toLowerCase())) ||
        (receiver.objects.includes("Token") &&
          source.emits.has("token") &&
          !hits.length)
        ? 0.9
        : 0;
    }
  }
  if (["dies", "sacrifice"].includes(receiver.event)) {
    const anyCreatureOutlet =
      source.roles.has("sacrificeOutlet") &&
      /sacrifice (?:another |a |an? |any number of )?creature/i.test(
        source.text,
      );
    if (
      receiver.creatureTypes.length &&
      !receiver.creatureTypes.some(
        (t) => source.types.includes(t) || source.emits.has(`typal:${t}`),
      ) &&
      !anyCreatureOutlet
    )
      return 0;
    return source.emits.has("sacrifice") || source.emits.has("dies")
      ? 1
      : source.emits.has("token")
        ? 0.8
        : source.emits.has("creature")
          ? 0.25
          : 0;
  }
  return source.emits.has(receiver.event) ? 1 : 0;
}
export function buildDeckStrategyProfile(input: DnaInput): DeckStrategyProfile {
  const start = performance.now(),
    cards = input.cards.map(characteristics),
    main = cards.filter((c) => !c.card.commander),
    commanders = cards.filter((c) => c.card.commander);
  const total = main.reduce((n, c) => n + c.card.quantity, 0),
    creatures = main.filter((c) => /\bCreature\b/.test(c.card.card.typeLine));
  const creatureTotal = creatures.reduce((n, c) => n + c.card.quantity, 0);
  const typeCounts = new Map<string, number>();
  for (const c of creatures)
    for (const type of c.types)
      typeCounts.set(type, (typeCounts.get(type) || 0) + c.card.quantity);
  const typeWeights = [...typeCounts]
    .map(([type, n]) => ({
      tag: `typal:${type}`,
      label: `${type} Typal`,
      weight: creatureTotal ? n / creatureTotal : 0,
      evidence: [] as Evidence[],
    }))
    .sort((a, b) => b.weight - a.weight || a.tag.localeCompare(b.tag));
  const keys = new Set(cards.flatMap((c) => [...c.features.keys()]));
  const weighted: WeightedTag[] = [];
  for (const key of keys) {
    const contributors = main.filter((c) => (c.features.get(key) || 0) > 0),
      command = commanders.filter((c) => (c.features.get(key) || 0) > 0);
    const direct = command.some(
      (c) =>
        c.card.assignments.some(
          (a) => a.tagId === key || featureTags[key]?.includes(a.tagId),
        ) ||
        c.receivers.some(
          (r) =>
            r.creatureTypes.some((t) => key === `typal:${t}`) ||
            (key === "blink" &&
              r.event === "enters" &&
              r.objects.includes("Creature")) ||
            (key === "drawEngine" && r.event === "draw") ||
            (key === "damage" && r.event === "damage") ||
            (key === "spells" && r.event === "counterspell"),
        ),
    );
    if (
      key.startsWith("typal:") &&
      !cards.some((c) => c.card.assignments.some((a) => a.tagId === key))
    )
      continue;
    const count = contributors.reduce(
      (n, c) => n + c.card.quantity * (c.features.get(key) || 0),
      0,
    );
    const density = key.startsWith("typal:")
      ? typeWeights.find((t) => t.tag === key)?.weight || 0
      : count / Math.max(1, total);
    const explicitMain = contributors.filter((c) =>
      c.card.assignments.some(
        (a) => a.tagId === key || featureTags[key]?.includes(a.tagId),
      ),
    );
    // An isolated self ETB is not a blink strategy; incidental attack tags do not dominate typal identity.
    if (
      key === "blink" &&
      !cards.some(
        (c) =>
          c.card.assignments.some((a) => a.tagId === "blink") ||
          c.receivers.some(
            (r) =>
              r.event === "enters" &&
              r.objects.includes("Creature") &&
              !r.selfOnly,
          ),
      )
    )
      continue;
    if (
      key === "drawEngine" &&
      !cards.some((c) => c.receivers.some((r) => r.event === "draw"))
    )
      continue;
    if (contributors.length < 2 && !direct) continue;
    const commanderWeight = direct ? 1 : command.length ? 0.55 : 0;
    const deckWeight =
      Math.min(1, density * 2.5) * (explicitMain.length ? 1 : 0.8);
    const weight = Math.min(
      1,
      commanderWeight * 0.6 +
        deckWeight * 0.4 +
        (contributors.length >= 3 ? 0.15 : 0),
    );
    if (weight < 0.18) continue;
    weighted.push({
      tag: key,
      label: label(key),
      weight,
      evidence: [...command, ...explicitMain]
        .slice(0, 6)
        .map((c) =>
          evidence(
            c.text || c.card.card.typeLine,
            `${c.card.card.name} supports this strategy${c.card.commander ? " as Commander" : ""}.`,
          ),
        ),
    });
  }
  weighted.sort((a, b) => b.weight - a.weight || a.tag.localeCompare(b.tag));
  const primary = weighted
    .filter((w) => w.weight >= Math.max(0.4, (weighted[0]?.weight || 0) * 0.65))
    .slice(0, 4);
  if (!primary.length && total >= 3)
    primary.push({
      tag: "goodstuff",
      label: labels.goodstuff,
      weight: 0.5,
      evidence: [],
    });
  const secondary = weighted.filter((w) => !primary.includes(w)).slice(0, 8);
  const dominantTribe = typeWeights.find(
    (type) => type.weight > 0.6 && primary.some((p) => p.tag === type.tag),
  );
  const buckets: Record<number, number> = {},
    pips: Record<string, number> = {},
    distribution: Record<string, number> = {};
  let nonlands = 0,
    manaSum = 0;
  for (const c of main) {
    const card = c.card.card,
      q = c.card.quantity;
    for (const type of [
      "Creature",
      "Artifact",
      "Enchantment",
      "Land",
      "Instant",
      "Sorcery",
      "Planeswalker",
      "Battle",
    ])
      if (new RegExp(`\\b${type}\\b`).test(card.typeLine.split("—")[0]))
        distribution[type] = (distribution[type] || 0) + q;
    if (!c.roles.has("lands")) {
      const bucket = Math.min(7, Math.floor(card.manaValue));
      buckets[bucket] = (buckets[bucket] || 0) + q;
      nonlands += q;
      manaSum += card.manaValue * q;
    }
    for (const color of (card.manaCost || "").match(/[WUBRG]/g) || [])
      pips[color] = (pips[color] || 0) + q;
  }
  const targets: Record<Role, number> = {
    ramp:
      manaSum / Math.max(1, nonlands) >= 3.5 ||
      commanders.some((c) => c.card.card.manaValue >= 6)
        ? 12
        : 10,
    cardAdvantage: 10,
    removal: 8,
    boardWipes: 3,
    protection: 4,
    graveyardHate: 2,
    tutors: 2,
    recursion: primary.some((p) => p.tag === "graveyard") ? 10 : 3,
    finishers: 5,
    lands: 36,
    manaFixing:
      new Set(commanders.flatMap((c) => c.card.card.colorIdentity)).size <= 1
        ? 0
        : new Set(commanders.flatMap((c) => c.card.card.colorIdentity)).size ===
            2
          ? 6
          : 8,
    tokenGeneration: primary.some((p) =>
      ["tokens", "sacrifice"].includes(p.tag),
    )
      ? 12
      : 0,
    sacrificeOutlet: primary.some((p) => p.tag === "sacrifice") ? 6 : 0,
    payoff: 10,
    enabler: 10,
  };
  const roleNeeds = {} as DeckRoleNeeds;
  for (const role of Object.keys(targets) as Role[]) {
    const count = main
        .filter((c) => c.roles.has(role))
        .reduce((n, c) => n + c.card.quantity, 0),
      target = total
        ? Math.max(
            targets[role] ? 1 : 0,
            Math.round((targets[role] * total) / 99),
          )
        : 0,
      deficit = target ? Math.max(0, (target - count) / target) : 0;
    roleNeeds[role] = {
      count,
      target,
      deficit,
      need:
        deficit >= 0.5
          ? "HIGH"
          : deficit > 0
            ? "MEDIUM"
            : target && count <= target
              ? "LOW"
              : "NONE",
    };
  }
  const synergyPackages = weighted
    .filter(
      (w) =>
        main.filter((c) => (c.features.get(w.tag) || 0) >= 0.8).length >= 2,
    )
    .map((w) => ({
      ...w,
      members: main
        .filter((c) => (c.features.get(w.tag) || 0) >= 0.8)
        .map((c) => c.card.card.name),
    }));
  const profile: DeckStrategyProfile = {
    version: SYNERGY_VERSION,
    revision: input.revision,
    commanders: commanders.map((c) => c.card.card),
    colorIdentity: [
      ...new Set(commanders.flatMap((c) => c.card.card.colorIdentity)),
    ],
    primaryArchetypes: primary,
    secondaryArchetypes: secondary,
    commanderMechanics: commanders.flatMap((c) => [
      ...c.card.assignments.map((a) => ({
        tag: a.tagId,
        label: tagDefinition(a.tagId)?.label || a.tagId,
        weight: ["strategy", "payoff", "enabler"].includes(
          tagDefinition(a.tagId)?.category || "",
        )
          ? 1
          : 0.5,
        evidence: a.evidence,
      })),
      ...c.receivers.map((r) => ({
        tag: `trigger:${r.event}`,
        label: `${r.event} trigger`,
        weight: 1,
        evidence: [r.evidence],
      })),
      ...cardKeywords(c.card.card).map((keyword) => ({
        tag: `keyword:${keyword}`,
        label: keyword,
        weight: 0.4,
        evidence: [
          {
            field: "keywords",
            snippet: keyword,
            reason: "Canonical Commander keyword.",
          },
        ],
      })),
      ...(/:/i.test(c.text)
        ? [
            {
              tag: "activated-ability",
              label: "Activated ability",
              weight: 0.8,
              evidence: [
                evidence(
                  c.text,
                  "Commander activated ability; costs and referenced objects remain in evidence.",
                ),
              ],
            },
          ]
        : []),
    ]),
    commanderSynergyTags: commanders.flatMap((c) => c.receivers),
    creatureTypes: typeWeights,
    mechanicalThemes: weighted.filter((w) => !w.tag.startsWith("typal:")),
    roleNeeds,
    manaCurve: {
      buckets,
      nonlands,
      average: manaSum / Math.max(1, nonlands),
      commanderCost: Math.max(
        0,
        ...commanders.map((c) => c.card.card.manaValue),
      ),
      rampCount: roleNeeds.ramp.count,
      coloredPips: pips,
    },
    cardTypeDistribution: distribution,
    synergyPackages,
    powerBaseline: median(
      main.filter((c) => !c.roles.has("lands")).map((c) => c.quality),
    ),
    tribalDensity: dominantTribe?.weight || typeWeights[0]?.weight || 0,
    primaryCreatureType: dominantTribe?.tag.slice(6),
    cards,
  };
  performance.measure("mtg:strategy-profile", {
    start,
    end: performance.now(),
  });
  return profile;
}
function staticTypeSupport(
  owner: Characteristics,
  type: string,
  recipient: Characteristics,
): string | undefined {
  const pattern = creatureTypePatterns.find((p) => p.type === type);
  return owner.text
    .split(/[.\n]/)
    .map((clause) => clause.trim())
    .find((clause) => {
      if (
        /^(?:when|whenever|at the beginning)/i.test(clause) ||
        !pattern?.reference.test(clause)
      )
        return false;
      if (
        /\bToken\b/.test(recipient.card.card.typeLine) &&
        /spells?[^.\n]{0,35}(?:cast|cost)/i.test(clause)
      )
        return false;
      return /\bcost|\bgets?|\bhave|\bgain|\bsearch|\bput/i.test(clause);
    });
}
function objectSupport(
  owner: Characteristics,
  wanted: string[],
  recipient: Characteristics,
): boolean {
  const own = recipient.card.card.typeLine.split("—")[0];
  return owner.text.split(/[.\n]/).some((clause) => {
    const effect = /^(?:when|whenever|at the beginning)/i.test(clause.trim())
      ? clause.slice(clause.indexOf(",") + 1)
      : clause;
    if (!/cost|search|put|equip|attach|gets?|have|gain|copy|add/i.test(effect))
      return false;
    if (/noncreature/i.test(effect) && /Creature/.test(own)) return false;
    if (
      /nontoken|spells?[^.\n]{0,35}(?:cast|cost)/i.test(effect) &&
      /Token/.test(own)
    )
      return false;
    const limit = /mana value (\d+) or less/i.exec(effect);
    if (limit && recipient.card.card.manaValue > Number(limit[1])) return false;
    return wanted.some(
      (object) =>
        new RegExp(`\\b${object}(?:s)?\\b`, "i").test(effect) &&
        (/spell|cast|cost/i.test(effect)
          ? new RegExp(`\\b${object}\\b`, "i").test(own)
          : recipient.emits.has(object)),
    );
  });
}
function amplifiesCommander(
  c: Characteristics,
  cmdr: Characteristics,
): boolean {
  if (
    !/trigger[^.\n]{0,110}(?:additional time|twice)|copy target triggered ability/i.test(
      c.text,
    )
  )
    return false;
  const constrained = c.card.analysis.creatureTypes.synergy;
  if (
    constrained.length &&
    !constrained.some((type) => cmdr.types.includes(type))
  )
    return false;
  const event = /enter(?:s|ing|ed)?/i.test(c.text)
    ? "enters"
    : /cast/i.test(c.text)
      ? "cast"
      : null;
  const object =
    /if an? (artifact|creature|land|enchantment)[^.\n]{0,20}entering/i
      .exec(c.text)?.[1]
      ?.toLowerCase();
  return cmdr.receivers.some(
    (r) =>
      r.event !== "turn" &&
      (!event || r.event === event) &&
      (!object ||
        r.objects.some((o) => o.toLowerCase() === object) ||
        (object === "creature" && r.creatureTypes.length > 0)),
  );
}
export function scoreBand(score: number) {
  return score >= 90
    ? "Exceptional Fit"
    : score >= 80
      ? "Excellent Fit"
      : score >= 70
        ? "Strong Fit"
        : score >= 60
          ? "Good Fit"
          : score >= 50
            ? "Situational"
            : score >= 40
              ? "Weak Fit"
              : score >= 25
                ? "Poor Fit"
                : "Not Recommended";
}
const scoreCaches = new Map<DeckStrategyProfile, Map<string, StrategyScore>>();
export function scoreStrategyCard(
  profile: DeckStrategyProfile,
  input: DnaInputCard,
): StrategyScore {
  const key = JSON.stringify([
    SYNERGY_VERSION,
    input.identity,
    input.card.name,
    input.card.typeLine,
    input.card.oracleText,
    input.card.cardFaces,
    input.card.keywords,
    input.card.manaValue,
    input.card.manaCost,
    input.card.power,
    input.card.toughness,
    input.card.producedMana,
    input.assignments,
  ]); // Canonical characteristics only: never price, printing, ownership or quantity.
  let cache = scoreCaches.get(profile);
  if (!cache) {
    cache = new Map();
    scoreCaches.set(profile, cache);
    if (scoreCaches.size > 4)
      scoreCaches.delete(scoreCaches.keys().next().value!);
  }
  const cached = cache.get(key);
  if (cached) return cached;
  const c = characteristics(input),
    interactions: string[] = [],
    packageInteractions: string[] = [],
    reasons: string[] = [];
  let commanderStrength = 0;
  for (const cmdr of profile.cards.filter((c) => c.card.commander)) {
    for (const receiver of cmdr.receivers) {
      const strength = interaction(receiver, c);
      if (strength > commanderStrength) commanderStrength = strength;
      if (strength > 0)
        interactions.push(
          `${strength >= 0.8 ? "Direct interaction" : "Weak potential interaction"}: ${input.card.name} supports ${cmdr.card.card.name}: ${receiver.evidence.snippet}`,
        );
    }
    for (const receiver of c.receivers) {
      const strength = interaction(receiver, cmdr);
      if (strength > commanderStrength) commanderStrength = strength;
      if (strength > 0)
        interactions.push(
          `${strength >= 0.8 ? "Direct interaction" : "Weak potential interaction"}: ${cmdr.card.card.name} supports ${input.card.name}: ${receiver.evidence.snippet}`,
        );
    }
    const blinkOwnEtb =
      input.assignments.some((a) => a.tagId === "blink") &&
      cmdr.receivers.some((r) => r.selfOnly && r.event === "enters");
    const equipment =
      /Equipment/.test(input.card.typeLine) ||
      (/Aura/.test(input.card.typeLine) &&
        /enchant (?:creature|permanent)/i.test(c.text));
    const combatSupport =
      cmdr.receivers.some(
        (r) => r.selfOnly && ["attacks", "combat-damage"].includes(r.event),
      ) &&
      (equipment ||
        /target creature[^.\n]{0,45}gains?[^.\n]{0,45}(?:hexproof|indestructible|haste|double strike)/i.test(
          c.text,
        ));
    if (blinkOwnEtb || combatSupport) {
      commanderStrength = Math.max(commanderStrength, blinkOwnEtb ? 0.9 : 0.8);
      interactions.push(
        `${blinkOwnEtb ? "Reuses the Commander’s own ETB ability" : "Supports the Commander’s combat ability"}: ${cmdr.card.card.name}; review target restrictions.`,
      );
    }
    const doublesTrigger = amplifiesCommander(c, cmdr);
    const copiesCommander =
      /copy of[^.\n]{0,100}(?:creature|permanent)/i.test(c.text) &&
      /(?:isn.t|not) legendary/i.test(c.text);
    const untapsCommander =
      input.assignments.some((a) => a.tagId === "untap") &&
      /\{T\}[^.\n]*:/i.test(cmdr.text);
    if (doublesTrigger || copiesCommander || untapsCommander) {
      commanderStrength = Math.max(commanderStrength, doublesTrigger ? 1 : 0.8);
      interactions.push(
        `${doublesTrigger ? "Additional triggered abilities" : copiesCommander ? "Nonlegendary copy support" : "Untap support"} for ${cmdr.card.card.name}; review the printed conditions.`,
      );
    }
    for (const a of cmdr.card.assignments) {
      if (
        a.tagId.startsWith("typal:") &&
        c.types.includes(a.tagId.slice(6)) &&
        staticTypeSupport(cmdr, a.tagId.slice(6), c)
      ) {
        commanderStrength = Math.max(commanderStrength, 0.85);
        interactions.push(
          `Receives ${a.tagId.slice(6)}-specific support from ${cmdr.card.card.name}: ${staticTypeSupport(cmdr, a.tagId.slice(6), c)}`,
        );
      }
    }
    const supplied: Record<string, string[]> = {
      artifacts: ["artifact"],
      enchantments: ["enchantment"],
      voltron: ["equipment", "aura"],
      lands: ["land"],
      spells: ["instant", "sorcery"],
    };
    for (const [family, wanted] of Object.entries(supplied))
      if (
        (cmdr.features.get(family) || 0) >= 1 &&
        objectSupport(cmdr, wanted, c)
      ) {
        commanderStrength = Math.max(commanderStrength, 0.8);
        interactions.push(
          `Supplies objects explicitly supported by ${cmdr.card.card.name}: ${label(family)}.`,
        );
      }
    if (
      cmdr.card.assignments.some((a) => a.tagId === "blink") &&
      (c.features.get("blink") || 0) > 0.8
    ) {
      commanderStrength = Math.max(commanderStrength, 0.9);
      interactions.push(
        `Reusable creature ETB effect for ${cmdr.card.card.name}'s blink ability.`,
      );
    }
    if (
      cmdr.card.assignments.some((a) =>
        ["reanimator", "recursion"].includes(a.tagId),
      ) &&
      (c.features.get("graveyard") || 0) >= 1
    ) {
      commanderStrength = Math.max(commanderStrength, 0.8);
      interactions.push(`Supports ${cmdr.card.card.name}'s graveyard engine.`);
    }
    if (
      cmdr.card.assignments.some((a) =>
        ["proliferate", "counter-payoff"].includes(a.tagId),
      ) &&
      (c.features.get("counters") || 0) > 0
    ) {
      const payoff = input.assignments.some((a) =>
        ["counter-payoff", "proliferate"].includes(a.tagId),
      );
      commanderStrength = Math.max(commanderStrength, payoff ? 0.9 : 0.55);
      interactions.push(
        `Provides ${payoff ? "counter amplification" : "counter resources"} for ${cmdr.card.card.name}.`,
      );
    }
    for (const type of cmdr.types)
      if (
        input.assignments.some((a) => a.tagId === `typal:${type}`) &&
        staticTypeSupport(c, type, cmdr)
      ) {
        commanderStrength = Math.max(commanderStrength, 0.85);
        interactions.push(
          `Explicit ${type} support also benefits Commander ${cmdr.card.card.name}: ${staticTypeSupport(c, type, cmdr)}`,
        );
      }
  }
  const commanderSynergy = Math.round(Math.min(30, commanderStrength * 30));
  const matches = profile.primaryArchetypes
    .map((w) => ({ w, strength: c.features.get(w.tag) || 0 }))
    .filter((m) => m.strength > 0);
  const peak = Math.max(0, ...matches.map((m) => m.strength * m.w.weight));
  let archetypeFit = Math.round(
    Math.min(25, 25 * peak + Math.min(3, Math.max(0, matches.length - 1))),
  );
  if (
    profile.primaryArchetypes.some((p) => p.tag === "goodstuff") &&
    c.roles.size &&
    c.quality >= 6
  )
    archetypeFit = Math.round(c.quality * 2);
  if (
    commanderSynergy >= 24 &&
    interactions.some((r) =>
      /Additional triggered abilities|Nonlegendary copy support|Untap support|Reuses the Commander|Supports the Commander.s combat/.test(
        r,
      ),
    ) &&
    profile.primaryArchetypes.some((p) => p.tag !== "goodstuff")
  ) {
    archetypeFit = Math.max(20, archetypeFit);
    reasons.push("Commander engine support");
  }
  for (const m of matches)
    reasons.push(
      `${m.w.label}${m.strength >= 1 ? " engine / payoff" : " support"}`,
    );
  if (commanderSynergy >= 20) reasons.unshift("Direct Commander interaction");
  const needed = [...c.roles]
    .map((role) => ({ role, need: profile.roleNeeds[role] }))
    .filter((r) => r.need.deficit > 0)
    .sort((a, b) => b.need.deficit - a.need.deficit);
  const roleNeed = Math.round(15 * (needed[0]?.need.deficit || 0));
  if (needed[0])
    reasons.push(
      `Needed ${roleLabels[needed[0].role]} (${needed[0].need.count}/${needed[0].need.target})`,
    );
  let packageStrength = 0;
  for (const pack of profile.synergyPackages) {
    const strength = c.features.get(pack.tag) || 0;
    if (strength >= 0.8) {
      packageStrength = Math.max(
        packageStrength,
        strength * Math.min(1, pack.members.length / 3),
      );
      packageInteractions.push(
        `${pack.label}: ${pack.members.slice(0, 4).join(", ")}`,
      );
    }
  }
  // Cross-card ETB/trigger packages require an actual ability relationship, not merely shared ETB tags.
  const linked = profile.cards.filter(
    (other) =>
      !other.card.commander &&
      other.card.identity !== input.identity &&
      other.receivers.some((r) => interaction(r, c) >= 0.8),
  );
  if (linked.length >= 2) {
    packageStrength = 1;
    packageInteractions.push(
      `Triggered-ability package: ${linked
        .slice(0, 4)
        .map((other) => other.card.card.name)
        .join(", ")}`,
    );
  }
  if (
    profile.cards.filter((other) => amplifiesCommander(c, other)).length >= 1
  ) {
    const count = profile.cards.filter((other) =>
      amplifiesCommander(c, other),
    ).length;
    packageStrength = Math.max(packageStrength, Math.min(1, count / 3));
    packageInteractions.push(
      `Amplifies compatible triggered abilities on ${count} saved deck cards.`,
    );
  }
  const packageMatch = Math.round(10 * packageStrength),
    cardQuality = Math.min(
      10,
      Math.max(
        0,
        c.quality +
          (c.quality >= profile.powerBaseline + 2 && archetypeFit > 0 ? 1 : 0) -
          (c.quality + 2 < profile.powerBaseline &&
          input.card.manaValue >= profile.manaCurve.average
            ? 1
            : 0),
      ),
    );
  const generic = new Set(
    input.assignments
      .filter((a) => genericTags.has(a.tagId))
      .map((a) => a.tagId),
  );
  const deckGeneric = new Set(
    profile.cards.flatMap((c) =>
      c.card.assignments
        .filter((a) => genericTags.has(a.tagId))
        .map((a) => a.tagId),
    ),
  );
  const genericOverlap = Math.min(
    5,
    [...generic].filter((tag) => deckGeneric.has(tag)).length,
  );
  const bucket = Math.min(7, Math.floor(input.card.manaValue)),
    density =
      (profile.manaCurve.buckets[bucket] || 0) /
      Math.max(1, profile.manaCurve.nonlands);
  const demanding =
    (input.card.manaCost?.match(/[WUBRG]/g) || []).length >= 4 &&
    profile.roleNeeds.manaFixing.deficit > 0.4;
  let curveFit = c.roles.has("lands")
    ? profile.roleNeeds.lands.deficit > 0
      ? 5
      : 1
    : Math.max(
        0,
        5 -
          (density > 0.3 ? 2 : 0) -
          (input.card.manaValue >= 6 && profile.roleNeeds.ramp.deficit > 0.3
            ? 2
            : 0) -
          (demanding ? 2 : 0) -
          (profile.manaCurve.commanderCost >= 5 &&
          input.card.manaValue >= profile.manaCurve.commanderCost &&
          profile.roleNeeds.ramp.deficit > 0.5
            ? 1
            : 0),
      );
  if (profile.manaCurve.nonlands === 0 && !c.roles.has("lands")) curveFit = 2;
  const penalties: SynergyScoreDebug["penalties"] = [];
  const penalize = (name: string, value: number, reason: string) => {
    if (/anti-synergy|engine conflict/i.test(name))
      value = Math.min(
        value,
        25 -
          penalties
            .filter((p) => /anti-synergy|engine conflict/i.test(p.name))
            .reduce((n, p) => n - p.value, 0),
      );
    if (value > 0) penalties.push({ name, value: -Math.round(value), reason });
  };
  const isCreature = /\bCreature\b/.test(input.card.typeLine.split("—")[0]);
  const exceptionalUtility =
    (c.quality >= 8 &&
      (needed.length > 0 ||
        c.roles.has("tutors") ||
        c.roles.has("protection"))) ||
    commanderSynergy >= 20 ||
    (archetypeFit >= 20 &&
      (!profile.primaryCreatureType ||
        (c.features.get(`typal:${profile.primaryCreatureType}`) || 0) >= 0.8));
  if (
    isCreature &&
    profile.primaryCreatureType &&
    !c.types.includes(profile.primaryCreatureType) &&
    !input.assignments.some(
      (a) => a.tagId === `typal:${profile.primaryCreatureType}`,
    ) &&
    !exceptionalUtility
  )
    penalize(
      "Off-archetype creature",
      Math.min(20, profile.tribalDensity * 18),
      `Non-${profile.primaryCreatureType} creature without exceptional utility or a direct engine interaction.`,
    );
  const dependent = profile.commanderSynergyTags.some(
    (r) => r.event !== "turn",
  );
  if (
    dependent &&
    commanderSynergy === 0 &&
    archetypeFit < 15 &&
    !exceptionalUtility
  )
    penalize(
      "No Commander interaction",
      8,
      "No supported interaction with the Commander’s referenced objects or actions.",
    );
  const redundant = [...c.roles].filter(
    (role) =>
      profile.roleNeeds[role].target > 0 &&
      profile.roleNeeds[role].count > profile.roleNeeds[role].target * 1.25,
  );
  if (redundant.length && archetypeFit < 20)
    penalize(
      "Redundant role",
      Math.min(8, 3 + redundant.length * 2),
      `${redundant.map((r) => `${roleLabels[r]} ${profile.roleNeeds[r].count}/${profile.roleNeeds[r].target}`).join(", ")} already exceeds the contextual target.`,
    );
  if (density > 0.25 && !c.roles.has("lands"))
    penalize(
      "Curve congestion",
      Math.min(8, (density - 0.2) * 20),
      `Crowded ${input.card.manaValue >= 7 ? "7+" : Math.floor(input.card.manaValue)}-mana slot (${Math.round(density * 100)}% of nonlands).`,
    );
  if (input.card.manaValue >= 4 && cardQuality <= 4 && c.effects <= 1)
    penalize(
      "Low impact for mana value",
      Math.min(10, (input.card.manaValue - 2) * 2),
      "Saved effect evidence is limited relative to its mana cost.",
    );
  const graveyard =
    profile.primaryArchetypes.some((p) => p.tag === "graveyard") ||
    profile.secondaryArchetypes.some(
      (p) => p.tag === "graveyard" && p.weight > 0.4,
    );
  const ownGraveyardConflict = c.text.split(/[.\n]/).some((clause) => {
    if (
      /opponent(?:s|['’]s|s['’])? graveyard/i.test(clause) &&
      !/all graveyards|your graveyard/i.test(clause)
    )
      return false;
    return /exile (?:all|each)[^.\n]{0,65}(?:graveyard|graveyards)|(?:card|permanent)[^.\n]{0,70}graveyard[^.\n]{0,40}exile it instead/i.test(
      clause,
    );
  });
  if (graveyard && ownGraveyardConflict)
    penalize(
      "Graveyard anti-synergy",
      25,
      "Exiles or replaces your graveyard resources used by this deck.",
    );
  if (
    profile.cardTypeDistribution.Artifact /
      Math.max(1, profile.manaCurve.nonlands) >
      0.3 &&
    /(?:destroy|exile) all artifacts(?:[.,\n]|$| and)/i.test(c.text) &&
    !/artifacts (?:you don.t control|your opponents control)/i.test(c.text)
  )
    penalize(
      "Artifact anti-synergy",
      25,
      "Removes your own artifact engine alongside opposing artifacts.",
    );
  if (
    profile.cardTypeDistribution.Creature /
      Math.max(1, profile.manaCurve.nonlands) >
      0.6 &&
    /(?:destroy|exile) all creatures(?:[.,\n]|$| and)/i.test(c.text) &&
    !/creatures (?:you don.t control|your opponents control)/i.test(c.text) &&
    !profile.primaryArchetypes.some((p) =>
      ["graveyard", "sacrifice"].includes(p.tag),
    )
  )
    penalize(
      "Creature-engine conflict",
      15,
      "Clears the creature board this deck depends on; consider the reset cost.",
    );
  const components = [
    { label: "Commander synergy", points: commanderSynergy },
    { label: "Primary strategy", points: archetypeFit },
    { label: "Needed role", points: roleNeed },
    { label: "Synergy packages", points: packageMatch },
    { label: "Card quality / efficiency", points: cardQuality },
    { label: "Generic overlap", points: genericOverlap },
    { label: "Curve fit", points: curveFit },
    ...penalties.map((p) => ({ label: p.name, points: p.value })),
  ];
  const rawScore = components.reduce((n, c) => n + c.points, 0),
    score = Math.max(0, Math.min(100, rawScore));
  const debug: SynergyScoreDebug = {
    cardId: input.identity,
    version: SYNERGY_VERSION,
    profileRevision: profile.revision,
    commanderSynergy,
    archetypeFit,
    roleNeed,
    packageMatch,
    cardQuality,
    genericOverlap,
    curveFit,
    penalties,
    matchedTags: matches.map((m) => m.w.tag),
    commanderInteractions: interactions,
    packageInteractions,
    componentReasons: [
      {
        label: "Commander synergy",
        reason:
          interactions.join(" ") ||
          "No evidenced direct Commander interaction.",
      },
      {
        label: "Primary strategy",
        reason:
          matches
            .map(
              (m) =>
                `${m.w.label}: candidate support ${m.strength.toFixed(2)} × deck weight ${m.w.weight.toFixed(2)}`,
            )
            .join("; ") || "No primary-archetype match.",
      },
      {
        label: "Needed role",
        reason:
          needed
            .map(
              (r) =>
                `${roleLabels[r.role]} ${r.need.count}/${r.need.target}; ${Math.round(r.need.deficit * 100)}% deficit`,
            )
            .join("; ") || "Candidate roles do not fill an identified deficit.",
      },
      {
        label: "Synergy packages",
        reason:
          packageInteractions.join("; ") || "No established matching package.",
      },
      {
        label: "Card quality / efficiency",
        reason: `Mana value ${input.card.manaValue}; ${c.effects} recorded supporting effects; ${c.repeatable ? "repeatable/ongoing" : "no repeatability evidence"}; local efficiency baseline ${profile.powerBaseline}/10.`,
      },
      {
        label: "Generic overlap",
        reason:
          [...generic].filter((tag) => deckGeneric.has(tag)).join(", ") ||
          "No generic overlap points.",
      },
      {
        label: "Curve fit",
        reason: `${Math.round(density * 100)}% of nonlands in this mana slot; deck average ${profile.manaCurve.average.toFixed(1)}, Commander cost ${profile.manaCurve.commanderCost}; ramp ${profile.roleNeeds.ramp.count}/${profile.roleNeeds.ramp.target}${demanding ? "; demanding colored cost with fixing deficit" : ""}.`,
      },
    ],
    rawScore,
    finalScore: score,
  };
  const conflicts = penalties.map((p) => p.reason);
  const explanation =
    score >= 50
      ? `Supports ${reasons.slice(0, 3).join(" · ") || "the measured role needs"} in this deck.`
      : matches.length
        ? `Limited fit: ${matches.map((m) => m.w.label).join(" · ")}. ${conflicts[0] || "Insufficient direct interaction or unmet role need for a recommendation."}`
        : `Poor fit: does not support the primary ${profile.primaryArchetypes.map((p) => p.label).join(" / ") || "saved"} strategy. ${conflicts[0] || "Any utility is limited to the roles shown below."}`;
  const result: StrategyScore = {
    score,
    band: scoreBand(score),
    tier:
      score >= 70
        ? "Recommended"
        : score >= 50
          ? "Worth Considering"
          : "Other Legal Cards",
    components,
    debug,
    roles: [...c.roles].map((r) => roleLabels[r]),
    reasons,
    conflicts,
    explanation,
  };
  cache.set(key, result);
  if (cache.size > 10000) cache.delete(cache.keys().next().value!);
  return result;
}
