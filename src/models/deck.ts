import type { Color } from "./card";
export interface DeckCommander {
  itemId: string;
  cardIdentity: string;
  scryfallId: string;
  name: string;
  colorIdentity: Color[];
}
export interface DeckCardAssignment {
  itemId: string;
  quantity: number;
}
export interface Deck {
  id: string;
  name: string;
  commanders: DeckCommander[];
  assignments: DeckCardAssignment[];
  createdAt: string;
  modifiedAt: string;
}
