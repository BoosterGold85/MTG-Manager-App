import type { CardMetadata, CollectionState } from "../models/collection";
import type { DnaInputCard } from "../dna/engine";
import { deckCardAnalysis } from "../intelligence/canonicalAnalysis";
import { effectiveAssignments } from "../intelligence/tagger";

const nameKey = (name: string) => name.normalize("NFKC").trim().toLowerCase();
/** Canonical engine input for one card: canonical analysis plus the user's manual tag corrections. */
export function canonicalInput(
  state: CollectionState,
  card: CardMetadata,
  commander = false,
  quantity = 1,
): DnaInputCard {
  const analysis = deckCardAnalysis(state, card);
  const assignments = effectiveAssignments(
    analysis,
    state.intelligence?.overrides[analysis.cardIdentity] ||
      state.intelligence?.overrides[`name:${nameKey(card.name)}`],
  );
  return { card, analysis, assignments, identity: analysis.cardIdentity, quantity, commander };
}
