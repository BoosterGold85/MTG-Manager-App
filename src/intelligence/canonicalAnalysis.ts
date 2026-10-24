import type { CardMetadata, CollectionState } from "../models/collection";
import { analyze, cardIdentity, needsAnalysis } from "./tagger";
import type { AutoAnalysis } from "./types";
// Canonical analysis for decklist cards that are not in the collection. Computed once per
// canonical identity and ruleset; browsing reuses the cached result.
const unownedAnalysis = new Map<string, AutoAnalysis>();
export function deckCardAnalysis(
  state: CollectionState,
  card: CardMetadata,
): AutoAnalysis {
  const identity = cardIdentity(card);
  const saved = state.intelligence?.auto[identity];
  if (saved && !needsAnalysis(card, saved)) return saved;
  const cached = unownedAnalysis.get(identity);
  if (cached && !needsAnalysis(card, cached)) return cached;
  const result = analyze(card);
  unownedAnalysis.set(identity, result);
  return result;
}
