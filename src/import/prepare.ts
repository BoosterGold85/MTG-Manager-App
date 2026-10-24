import { tagCollection } from "../intelligence/client";
import type {
  CollectionRepository,
  ImportPlan,
  ParsedImport,
  CardMetadata,
} from "../models/collection";
import { sampleCollectionSource } from "../data/sampleCollection";
import { buildImportPlan } from "./plan";
import { scryfallClient } from "./scryfall";
import type { MetadataResolver } from "./scryfall";
export async function prepareImport(
  parsed: ParsedImport,
  filename: string,
  repository: CollectionRepository,
  signal: AbortSignal,
  progress: (message: string) => void,
  resolver: MetadataResolver = scryfallClient,
): Promise<ImportPlan> {
  const current = await repository.load();
  signal.throwIfAborted();
  // Bundled printings are a metadata cache only, never treated as owned inventory.
  const seed = await sampleCollectionSource.load();
  const metadata: Record<string, CardMetadata> = {};
  for (const card of seed) {
    const { id, quantity, foil, tags, ownership, ...canonical } = card;
    void id;
    void quantity;
    void foil;
    void tags;
    void ownership;
    metadata[card.scryfallId] = canonical;
  }
  const resolved = await resolver.resolve(
    parsed.rows,
    { ...metadata, ...current?.metadata },
    current?.nameMatches || {},
    signal,
    progress,
  );
  signal.throwIfAborted();
  const plan = buildImportPlan(parsed, resolved, current, filename);
  plan.next = await tagCollection(plan.next, progress, signal);
  return plan;
}
