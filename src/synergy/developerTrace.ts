// Developer/test entry point. Not imported by application UI; tree-shaken out of production.
import type { DnaInputCard } from "../dna/engine";
import type { DeckStrategyProfile } from "../dna/strategy";
import { recommendationProfile, scoreRecommendation } from "./recommendation";
export function recommendationTrace(
  profile: DeckStrategyProfile,
  input: DnaInputCard,
) {
  const score = scoreRecommendation(profile, input),
    deck = recommendationProfile(profile);
  return {
    card: input.card.name,
    typedRoles: score.recommendation!.typedRoles,
    facts: score.recommendation!.facts,
    commander: score.recommendation!.commander,
    roleNeeds: deck.roleNeeds,
    tokenTypePriorities: deck.tokenTypePriorities,
    weakAreas: deck.weakAreas,
    saturatedAreas: deck.saturatedAreas,
    components: score.components,
    penalties: score.debug.penalties,
    gate: score.recommendation!.gate,
    confidence: score.recommendation!.confidence,
    rawScore: score.debug.rawScore,
    finalScore: score.score,
  };
}
