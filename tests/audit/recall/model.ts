export const FAILURE_CATEGORIES = {
  A: "Candidate generation",
  B: "Semantic extraction",
  C: "Interaction matching",
  D: "Condition supply",
  E: "Role / strategy",
  F: "Scoring",
  G: "Ranking",
  H: "Expectation",
} as const;
export type FailureCategory = keyof typeof FAILURE_CATEGORIES;
export interface FailureReview {
  deck: string;
  candidate: string;
  primary: FailureCategory;
  rationale: string;
  evidence: string[];
}
export interface FixedDeck {
  id: string;
  theme: string;
  commander: string;
  provenance: string;
  cards: { name: string; quantity: number; commander?: boolean }[];
  obvious: string[];
  hidden: string[];
  traps: string[];
}
/** Unknown precision labels cannot silently count as good recommendations. */
export const PRECISION_LABELS = [
  "Excellent contextual fit",
  "Good obvious fit",
  "Interesting / debatable",
  "Weak",
  "False positive",
] as const;
export type PrecisionLabel = (typeof PRECISION_LABELS)[number];
export function precisionBounds(
  labels: (PrecisionLabel | null)[],
  denominator: number,
) {
  if (
    !Number.isInteger(denominator) ||
    denominator <= 0 ||
    labels.length !== denominator
  )
    throw new Error("Precision needs a complete ranked result sheet");
  if (
    labels.some((label) => label !== null && !PRECISION_LABELS.includes(label))
  )
    throw new Error("Unknown precision label");
  const good = labels.filter(
    (l) => l === "Excellent contextual fit" || l === "Good obvious fit",
  ).length;
  const pending = labels.filter((l) => l === null).length;
  return {
    lower: good / denominator,
    upper: (good + pending) / denominator,
    reviewed: labels.length - pending,
    pending,
    denominator,
    pointEstimate: pending ? null : good / denominator,
  };
}
export function classificationCounts(
  missed: { deck: string; candidate: string }[],
  reviews: FailureReview[],
) {
  const counts = Object.fromEntries(
    Object.keys(FAILURE_CATEGORIES).map((k) => [k, 0]),
  ) as Record<FailureCategory, number>;
  const used = new Set<string>();
  for (const review of reviews) {
    const key = JSON.stringify([review.deck, review.candidate]);
    if (
      used.has(key) ||
      !missed.some(
        (m) => m.deck === review.deck && m.candidate === review.candidate,
      )
    )
      throw new Error("Duplicate or out-of-corpus failure review: " + key);
    if (
      !review.rationale.trim() ||
      !review.evidence.length ||
      !(review.primary in FAILURE_CATEGORIES)
    )
      throw new Error("Review needs one category, rationale and evidence");
    used.add(key);
    counts[review.primary]++;
  }
  return {
    counts,
    total: missed.length,
    reviewed: used.size,
    pending: missed.filter(
      (m) => !used.has(JSON.stringify([m.deck, m.candidate])),
    ),
    percentages: Object.fromEntries(
      Object.entries(counts).map(([k, n]) => [
        k,
        missed.length ? n / missed.length : 0,
      ]),
    ),
  };
}
