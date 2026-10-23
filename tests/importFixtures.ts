import Papa from "papaparse";
import data from "../src/data/sampleCards.json" with { type: "json" };
import type { SampleCollectionCard } from "../src/models/card";
import type { CardMetadata } from "../src/models/collection";
const sample = data as SampleCollectionCard[];
export const sol = sample.find((c) => c.name === "Sol Ring")!;
export const forest = sample.find((c) => c.name === "Forest")!;
export const meren = sample.find((c) => c.name === "Meren of Clan Nel Toth")!;
export const tatyova = sample.find((c) => c.name === "Tatyova, Benthic Druid")!;
export const metadata = Object.fromEntries(
  sample.map((c) => [c.scryfallId, c]),
) as Record<string, CardMetadata>;
export function exportCsv(rows: Record<string, string | number>[]) {
  return Papa.unparse(rows);
}
export function solRow(
  quantity = 1,
  extra: Record<string, string | number> = {},
) {
  return {
    Name: sol.name,
    "Set code": sol.setCode,
    "Set name": sol.setName || "",
    "Collector number": sol.collectorNumber || "",
    Quantity: quantity,
    Foil: "normal",
    "Scryfall ID": sol.scryfallId,
    Language: "English",
    Condition: "Near Mint",
    "Binder Name": "Main binder",
    "Binder Type": "binder",
    "Purchase price": "2.50",
    "Purchase price currency": "USD",
    ...extra,
  };
}
export function apiCard(card: CardMetadata) {
  return {
    object: "card",
    id: card.scryfallId,
    name: card.name,
    set: card.setCode,
    set_name: card.setName,
    collector_number: card.collectorNumber,
    cmc: card.manaValue,
    color_identity: card.colorIdentity,
    colors: [],
    type_line: card.typeLine,
    rarity: card.rarity,
    mana_cost: card.manaCost,
    oracle_text: card.oracleText,
    image_uris: {
      normal: card.thumbnailUrl || card.imageUrl,
      large: card.imageUrl,
    },
    artist: card.artist,
  };
}
export function fixtureRow(
  card: typeof sol,
  quantity = 1,
  extra: Record<string, string | number> = {},
) {
  return solRow(quantity, {
    Name: card.name,
    "Set code": card.setCode,
    "Set name": card.setName || "",
    "Collector number": card.collectorNumber || "",
    "Scryfall ID": card.scryfallId,
    ...extra,
  });
}
