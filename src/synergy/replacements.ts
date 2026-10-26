import type { CardSynergy, DeckDna } from "../dna/engine";
import { RECOMMENDATION_LIMITS, recommendationProfile } from "./recommendation";
export interface ReplacementCandidate {
  identity: string;
  name: string;
  delta: number;
  reasons: string[];
  confidence: "High" | "Medium";
}
/** Suggestions only. Never writes a deck, changes quantities or moves a copy. */
export function suggestReplacements(
  candidate: CardSynergy,
  dna: DeckDna,
): ReplacementCandidate[] {
  const data = candidate.recommendation;
  if (!data || data.confidence === "Low" || candidate.score < 50) return [];
  const typed = recommendationProfile(dna.strategyProfile);
  const isLand = data.facts.faces.some((f) => f.cardTypes.includes("Land"));
  const ownTypes = new Set(data.facts.faces.flatMap((f) => f.creatureTypes));
  const ownRoles = new Set(data.typedRoles);
  return dna.strategyProfile.cards
    .flatMap((existing) => {
      if (
        existing.card.commander ||
        existing.card.identity === candidate.identity
      )
        return [];
      const score = dna.cards[existing.card.identity],
        facts = typed.facts.get(existing.card.identity);
      if (
        !score?.recommendation ||
        !facts ||
        score.recommendation.confidence === "Low"
      )
        return [];
      // Preserve land count, and never propose sacrificing an uncovered essential role.
      if (facts.faces.some((f) => f.cardTypes.includes("Land")) !== isLand)
        return [];
      const critical = typed.roles.get(existing.card.identity) || {};
      const candidateRoles = candidate.roles;
      for (const role of [
        "removal",
        "ramp",
        "cardAdvantage",
        "protection",
        "lands",
        "manaFixing",
      ] as const) {
        const labels = {
          removal: "Removal",
          ramp: "Ramp",
          cardAdvantage: "Card advantage",
          protection: "Protection",
          lands: "Lands",
          manaFixing: "Mana fixing",
        };
        if (
          critical[role] &&
          typed.roleNeeds[role].count <= typed.roleNeeds[role].target &&
          !candidateRoles.includes(labels[role])
        )
          return [];
      }
      const sharedRoles = score.recommendation.typedRoles.filter((r) =>
        ownRoles.has(r),
      );
      const sharedType = facts.faces.some((f) =>
        f.creatureTypes.some(
          (t) =>
            ownTypes.has(t) ||
            data.facts.faces.some((face) => face.hasChangeling),
        ),
      );
      const sharedFunction = score.roles.some((r) =>
        candidate.roles.includes(r),
      );
      const distance = Math.abs(
        existing.card.card.manaValue - data.facts.manaValue,
      );
      const delta = candidate.score - score.score;
      if (
        delta < RECOMMENDATION_LIMITS.materialSwapDelta ||
        (!sharedRoles.length && !sharedType && !sharedFunction) ||
        distance > 3
      )
        return [];
      const reasons = [
        sharedRoles.length
          ? `Shares typed functions: ${sharedRoles
              .slice(0, 3)
              .map((r) => r.replaceAll("_", " "))
              .join(", ")}.`
          : sharedType
            ? "Preserves a relevant creature-type slot."
            : "Provides overlapping functional roles.",
        `Mana values ${existing.card.card.manaValue} → ${data.facts.manaValue}; local Synergy ${score.score} → ${candidate.score} (+${delta}).`,
      ];
      if (
        candidate.recommendation!.commander.score >
        score.recommendation.commander.score
      )
        reasons.push(
          "Stronger verified Commander interaction in the current profile.",
        );
      if (
        score.debug.penalties.some((p) =>
          /redundan|duplicate|congestion/.test(p.name),
        )
      )
        reasons.push(
          "The current card has a resolved redundancy or curve concern.",
        );
      return [
        {
          identity: existing.card.identity,
          name: existing.card.card.name,
          delta,
          reasons,
          confidence:
            data.confidence === "High" &&
            score.recommendation.confidence === "High"
              ? ("High" as const)
              : ("Medium" as const),
          priority:
            sharedRoles.length * 5 +
            (sharedType ? 3 : 0) +
            (3 - distance) +
            delta / 10,
        },
      ];
    })
    .sort(
      (a, b) => b.priority - a.priority || a.name.localeCompare(b.name, "en"),
    )
    .slice(0, 3)
    .map(({ identity, name, delta, reasons, confidence }) => ({
      identity,
      name,
      delta,
      reasons,
      confidence,
    }));
}
