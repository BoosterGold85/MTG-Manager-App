import type { SampleCollectionCard, Color } from "../models/card";
import type { CardMetadata, CollectionState } from "../models/collection";
import type { Deck, DecklistEntry } from "../models/deck";
import { cardIdentity } from "../intelligence/tagger";
import { oracleText } from "../utils/cardKeywords";
import { normalizedName } from "../import/csv";
export function commanderEligible(card: SampleCollectionCard) {
  const front = card.cardFaces?.[0]?.typeLine || card.typeLine;
  return (
    (/\bLegendary\b/.test(front) && /\bCreature\b/.test(front)) ||
    /can be your commander\b/i.test(oracleText(card))
  );
}
// Same canonical card: oracle identity when both printings carry it, otherwise exact name.
export const sameCard = (
  a: Pick<CardMetadata, "oracleId" | "name">,
  b: Pick<CardMetadata, "oracleId" | "name">,
) =>
  a.oracleId && b.oracleId
    ? a.oracleId === b.oracleId
    : normalizedName(a.name) === normalizedName(b.name);
export const deckIdentity = (deck: Deck): Color[] => [
  ...new Set(deck.commanders.flatMap((c) => c.colorIdentity)),
];
// Cards that never go in a Commander deck's 99: Archenemy schemes, Planechase planes/phenomena, Vanguard,
// Conspiracy draft cards, dungeons, tokens, emblems, art cards and Unfinity attraction/contraption decks.
const NON_DECK_TYPES = /^Card\b|\b(?:Scheme|Plane|Phenomenon|Vanguard|Conspiracy|Dungeon|Emblem|Token|Attraction|Contraption)\b/;
const NON_DECK_LAYOUTS = new Set(["scheme", "planar", "vanguard", "token", "double_faced_token", "emblem", "art_series"]);
export const deckPlayable = (card: Pick<SampleCollectionCard, "typeLine" | "layout" | "cardFaces">) =>
  !NON_DECK_LAYOUTS.has(card.layout || "") && !NON_DECK_TYPES.test(card.cardFaces?.[0]?.typeLine || card.typeLine);
export const legalInDeck = (
  card: Pick<SampleCollectionCard, "colorIdentity">,
  deck: Deck,
) => card.colorIdentity.every((c) => deckIdentity(deck).includes(c));
export function deckUsage(state: CollectionState, itemId: string) {
  return (state.decks || [])
    .map((deck) => ({
      deck,
      quantity:
        deck.assignments
          .filter((a) => a.itemId === itemId)
          .reduce((n, a) => n + a.quantity, 0) +
        deck.commanders.filter((c) => c.itemId && c.itemId === itemId).length,
    }))
    .filter((u) => u.quantity > 0);
}
// Decklist size. Entry decks count the conceptual list, including missing cards.
export const deckCount = (deck: Deck) =>
  deck.entries
    ? deck.entries.reduce((n, e) => n + e.quantity, 0)
    : deck.commanders.length + deck.assignments.reduce((n, a) => n + a.quantity, 0);
export const assignedCount = (deck: Deck) =>
  deck.commanders.filter((c) => c.itemId).length +
  deck.assignments.reduce((n, a) => n + a.quantity, 0);
export function entryAssigned(deck: Deck, entry: DecklistEntry) {
  return (
    deck.assignments
      .filter((a) => a.entryId === entry.id)
      .reduce((n, a) => n + a.quantity, 0) +
    deck.commanders.filter((c) => c.entryId === entry.id && c.itemId).length
  );
}
// Basic lands (the Basic supertype, from card data — not names) are deck-building resources,
// not exclusive inventory: they never need a physical assignment and never count as missing.
export function isBasicLand(card: Pick<CardMetadata, "typeLine" | "cardFaces"> | undefined) {
  if (!card) return false;
  const supertypes = (card.cardFaces?.[0]?.typeLine || card.typeLine || "").split("—")[0];
  return /\bBasic\b/.test(supertypes) && /\bLand\b/.test(supertypes);
}
export const entryIsBasic = (entry: DecklistEntry, state?: CollectionState | null) =>
  !!entry.basicLand || (entry.board === "main" && isBasicLand(state?.metadata[entry.scryfallId]));
export function deckOwnership(deck: Deck, state?: CollectionState | null) {
  const total = deckCount(deck);
  const assigned = assignedCount(deck);
  // Unassigned basic-land copies are not tracked and are never "missing".
  const basic = (deck.entries || [])
    .filter((e) => entryIsBasic(e, state))
    .reduce((n, e) => n + Math.max(0, e.quantity - entryAssigned(deck, e)), 0);
  return { total, assigned, basic, missing: Math.max(0, total - assigned - basic) };
}
export interface MissingEntry {
  entry: DecklistEntry;
  missing: number;
  owned: number;
  available: number;
  reason: string;
  outsideIdentity: boolean;
}
// Decklist entries without an assigned physical copy, with an explanation. Never fabricated ownership.
export function missingEntries(state: CollectionState, deck: Deck): MissingEntry[] {
  return (deck.entries || [])
    .filter((entry) => !entryIsBasic(entry, state))
    .map((entry) => {
      const missing = entry.quantity - entryAssigned(deck, entry);
      const card = state.metadata[entry.scryfallId];
      const items = state.items.filter(
        (i) => i.quantityOwned > 0 && state.metadata[i.scryfallId] && card && sameCard(state.metadata[i.scryfallId], card),
      );
      const owned = items.reduce((n, i) => n + i.quantityOwned, 0);
      const available = items.reduce((n, i) => n + i.quantityUnassigned, 0);
      const outsideIdentity = entry.board === "main" && !!card && !legalInDeck(card, deck);
      const reason = outsideIdentity
        ? "Outside commander color identity — no copy assigned"
        : !owned
          ? "Missing — not owned"
          : !available
            ? "Unassigned — all owned copies are assigned to decks"
            : "Unassigned — an owned copy is available to add";
      return { entry, missing, owned, available, reason, outsideIdentity };
    })
    .filter((m) => m.missing > 0);
}
export const allocationConflicts = (state: CollectionState) =>
  state.items.filter((i) => i.quantityAssigned > i.quantityOwned);
export function reconcileAllocations(state: CollectionState): CollectionState {
  const counts = new Map<string, number>();
  for (const deck of state.decks || []) {
    for (const c of deck.commanders)
      if (c.itemId) counts.set(c.itemId, (counts.get(c.itemId) || 0) + 1);
    for (const a of deck.assignments)
      counts.set(a.itemId, (counts.get(a.itemId) || 0) + a.quantity);
  }
  return {
    ...state,
    items: state.items.map((item) => {
      const assigned = counts.get(item.id) || 0;
      return {
        ...item,
        quantityAssigned: assigned,
        quantityUnassigned: Math.max(0, item.quantityOwned - assigned),
      };
    }),
  };
}
export function newDeck(
  state: CollectionState,
  name: string,
  itemId: string,
  id = crypto.randomUUID(),
  now = new Date().toISOString(),
): Deck {
  if (!name.trim()) throw new Error("Enter a deck name.");
  const item = state.items.find((i) => i.id === itemId);
  const card = item && state.metadata[item.scryfallId];
  if (
    !item ||
    !card ||
    !commanderEligible({ ...card, id: item.id, quantity: item.quantityOwned })
  )
    throw new Error("Choose an owned commander using canonical card metadata.");
  if (item.quantityUnassigned < 1)
    throw new Error(
      "No unassigned copy available. Release a copy from its deck first.",
    );
  return {
    id,
    name: name.trim(),
    createdAt: now,
    modifiedAt: now,
    commanders: [
      {
        itemId,
        cardIdentity: cardIdentity(card),
        scryfallId: card.scryfallId,
        name: card.name,
        colorIdentity: [...card.colorIdentity],
      },
    ],
    assignments: [],
  };
}
export function deckStats(state: CollectionState, deck: Deck) {
  const scryfall = (itemId: string) =>
    state.items.find((i) => i.id === itemId)!.scryfallId;
  // Entry decks describe the whole decklist, owned or missing.
  const rows = deck.entries
    ? deck.entries.map((e) => ({ scryfallId: e.scryfallId, quantity: e.quantity }))
    : [
        ...deck.commanders.map((c) => ({ scryfallId: c.itemId ? scryfall(c.itemId) : c.scryfallId, quantity: 1 })),
        ...deck.assignments.map((a) => ({ scryfallId: scryfall(a.itemId), quantity: a.quantity })),
      ];
  const types = [
    "Land",
    "Creature",
    "Artifact",
    "Enchantment",
    "Instant",
    "Sorcery",
    "Planeswalker",
    "Battle",
  ];
  const typeOf = (id: string) => state.metadata[id].typeLine.split("—")[0];
  const counts = Object.fromEntries(
    types.map((t) => [
      t,
      rows.reduce((n, a) => n + (typeOf(a.scryfallId).includes(t) ? a.quantity : 0), 0),
    ]),
  );
  const spells = rows.filter((a) => !typeOf(a.scryfallId).includes("Land"));
  const denominator = spells.reduce((n, a) => n + a.quantity, 0);
  const average = denominator
    ? spells.reduce((n, a) => n + state.metadata[a.scryfallId].manaValue * a.quantity, 0) / denominator
    : 0;
  return { counts, average };
}
