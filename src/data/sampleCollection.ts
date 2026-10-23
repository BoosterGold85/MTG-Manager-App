import type { SampleCollectionCard } from "../models/card";
import type { CollectionSource } from "../models/collection";
// This is the only data-source boundary. A later persistence adapter can replace
// it without changing the binder or pretending sample tags are generated.
export const sampleCollectionSource: CollectionSource = {
  async load() {
    const { default: cards } = await import("./sampleCards.json");
    return cards as SampleCollectionCard[];
  },
};
