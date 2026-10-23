import type { SampleCollectionCard } from "../models/card";
import type { CollectionSource } from "../models/collection";
// Demo mode and bundled metadata cache only. Real ownership is loaded through
// CollectionRepository; importing never treats these sample quantities as owned.
export const sampleCollectionSource: CollectionSource = {
  async load() {
    const { default: cards } = await import("./sampleCards.json");
    return cards as SampleCollectionCard[];
  },
};
