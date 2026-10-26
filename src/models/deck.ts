import type { Color } from "./card";
export interface DeckCommander {
  // Absent when the decklist names a commander but no owned copy is assigned.
  itemId?: string;
  cardIdentity: string;
  scryfallId: string;
  name: string;
  colorIdentity: Color[];
  entryId?: string;
}
// A physical-copy relationship to a collection printing group.
export interface DeckCardAssignment {
  itemId: string;
  quantity: number;
  // Links the copies to the conceptual decklist entry they fulfil (imported/entry decks).
  entryId?: string;
}
// The conceptual decklist: what the deck contains, independent of ownership.
export interface DecklistEntry {
  id: string;
  board: "commander" | "main";
  quantity: number;
  name: string;
  cardIdentity: string;
  // Canonical reference printing for metadata/art: the requested printing when known.
  scryfallId: string;
  requestedPrinting?: { setCode: string; collectorNumber?: string };
  sourceLines?: number[];
  // Basic supertype: the entry is tracked in the deck but never exclusively allocated.
  basicLand?: boolean;
}
export interface DeckImportIssue {
  line: number;
  text: string;
  reason: string;
}
export interface DeckSource {
  kind: "manabox-text";
  filename?: string;
  importedAt: string;
}
export interface Deck {
  id: string;
  name: string;
  commanders: DeckCommander[];
  assignments: DeckCardAssignment[];
  // Present on decks that track a decklist separately from assignments (v0.4.1+).
  entries?: DecklistEntry[];
  importIssues?: DeckImportIssue[];
  source?: DeckSource;
  createdAt: string;
  modifiedAt: string;
}
