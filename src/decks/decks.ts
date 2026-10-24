import type { SampleCollectionCard, Color } from "../models/card";
import type { CollectionState } from "../models/collection";
import type { Deck } from "../models/deck";
import { cardIdentity } from "../intelligence/tagger";
import { oracleText } from "../utils/cardKeywords";
export function commanderEligible(card: SampleCollectionCard) {
  const front = card.cardFaces?.[0]?.typeLine || card.typeLine;
  return (
    (/\bLegendary\b/.test(front) && /\bCreature\b/.test(front)) ||
    /can be your commander\b/i.test(oracleText(card))
  );
}
export const deckIdentity = (deck: Deck): Color[] => [
  ...new Set(deck.commanders.flatMap((c) => c.colorIdentity)),
];
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
        deck.commanders.filter((c) => c.itemId === itemId).length,
    }))
    .filter((u) => u.quantity > 0);
}
export const deckCount = (deck: Deck) =>
  deck.commanders.length + deck.assignments.reduce((n, a) => n + a.quantity, 0);
export const allocationConflicts = (state: CollectionState) =>
  state.items.filter((i) => i.quantityAssigned > i.quantityOwned);
export function reconcileAllocations(state: CollectionState): CollectionState {
  const counts = new Map<string, number>();
  for (const deck of state.decks || []) {
    for (const c of deck.commanders)
      counts.set(c.itemId, (counts.get(c.itemId) || 0) + 1);
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
  const rows = [
    ...deck.commanders.map((c) => ({ itemId: c.itemId, quantity: 1 })),
    ...deck.assignments,
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
  const counts = Object.fromEntries(
    types.map((t) => [
      t,
      rows.reduce(
        (n, a) =>
          n +
          (state.metadata[
            state.items.find((i) => i.id === a.itemId)!.scryfallId
          ].typeLine
            .split("—")[0]
            .includes(t)
            ? a.quantity
            : 0),
        0,
      ),
    ]),
  );
  const spells = rows.filter(
    (a) =>
      !state.metadata[
        state.items.find((i) => i.id === a.itemId)!.scryfallId
      ].typeLine
        .split("—")[0]
        .includes("Land"),
  );
  const denominator = spells.reduce((n, a) => n + a.quantity, 0);
  const average = denominator
    ? spells.reduce(
        (n, a) =>
          n +
          state.metadata[state.items.find((i) => i.id === a.itemId)!.scryfallId]
            .manaValue *
            a.quantity,
        0,
      ) / denominator
    : 0;
  return { counts, average };
}
