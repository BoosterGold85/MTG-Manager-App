// Optional AI layer for the Upgrade Selector. No provider is configured in the app, so nothing here
// calls a paid API. The prompt is grounded in oracle text and the computed scores only, and the response
// is validated against the exact deck and candidate names it was given.
import type { SelectorCard, SelectorResult } from "./scoring";
import { AXIS_LABELS, CREATIVITY_AXES } from "./scoring";

export interface AiMessages {
  system: string;
  user: string;
}

export interface AiReviewProvider {
  complete(messages: AiMessages): Promise<unknown>;
}

export interface AiReview {
  theme: string;
  swaps: { out: string; in: string; reason: string }[];
  nicheGem: { name: string; steps: string[] } | null;
  howItPlays: string;
}

export type AiReviewOutcome =
  | { status: "not-configured" }
  | { status: "ok"; review: AiReview }
  | { status: "rejected"; reason: string };

const SYSTEM = [
  "You review a Magic: The Gathering Commander deck.",
  "Use only the oracle text and scores provided. Do not use outside knowledge of card power, popularity or prices.",
  "Name only cards from the provided deck list (for swaps 'out') and the provided candidate list (for swaps 'in' and the niche gem).",
  "Return only JSON with keys: theme (string), swaps (array of {out, in, reason}), nicheGem ({name, steps: string[]} or null), howItPlays (string).",
].join(" ");

const oneLine = (card: SelectorCard) => `${card.name} [${card.typeLine}] — ${card.oracleText.replace(/\s+/g, " ").trim() || "(no rules text)"}`;

/** Builds the messages for the provider from computed results only. Returns names so validation can check them. */
export function buildAiPrompt(params: {
  deckName: string;
  deckCards: SelectorCard[];
  result: SelectorResult;
}): { messages: AiMessages; allowed: { deckNames: Set<string>; candidateNames: Set<string> } } {
  const top = params.result.top.slice(0, 10);
  const deckNames = new Set(params.deckCards.map((c) => c.name));
  const candidateNames = new Set(top.map((row) => row.card.name));
  const engine = params.result.engine.patterns.map((p) => p.label).join(", ") || "none detected";
  const scoreLine = (row: { card: SelectorCard; score: { axes: Record<string, number>; total: number } }) =>
    `${row.card.name}: total ${row.score.total}/15 (${CREATIVITY_AXES.map((axis) => `${AXIS_LABELS[axis]} ${row.score.axes[axis]}`).join(", ")})`;
  const user = [
    `Deck: ${params.deckName}`,
    `Detected engine: ${engine}`,
    "",
    "Deck list (oracle text):",
    ...params.deckCards.map(oneLine),
    "",
    "Top candidates with scores (oracle text):",
    ...top.map((row) => `${scoreLine(row)}\n  ${oneLine(row.card)}`),
  ].join("\n");
  return { messages: { system: SYSTEM, user }, allowed: { deckNames, candidateNames } };
}

const isString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 600;

/** Strict validation: unknown names, missing keys or oversized text reject the whole response. */
export function parseAiReview(raw: unknown, allowed: { deckNames: Set<string>; candidateNames: Set<string> }): AiReview | string {
  if (!raw || typeof raw !== "object") return "The reply was not an object.";
  const r = raw as Record<string, unknown>;
  if (!isString(r.theme)) return "The reply has no theme.";
  if (!Array.isArray(r.swaps) || r.swaps.length > 10) return "The reply has no valid swap list.";
  const swaps: AiReview["swaps"] = [];
  for (const swap of r.swaps as Record<string, unknown>[]) {
    if (!swap || typeof swap !== "object") return "A swap is not an object.";
    if (typeof swap.out !== "string" || !allowed.deckNames.has(swap.out)) return `Swap cuts a card not in the deck: ${String(swap.out)}.`;
    if (typeof swap.in !== "string" || !allowed.candidateNames.has(swap.in)) return `Swap adds a card not in the candidates: ${String(swap.in)}.`;
    if (!isString(swap.reason)) return "A swap has no reason.";
    swaps.push({ out: swap.out, in: swap.in, reason: swap.reason });
  }
  let nicheGem: AiReview["nicheGem"] = null;
  if (r.nicheGem !== null && r.nicheGem !== undefined) {
    const gem = r.nicheGem as Record<string, unknown>;
    if (typeof gem.name !== "string" || !allowed.candidateNames.has(gem.name)) return "The niche gem is not a candidate.";
    if (!Array.isArray(gem.steps) || gem.steps.length < 1 || gem.steps.length > 8 || !gem.steps.every(isString)) return "The niche gem has no valid steps.";
    nicheGem = { name: gem.name, steps: gem.steps as string[] };
  }
  if (!isString(r.howItPlays)) return "The reply has no play summary.";
  return { theme: r.theme, swaps, nicheGem, howItPlays: r.howItPlays };
}

/** Runs the review when a provider is configured. With no provider the app makes no request at all. */
export async function runAiReview(
  provider: AiReviewProvider | null,
  prompt: { messages: AiMessages; allowed: { deckNames: Set<string>; candidateNames: Set<string> } },
): Promise<AiReviewOutcome> {
  if (!provider) return { status: "not-configured" };
  try {
    const parsed = parseAiReview(await provider.complete(prompt.messages), prompt.allowed);
    return typeof parsed === "string" ? { status: "rejected", reason: parsed } : { status: "ok", review: parsed };
  } catch {
    return { status: "rejected", reason: "The AI review could not be completed. Computed results are unaffected." };
  }
}
