import raw from "./data/deck-intelligence-oracle.json" with { type: "json" };
import { normalizeCard } from "../src/import/scryfall";
import { emptyCollection } from "../src/models/collection";
import type { CardMetadata } from "../src/models/collection";
import type { Deck, DecklistEntry } from "../src/models/deck";

// Three verified mechanisms, NOT a substitute for the user's unavailable 60-card list.
export const mechanismCards = () => raw.map(r => normalizeCard(r as unknown as Parameters<typeof normalizeCard>[0]));
export function intelligenceFixture(cards: CardMetadata[] = mechanismCards()) {
  const state = emptyCollection(), now = "2026-11-05T21:00:00.000Z";
  state.revision = 1; state.metadata = Object.fromEntries(cards.map(c => [c.scryfallId, c]));
  const entries: DecklistEntry[] = cards.map((c, i) => ({ id: `entry:${i}`, board: "main", name: c.name, quantity: 1, scryfallId: c.scryfallId, cardIdentity: c.oracleId || c.name, requestedPrinting: { setCode: c.setCode, collectorNumber: c.collectorNumber, finish: "nonfoil" } }));
  const deck: Deck = { id: "mayhem-mechanisms", name: "Mayhem mechanism test", format: "legacy", commanders: [], entries, assignments: [], createdAt: now, modifiedAt: now };
  state.decks = [deck]; return { state, deck, cards };
}
