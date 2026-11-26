// Upgrade Selector: a read-only creativity ranking of owned cards for one Commander deck.
// Pure functions only. Nothing here writes a deck, moves a copy or feeds Plan Fit, Brew Score or Upgrade Value.
// Every axis is derived from canonical oracle text, keywords, type line, stats and released/EDHREC metadata.

export const SELECTOR_VERSION = "1.0.0";
/** Only cards printed before this date can earn Obscurity. */
export const OBSCURITY_CUTOFF = "2015-01-01";
/** Minimum qty-weighted deck cards carrying a pattern before it counts as an engine. */
export const MIN_ENGINE_CARDS = 3;

export interface SelectorCard {
  scryfallId: string;
  name: string;
  typeLine: string;
  oracleText: string;
  manaValue: number;
  colorIdentity: string[];
  keywords: string[];
  power?: string;
  toughness?: string;
  /** ISO date from Scryfall released_at. Absent means unknown, which never earns Obscurity. */
  releasedAt?: string;
  /** Scryfall edhrec_rank. Higher is rarer. Absent means unknown, which never earns Obscurity. */
  edhrecRank?: number | null;
}

export interface EnginePattern {
  id: EnginePatternId;
  label: string;
  test: RegExp;
  /** Patterns that can recur inside the deck. Used by the Loop axis. */
  repeatable: boolean;
}

export type EnginePatternId = "discard" | "counters" | "bounce" | "enters" | "graveyard" | "sacrifice" | "tokens";

export const ENGINE_PATTERNS: EnginePattern[] = [
  { id: "discard", label: "discard", test: /\bdiscard(?:s|ed|ing)?\b|\bmadness\b/i, repeatable: false },
  { id: "counters", label: "+1/+1 counters", test: /\+\d\/\+\d counter|-\d\/-\d counter|\bcounters? (?:on|from)\b|\bproliferate\b|\bremove [^.\n]*\bcounter/i, repeatable: true },
  {
    id: "bounce",
    label: "return to hand",
    test: /\breturns?\b[^.\n]*\bto (?:its|their|your|an?|the)?\s*(?:owner['’]?s?\s+)?hands?\b/i,
    repeatable: true,
  },
  { id: "enters", label: "enters the battlefield", test: /\benters\b|\bentered the battlefield\b/i, repeatable: true },
  { id: "graveyard", label: "graveyard", test: /\bgraveyards?\b|\bmill\b/i, repeatable: true },
  { id: "sacrifice", label: "sacrifice", test: /\bsacrifices?\b|\bsacrificed\b/i, repeatable: true },
  { id: "tokens", label: "tokens", test: /\bcreates?\b[^.\n]*\btokens?\b/i, repeatable: false },
];

/** Creativity axes, each scored 0-3. Weights default to 1, so the total is out of 15 at defaults. */
export const CREATIVITY_AXES = ["engineFit", "obscurity", "surprise", "loop", "impact"] as const;
export type CreativityAxis = (typeof CREATIVITY_AXES)[number];
export type CreativityWeights = Record<CreativityAxis, number>;
export const DEFAULT_WEIGHTS: CreativityWeights = { engineFit: 1, obscurity: 1, surprise: 1, loop: 1, impact: 1 };

export const AXIS_LABELS: Record<CreativityAxis, string> = {
  engineFit: "Engine fit",
  obscurity: "Obscurity",
  surprise: "Surprise",
  loop: "Loop potential",
  impact: "Real impact",
};

export interface CreativityScore {
  axes: Record<CreativityAxis, number>;
  /** Weighted total. At default weights this is out of 15. */
  total: number;
  maxTotal: number;
  notes: string[];
}

export interface DeckEngine {
  /** Top patterns by qty-weighted card count, at most two. Empty means no clear engine. */
  patterns: EnginePattern[];
  counts: Record<EnginePatternId, number>;
  /** True when a deck pattern can recur (bounce, counters, graveyard, enters, sacrifice). */
  repeatable: boolean;
}

export interface DeckCardInput {
  card: SelectorCard;
  quantity: number;
  commander: boolean;
}

export interface CandidateRow {
  card: SelectorCard;
  score: CreativityScore;
}

export interface SwapSuggestion {
  cut: SelectorCard;
  cutEngineFit: number;
  add: SelectorCard;
  score: CreativityScore;
}

export interface SelectorResult {
  engine: DeckEngine;
  /** Non-land, non-commander deck cards with engine fit 0. */
  deadSlots: { card: SelectorCard; engineFit: number }[];
  candidates: CandidateRow[];
  top: CandidateRow[];
  swaps: SwapSuggestion[];
  nicheGem: CandidateRow | null;
  /** Candidates skipped because their colors fall outside the commander identity. */
  outsideIdentity: number;
}

const isLand = (card: Pick<SelectorCard, "typeLine">) => /\bLand\b/.test(card.typeLine);
const isCreature = (card: Pick<SelectorCard, "typeLine">) => /\bCreature\b/.test(card.typeLine);

const SOURCE_TEXT = (card: SelectorCard) => `${card.oracleText}\n${card.keywords.join("\n")}`;

/** Engine patterns a card matches, from oracle text plus keyword lines. */
export function matchedPatterns(card: SelectorCard): Set<EnginePatternId> {
  const text = SOURCE_TEXT(card);
  return new Set(ENGINE_PATTERNS.filter((p) => p.test.test(text)).map((p) => p.id));
}

// ---- Ability parsing ----------------------------------------------------------------------

export interface ActivatedAbility {
  kind: "activated";
  cost: string;
  effect: string;
}
export interface TriggeredAbility {
  kind: "triggered";
  clause: string;
  effect: string;
}
export type Ability = ActivatedAbility | TriggeredAbility;

const oracleLines = (text: string) => text.split(/\n+/).map((line) => line.trim()).filter(Boolean);

/** Activated abilities are "cost: effect" lines. Triggered abilities start with whenever/when/at the beginning. */
export function parseAbilities(text: string): Ability[] {
  const out: Ability[] = [];
  for (const line of oracleLines(text)) {
    const activated = /^([^:]{1,200}):\s*(.+)$/.exec(line);
    if (activated && !/^(?:whenever|when|at the beginning)\b/i.test(line)) {
      out.push({ kind: "activated", cost: activated[1], effect: activated[2] });
      continue;
    }
    const triggered = /^(?:whenever|when|at the beginning)\b([^,]*),?\s*(.*)$/i.exec(line);
    if (triggered) out.push({ kind: "triggered", clause: triggered[1].trim(), effect: triggered[2].trim() });
  }
  return out;
}

const MANA_OR_TAP = /\{[^}]*\}/g;
/** A cost is a resource cost when something other than mana or tapping is paid. */
export const isResourceCost = (cost: string) => cost.replace(MANA_OR_TAP, "").replace(/\bthis\b|,|\band\b|\s+/gi, "").length > 0;
/** Effects that turn something into value. Deliberately conservative: mana, cards, tokens, counters, land, damage. */
export const isValueEffect = (effect: string) =>
  /\badd\b|\bdraws?\b|\bcreates?\b|\bsearch(?:es)?\b|\bdeals? \d+ damage|\bgains? \d+ life|\bonto the battlefield\b|\bcounters? (?:on|onto)\b|\+\d\/\+\d|\bdestroy\b|\bexile\b/i.test(effect);
const costMatches = (cost: string, ids: Set<EnginePatternId>) => ENGINE_PATTERNS.some((p) => ids.has(p.id) && p.test.test(cost));

/** Surprise: an ability spends a resource for value. Three points when the resource is the deck's own engine. */
function surpriseScore(card: SelectorCard, engine: DeckEngine): number {
  let best = 0;
  const engineIds = new Set(engine.patterns.map((p) => p.id));
  for (const ability of parseAbilities(card.oracleText)) {
    if (ability.kind === "activated") {
      if (!isResourceCost(ability.cost) || !isValueEffect(ability.effect)) continue;
      best = Math.max(best, costMatches(ability.cost, engineIds) ? 3 : 2);
    } else if (isValueEffect(ability.effect) && engineIds.size && costMatches(ability.clause, engineIds)) {
      best = Math.max(best, 2);
    }
  }
  return best;
}

/** Loop: rewards repeated actions. Trigger or enter, plus a repeatable deck engine, plus the card's loop hooking into it. */
function loopScore(card: SelectorCard, engine: DeckEngine): number {
  const engineIds = new Set(engine.patterns.map((p) => p.id));
  if (!engineIds.size) return 0;
  let points = 0;
  const abilities = parseAbilities(card.oracleText);
  const hasTrigger = /\bwhenever\b|\bwhen\b|\bat the beginning\b|\benters\b/i.test(card.oracleText);
  if (hasTrigger) points += 1;
  if (engine.repeatable) points += 1;
  const linked = abilities.some((a) =>
    a.kind === "triggered" ? costMatches(a.clause, engineIds) : !/\{T\}/.test(a.cost) && costMatches(a.cost, engineIds),
  );
  if (linked) points += 1;
  return Math.min(3, points);
}

const NUMBER_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const numeric = (value?: string) => (value && /^\d+$/.test(value) ? Number(value) : 0);
/** Real impact: body for mana value (creatures), or ability count for others. ETB +1/+1 counters count toward the body. */
export function impactScore(card: SelectorCard): number {
  const lines = oracleLines(card.oracleText);
  if (!lines.length) return 0;
  if (!isCreature(card)) return lines.length >= 2 ? 2 : 1;
  let power = numeric(card.power), toughness = numeric(card.toughness);
  const counters = /enters with (a|an|one|two|three|four|five|six|\d+) \+1\/\+1 counters?/i.exec(card.oracleText);
  if (counters) {
    const n = /^\d+$/.test(counters[1]) ? Number(counters[1]) : NUMBER_WORDS[counters[1].toLowerCase()] ?? 0;
    power += n;
    toughness += n;
  }
  const ratio = (power + toughness) / Math.max(1, card.manaValue);
  return Math.min(3, (ratio >= 1 ? 2 : ratio >= 0.5 ? 1 : 0) + (lines.length >= 2 ? 1 : 0));
}

/** Obscurity: printed before 2015 and rarely played. Unknown date or rank earns nothing. */
export function obscurityScore(card: Pick<SelectorCard, "releasedAt" | "edhrecRank">): number {
  if (!card.releasedAt || card.releasedAt >= OBSCURITY_CUTOFF) return 0;
  const rank = card.edhrecRank;
  if (rank == null) return 0;
  return rank >= 10000 ? 3 : rank >= 5000 ? 2 : rank >= 2000 ? 1 : 0;
}

/** Engine fit: the candidate reads the deck's primary engine (2), the engine in a cost or twice (3). */
export function engineFitScore(card: SelectorCard, engine: DeckEngine): number {
  if (!engine.patterns.length) return 0;
  const engineIds = new Set(engine.patterns.map((p) => p.id));
  const matched = [...matchedPatterns(card)].filter((id) => engineIds.has(id));
  if (!matched.length) return 0;
  const primary = engine.patterns[0].id;
  if (!matched.includes(primary)) return 1;
  const inCost = parseAbilities(card.oracleText).some((a) => a.kind === "activated" && isResourceCost(a.cost) && costMatches(a.cost, new Set([primary])));
  return matched.length >= 2 || inCost ? 3 : 2;
}

/** Full creativity score for one card against one deck's engine. Weights are configurable. */
export function scoreCreativity(card: SelectorCard, engine: DeckEngine, weights: CreativityWeights = DEFAULT_WEIGHTS): CreativityScore {
  const axes: Record<CreativityAxis, number> = {
    engineFit: engineFitScore(card, engine),
    obscurity: obscurityScore(card),
    surprise: surpriseScore(card, engine),
    loop: loopScore(card, engine),
    impact: impactScore(card),
  };
  const notes: string[] = [];
  if (!engine.patterns.length) notes.push("No clear engine in this deck, so engine fit and loop are 0.");
  if (card.releasedAt && card.releasedAt >= OBSCURITY_CUTOFF) notes.push(`Printed ${card.releasedAt.slice(0, 4)}: after the 2015 Obscurity cutoff.`);
  if (!card.releasedAt || card.edhrecRank == null) notes.push("Release date or EDHREC rank unavailable, so Obscurity is 0.");
  const total = CREATIVITY_AXES.reduce((sum, axis) => sum + axes[axis] * weights[axis], 0);
  const maxTotal = CREATIVITY_AXES.reduce((sum, axis) => sum + 3 * weights[axis], 0);
  return { axes, total, maxTotal, notes };
}

/** Theme detection: count pattern hits across the deck (qty-weighted). The top one or two with enough cards are the engine. */
export function detectEngine(cards: DeckCardInput[]): DeckEngine {
  const counts = Object.fromEntries(ENGINE_PATTERNS.map((p) => [p.id, 0])) as Record<EnginePatternId, number>;
  for (const { card, quantity } of cards) {
    if (isLand(card)) continue;
    for (const id of matchedPatterns(card)) counts[id] += quantity;
  }
  const ranked = ENGINE_PATTERNS.filter((p) => counts[p.id] >= MIN_ENGINE_CARDS).sort((a, b) => counts[b.id] - counts[a.id]);
  const patterns = ranked.slice(0, 2);
  return { patterns, counts, repeatable: patterns.some((p) => p.repeatable) };
}

/** Candidates must have colors inside the commander identity (canonical subset match). */
export function withinIdentity(card: Pick<SelectorCard, "colorIdentity">, identity: string[]) {
  return card.colorIdentity.every((color) => identity.includes(color));
}

export interface SelectorInput {
  deckCards: DeckCardInput[];
  /** Owned, legal candidates not already in the deck. Callers supply the pool. */
  candidates: SelectorCard[];
  commanderIdentity: string[];
  weights?: CreativityWeights;
  topCount?: number;
}

/** Runs the whole pipeline: theme, dead slots, candidate scores, swap pairs and the niche gem. */
export function findUpgradeSelections(input: SelectorInput): SelectorResult {
  const weights = input.weights ?? DEFAULT_WEIGHTS;
  const engine = detectEngine(input.deckCards);
  const deadSlots = input.deckCards
    .filter(({ card, commander }) => !commander && !isLand(card))
    .map(({ card }) => ({ card, engineFit: engineFitScore(card, engine) }))
    .filter((row) => engine.patterns.length > 0 && row.engineFit === 0)
    .sort((a, b) => a.card.name.localeCompare(b.card.name, "en"));

  const inIdentity = input.candidates.filter((card) => !isLand(card) && withinIdentity(card, input.commanderIdentity));
  const candidates = inIdentity
    .map((card) => ({ card, score: scoreCreativity(card, engine, weights) }))
    .sort((a, b) => b.score.total - a.score.total || a.card.name.localeCompare(b.card.name, "en"));

  const top = candidates.slice(0, input.topCount ?? 10);
  // Niche gem: obscurity-qualified and engine-fitting. If none qualify, there is no gem (never a forced pick).
  const nicheGem =
    candidates.find((row) => row.score.axes.obscurity >= 1 && row.score.axes.engineFit >= 2) ?? null;

  // 1-for-1 swaps: weakest dead slot paired with the best candidate that adds engine fit. Suggestions only.
  const cuts = [...deadSlots].sort((a, b) => impactScore(a.card) - impactScore(b.card) || a.card.name.localeCompare(b.card.name, "en"));
  const adds = candidates.filter((row) => row.score.axes.engineFit > 0).slice(0, cuts.length);
  const swaps: SwapSuggestion[] = adds.slice(0, cuts.length).map((row, i) => ({
    cut: cuts[i].card,
    cutEngineFit: cuts[i].engineFit,
    add: row.card,
    score: row.score,
  }));

  return {
    engine,
    deadSlots,
    candidates,
    top,
    swaps,
    nicheGem,
    outsideIdentity: input.candidates.length - inIdentity.length,
  };
}

