import type { CardMetadata, CollectionState } from "../models/collection";
import type { Deck, DecklistEntry } from "../models/deck";
import { normalizedName } from "../import/csv";
import { namesCard } from "../decks/deckImport";
import { formatOf } from "../decks/formats";
import { isBasicLand } from "../decks/decks";
import { cardCoverage, missingCardData } from "../upgrades/coverage";
import type { CardCoverage } from "../upgrades/coverage";

export type AnalysisState = "full" | "partial" | "unresolved" | "unverified";
export interface EntryAnalysis {
  entry: DecklistEntry;
  card?: CardMetadata;
  identity: string;
  printing: "exact" | "canonical-fallback" | "unresolved";
  finish: "verified" | "unverified" | "unavailable" | "unspecified";
  oracle: "available" | "missing";
  mechanical?: CardCoverage;
  status: AnalysisState;
  legality: { status: string; freshness: "fresh" | "stale" | "unverified" };
  allocated: number;
  owned: number;
  basic: boolean;
  explanations: string[];
}
export interface CoverageReport {
  entries: EntryAnalysis[];
  counts: Record<AnalysisState, { entries: number; quantity: number }>;
  groups: { identity: string; name: string; main: number; sideboard: number; entries: string[] }[];
  total: number;
}
export const oracleKey = (card: CardMetadata) => card.oracleId ? `oracle:${card.oracleId}` : `name:${normalizedName(card.name)}`;
export const completeOracle = (card: CardMetadata) => !missingCardData(card) && (!card.cardFaces?.length || card.cardFaces.every(f => typeof f.oracleText === "string"));
const indexes = new WeakMap<CollectionState["metadata"], { cards: CardMetadata[]; byName: Map<string, CardMetadata[]> }>();
function metadataIndex(metadata: CollectionState["metadata"]) {
  let index = indexes.get(metadata);
  if (!index) {
    const cards = Object.values(metadata), byName = new Map<string, CardMetadata[]>();
    for (const card of cards) for (const name of new Set([card.name, card.name.split(" // ")[0], ...(card.aliases || []), ...(card.cardFaces || []).map(f => f.name)])) {
      const key = normalizedName(name); byName.set(key, [...(byName.get(key) || []), card]);
    }
    index = { cards, byName }; indexes.set(metadata, index);
  }
  return index;
}
/** Read the intended list independently of inventory. Older assignment-only Commander decks are supported. */
export function intelligenceEntries(state: CollectionState, deck: Deck): DecklistEntry[] {
  if (deck.entries) return deck.entries;
  return [...deck.commanders.map((c, i) => ({ id: `commander:${i}`, board: "commander" as const, quantity: 1, name: c.name, cardIdentity: c.cardIdentity, scryfallId: c.scryfallId })), ...deck.assignments.map((a, i) => {
    const item = state.items.find(it => it.id === a.itemId), card = item && state.metadata[item.scryfallId];
    return { id: `assignment:${i}`, board: "main" as const, quantity: a.quantity, name: card?.name || "Unresolved assigned card", cardIdentity: card ? oracleKey(card) : a.itemId, scryfallId: item?.scryfallId || "", requestedPrinting: item ? { setCode: item.setCode, collectorNumber: item.collectorNumber, finish: item.finish } : undefined };
  })];
}
export function analyzeEntry(state: CollectionState, deck: Deck, entry: DecklistEntry, now = Date.now()): EntryAnalysis {
  const index = metadataIndex(state.metadata), requested = entry.requestedPrinting;
  const direct = state.metadata[entry.scryfallId];
  const exact = (card: CardMetadata) => namesCard(card, entry.name) && (!requested || card.setCode.toLowerCase() === requested.setCode.toLowerCase() && (!requested.collectorNumber || card.collectorNumber?.toLowerCase() === requested.collectorNumber.toLowerCase()));
  const printing = direct && exact(direct) ? direct : requested?.collectorNumber ? index.cards.find(exact) : undefined;
  const candidates = index.byName.get(normalizedName(entry.name)) || [];
  const canonical = candidates.filter(completeOracle);
  const ids = new Set(candidates.filter(c => c.oracleId).map(c => c.oracleId));
  // No fuzzy name guesses, and no ambiguous Oracle identity selection.
  const fallback = ids.size <= 1 ? canonical[0] || candidates[0] : undefined;
  const card = printing && completeOracle(printing) ? printing : fallback || printing;
  const mechanical = card && cardCoverage(card);
  const requestedFinish = entry.requestedFinish || requested?.finish;
  const finish = !requestedFinish ? "unspecified" : !printing?.supportedFinishes ? "unverified" : printing.supportedFinishes.includes(requestedFinish) ? "verified" : "unavailable";
  const printState = printing ? "exact" : card ? "canonical-fallback" : "unresolved";
  const oracle = card && completeOracle(card) ? "available" : "missing";
  const status: AnalysisState = !card ? "unresolved" : oracle === "missing" ? "unverified" : mechanical?.unsupported ? "partial" : "full";
  const identityCard = card && !card.oracleId && ids.size === 1 ? { ...card, oracleId: [...ids][0] } : card;
  const identity = identityCard ? oracleKey(identityCard) : `unresolved:${normalizedName(entry.name)}`;
  const owned = state.items.filter(i => {
    const held = state.metadata[i.scryfallId];
    return i.quantityOwned > 0 && (i.scryfallId === printing?.scryfallId || !!held && (oracleKey(held) === identity || !held.oracleId && ids.size <= 1 && namesCard(held, entry.name)));
  }).reduce((n, i) => n + i.quantityOwned, 0);
  const allocated = deck.assignments.filter(a => a.entryId === entry.id || !deck.entries && entry.id === `assignment:${deck.assignments.indexOf(a)}`).reduce((n, a) => n + a.quantity, 0) + (entry.board === "commander" ? deck.commanders.filter((c, i) => (c.entryId === entry.id || !deck.entries && entry.id === `commander:${i}`) && c.itemId).length : 0);
  const legality = card?.legalities?.[formatOf(deck)] || "unverified";
  const age = now - Date.parse(card?.legalityCheckedAt || "");
  const freshness = legality === "unverified" || !Number.isFinite(age) || age < 0 ? "unverified" : age > 7 * 86400000 ? "stale" : "fresh";
  const explanations = [!printing ? card ? "Requested printing is unresolved; canonical card data is used for mechanics only." : "No unambiguous printing or canonical card match is available." : "Saved printing matches the requested card and printing identifiers."];
  if (finish === "unverified") explanations.push("The requested finish is retained but availability has not been verified.");
  if (finish === "unavailable") explanations.push("This printing does not list the requested finish. No inventory substitution was made.");
  if (card && card !== printing) explanations.push("Oracle text is taken from another matching canonical printing; original printing details are preserved.");
  if (oracle === "missing") explanations.push("Oracle text or type data is missing. No mechanical success is assumed.");
  if (mechanical?.unsupported) explanations.push(...mechanical.abilities.filter(a => a.status === "unsupported").map(a => `Unsupported ability: ${a.line}`));
  if (status === "full") explanations.push("All ability clauses are recognized by the current interpreter; this does not prove every interaction or competitive quality.");
  return { entry, card, identity, printing: printState, finish, oracle, mechanical, status, legality: { status: legality, freshness }, allocated, owned, basic: !!entry.basicLand || !!card && isBasicLand(card), explanations };
}
export function deckCoverage(state: CollectionState, deck: Deck, now = Date.now()): CoverageReport {
  const entries = intelligenceEntries(state, deck).map(entry => analyzeEntry(state, deck, entry, now));
  const counts: CoverageReport["counts"] = { full: { entries: 0, quantity: 0 }, partial: { entries: 0, quantity: 0 }, unresolved: { entries: 0, quantity: 0 }, unverified: { entries: 0, quantity: 0 } };
  const groups = new Map<string, CoverageReport["groups"][number]>();
  for (const row of entries) {
    counts[row.status].entries++; counts[row.status].quantity += row.entry.quantity;
    const group = groups.get(row.identity) || { identity: row.identity, name: row.card?.name || row.entry.name, main: 0, sideboard: 0, entries: [] };
    if (row.entry.board !== "commander") group[row.entry.board] += row.entry.quantity;
    group.entries.push(row.entry.id); groups.set(row.identity, group);
  }
  return { entries, counts, groups: [...groups.values()], total: entries.reduce((n, r) => n + r.entry.quantity, 0) };
}
