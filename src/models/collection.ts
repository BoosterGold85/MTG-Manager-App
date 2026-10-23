import type { SampleCollectionCard } from "./card";
export interface CollectionSource {
  load: () => Promise<SampleCollectionCard[]>;
}
