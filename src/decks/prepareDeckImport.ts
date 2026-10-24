import type { CardMetadata, CollectionState } from "../models/collection";
import { sampleCollectionSource } from "../data/sampleCollection";
import { scryfallClient } from "../import/scryfall";
import type { DeckCardLookup } from "../import/scryfall";
import { parseDeckText } from "./deckText";
import { buildDeckImportPreview, resolveDeckLines } from "./deckImport";
// Read-only: produces a preview. Nothing is saved until the user confirms.
export async function prepareDeckImport(
  text: string,
  state: CollectionState,
  signal: AbortSignal,
  progress: (message: string) => void,
  options: { filename?: string; name?: string } = {},
  lookup: DeckCardLookup = scryfallClient,
) {
  const parsed = parseDeckText(text);
  // Bundled printings are a canonical metadata cache only, never treated as owned inventory.
  const known: Record<string, CardMetadata> = {};
  for (const card of await sampleCollectionSource.load()) {
    const { id, quantity, foil, tags, ownership, ...canonical } = card;
    void id; void quantity; void foil; void tags; void ownership;
    known[card.scryfallId] = canonical;
  }
  signal.throwIfAborted();
  const resolved = await resolveDeckLines(parsed, { ...known, ...state.metadata }, lookup, signal, progress);
  signal.throwIfAborted();
  return buildDeckImportPreview(parsed, resolved, state, options);
}
