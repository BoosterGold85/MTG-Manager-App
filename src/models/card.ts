import type { CollectionItem } from "./collection";
export type Color = "W" | "U" | "B" | "R" | "G";
export type Rarity = "common" | "uncommon" | "rare" | "mythic";
export interface SampleCollectionCard {
  id: string;
  scryfallId: string;
  name: string;
  imageUrl: string;
  thumbnailUrl?: string;
  setCode: string;
  setName?: string;
  collectorNumber?: string;
  manaCost?: string;
  manaValue: number;
  colorIdentity: Color[];
  typeLine: string;
  rarity: Rarity;
  quantity: number;
  foil?: boolean;
  oracleText?: string;
  tags?: string[];
  artist?: string;
  ownership?: CollectionItem;
}
