import type { CardMetadata, CollectionState } from '../../models/collection';
import type { Deck } from '../../models/deck';
import { deckDnaInput } from '../../dna/engine';
import { formatOf } from '../../decks/formats';

export interface DiscoveryInput {
  /** Distinct main-deck and commander cards, one printing per Oracle card. */
  deckCards: CardMetadata[];
  /** Commanders: every scenario for a candidate is tried beside these first. */
  anchorIds: string[];
  partnerIds: string[];
  /** Owned nonland cards not already in the deck and, for Commander, inside the commander's color identity. */
  candidates: CardMetadata[];
  outsideIdentity: number;
  revision: string;
}
const oracleKey = (card: CardMetadata) => card.oracleId || card.name.toLowerCase();
const frontIsLand = (card: CardMetadata) => /\bLand\b/.test(card.typeLine.split('//')[0]);

/** Ephemeral, read-only projection of saved data. Nothing is written back. */
export function discoveryInput(state: CollectionState, deck: Deck): DiscoveryInput {
  const input = deckDnaInput(state, deck), seen = new Set<string>(), deckCards: CardMetadata[] = [], anchorIds: string[] = [];
  for (const row of [...input.cards].sort((a, b) => Number(b.commander) - Number(a.commander))) {
    const key = oracleKey(row.card);
    if (seen.has(key)) continue;
    seen.add(key); deckCards.push(row.card);
    if (row.commander) anchorIds.push(row.card.scryfallId);
  }
  const commander = formatOf(deck) === 'commander';
  const identity = new Set(deckCards.filter(c => anchorIds.includes(c.scryfallId)).flatMap(c => c.colorIdentity || []));
  const candidates: CardMetadata[] = []; let outsideIdentity = 0;
  for (const item of state.items) {
    const card = state.metadata[item.scryfallId];
    if (!card || item.quantityOwned <= 0 || frontIsLand(card) || seen.has(oracleKey(card))) continue;
    seen.add(oracleKey(card));
    if (commander && anchorIds.length && (card.colorIdentity || []).some(color => !identity.has(color))) { outsideIdentity++; continue; }
    candidates.push(card);
  }
  candidates.sort((a, b) => a.name.localeCompare(b.name));
  return { deckCards, anchorIds, partnerIds: deckCards.filter(c => !anchorIds.includes(c.scryfallId)).map(c => c.scryfallId), candidates, outsideIdentity, revision: input.revision };
}
