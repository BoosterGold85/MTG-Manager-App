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
/**
 * A card the user saved from Upgrades I Own. Only what identifies the candidate and the user's intent is kept:
 * scores, labels and vectors are always recalculated, because they go stale as soon as the deck changes.
 */
export interface SavedDeckCandidate {
  id: string;
  intent: "improve" | "build";
  candidateIdentity: string;
  candidateName: string;
  preferredItemId?: string;
  suggestedCutIdentity?: string;
  suggestedCutName?: string;
  createdAt: string;
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
  // Absent on decks saved before v0.6.7: treated as an empty list.
  savedCandidates?: SavedDeckCandidate[];
  createdAt: string;
  modifiedAt: string;
}
