import type { SampleCollectionCard, Color } from "../models/card";
import type { CardMetadata, CollectionItem, CollectionState } from "../models/collection";
import type { Deck, DecklistEntry } from "../models/deck";
import { collectionCards } from "../models/collection";
import { analyze, cardIdentity, effectiveAssignments, needsAnalysis } from "../intelligence/tagger";
import type { AutoAnalysis } from "../intelligence/types";
import { entryAssigned, sameCard } from "./decks";

// One browsable deck card: either copies assigned from one printing group, or a decklist
// entry's remaining copies with no physical assignment. Ownership is never fabricated.
export interface DeckRow {
  key: string;
  name: string;
  quantity: number;
  card: SampleCollectionCard;
  itemId?: string;
  entry?: DecklistEntry;
  assigned: boolean;
  ownedElsewhere: number;
  availableElsewhere: number;
}
export type DeckSort = "type" | "name-asc" | "name-desc" | "mv-asc" | "mv-desc" | "color" | "set";
export const deckSortLabels: Record<DeckSort, string> = {
  type: "Card Type",
  "name-asc": "Name A–Z",
  "name-desc": "Name Z–A",
  "mv-asc": "Mana Value Low → High",
  "mv-desc": "Mana Value High → Low",
  color: "Color",
  set: "Set & Collector Number",
};
export const deckTypes = ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker", "Battle", "Land"] as const;
export interface DeckFilters {
  query: string;
  type: "" | (typeof deckTypes)[number] | "Other";
  ownership: "" | "assigned" | "missing";
}
export const emptyDeckFilters = (): DeckFilters => ({ query: "", type: "", ownership: "" });

// Canonical analysis for decklist cards that are not in the collection. Computed once per
// canonical identity and ruleset; browsing reuses the cached result.
const unownedAnalysis = new Map<string, AutoAnalysis>();
export function deckCardAnalysis(state: CollectionState, card: CardMetadata): AutoAnalysis {
  const identity = cardIdentity(card);
  const saved = state.intelligence?.auto[identity];
  if (saved && !needsAnalysis(card, saved)) return saved;
  const cached = unownedAnalysis.get(identity);
  if (cached && !needsAnalysis(card, cached)) return cached;
  const result = analyze(card);
  unownedAnalysis.set(identity, result);
  return result;
}
function canonicalCard(state: CollectionState, scryfallId: string, id: string): SampleCollectionCard {
  const card = state.metadata[scryfallId];
  const analysis = deckCardAnalysis(state, card);
  const tagOverrides = state.intelligence?.overrides[analysis.cardIdentity];
  return {
    ...card,
    id,
    quantity: 0,
    analysis,
    tagOverrides,
    intelligentTags: effectiveAssignments(analysis, tagOverrides).map((a) => a.tagId),
  };
}
function owned(state: CollectionState, card: CardMetadata) {
  const items = state.items.filter((i: CollectionItem) => i.quantityOwned > 0 && state.metadata[i.scryfallId] && sameCard(state.metadata[i.scryfallId], card));
  return {
    owned: items.reduce((n, i) => n + i.quantityOwned, 0),
    available: items.reduce((n, i) => n + i.quantityUnassigned, 0),
  };
}
export function deckRows(state: CollectionState, deck: Deck): DeckRow[] {
  const cards = new Map(collectionCards(state).map((c) => [c.id, c]));
  const assignedCard = (itemId: string): SampleCollectionCard => {
    const item = state.items.find((i) => i.id === itemId)!;
    // Zero-owned conflicting assignments stay visible with their exact printing.
    return cards.get(itemId) || { ...canonicalCard(state, item.scryfallId, itemId), quantity: item.quantityOwned, ownership: item, foil: item.finish !== "nonfoil" };
  };
  const rows: DeckRow[] = [];
  for (const a of deck.assignments) {
    const card = assignedCard(a.itemId);
    const holdings = owned(state, card);
    rows.push({
      key: `a:${a.itemId}:${a.entryId || ""}`,
      name: card.name,
      quantity: a.quantity,
      card,
      itemId: a.itemId,
      entry: deck.entries?.find((e) => e.id === a.entryId),
      assigned: true,
      ownedElsewhere: holdings.owned,
      availableElsewhere: holdings.available,
    });
  }
  for (const entry of deck.entries || []) {
    if (entry.board !== "main") continue;
    const missing = entry.quantity - entryAssigned(deck, entry);
    if (missing < 1 || !state.metadata[entry.scryfallId]) continue;
    const card = canonicalCard(state, entry.scryfallId, `entry:${entry.id}`);
    const holdings = owned(state, card);
    rows.push({
      key: `e:${entry.id}`,
      name: card.name,
      quantity: missing,
      card,
      entry,
      assigned: false,
      ownedElsewhere: holdings.owned,
      availableElsewhere: holdings.available,
    });
  }
  return rows;
}
const frontType = (card: SampleCollectionCard) => card.cardFaces?.[0]?.typeLine || card.typeLine;
export function typeRank(card: SampleCollectionCard) {
  const front = frontType(card).split("—")[0];
  const index = deckTypes.findIndex((t) => new RegExp(`\\b${t}\\b`).test(front));
  return index < 0 ? deckTypes.length : index;
}
export const typeGroup = (card: SampleCollectionCard) => deckTypes[typeRank(card)] || "Other";
const wubrg: Color[] = ["W", "U", "B", "R", "G"];
// Mono-colored in WUBRG order, then multicolor by size and WUBRG combination, then colorless.
export function colorRank(card: SampleCollectionCard): [number, string] {
  const colors = wubrg.filter((c) => card.colorIdentity.includes(c));
  if (!colors.length) return [99, ""];
  return [colors.length, colors.map((c) => wubrg.indexOf(c)).join("")];
}
const byName = (a: DeckRow, b: DeckRow) => a.name.localeCompare(b.name, "en", { sensitivity: "base" });
const printing = (row: DeckRow) => [row.card.setCode.toLowerCase(), row.card.collectorNumber || ""];
// Deterministic final tie-break: name A–Z, then printing, then the stable row key.
const tieBreak = (a: DeckRow, b: DeckRow) =>
  byName(a, b) ||
  printing(a)[0].localeCompare(printing(b)[0]) ||
  printing(a)[1].localeCompare(printing(b)[1], "en", { numeric: true }) ||
  a.key.localeCompare(b.key);
export function sortDeckRows(rows: DeckRow[], sort: DeckSort): DeckRow[] {
  const compare = (a: DeckRow, b: DeckRow): number => {
    switch (sort) {
      case "name-asc":
        return tieBreak(a, b);
      case "name-desc":
        return byName(b, a) || tieBreak(a, b);
      case "mv-asc":
        return a.card.manaValue - b.card.manaValue || tieBreak(a, b);
      case "mv-desc":
        return b.card.manaValue - a.card.manaValue || tieBreak(a, b);
      case "color": {
        const [ac, ak] = colorRank(a.card), [bc, bk] = colorRank(b.card);
        return ac - bc || ak.localeCompare(bk) || tieBreak(a, b);
      }
      case "set":
        return (
          printing(a)[0].localeCompare(printing(b)[0]) ||
          printing(a)[1].localeCompare(printing(b)[1], "en", { numeric: true }) ||
          tieBreak(a, b)
        );
      default:
        return typeRank(a.card) - typeRank(b.card) || a.card.manaValue - b.card.manaValue || tieBreak(a, b);
    }
  };
  return [...rows].sort(compare);
}
export function filterDeckRows(rows: DeckRow[], filters: DeckFilters): DeckRow[] {
  const query = filters.query.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (!query || row.name.toLowerCase().includes(query)) &&
      (!filters.type || typeGroup(row.card) === filters.type) &&
      (!filters.ownership || (filters.ownership === "assigned") === row.assigned),
  );
}
// The browsable sequence used by both the grid and Card Detail Previous/Next.
export const visibleDeckRows = (rows: DeckRow[], sort: DeckSort, filters: DeckFilters) =>
  sortDeckRows(filterDeckRows(rows, filters), sort);
