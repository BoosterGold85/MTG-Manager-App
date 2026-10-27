import type {
  CardMetadata,
  CollectionRepository,
  CollectionState,
} from "../models/collection";
import type { Deck, SavedDeckCandidate } from "../models/deck";
import { cardIdentity } from "../intelligence/tagger";
import { normalizedName } from "../import/csv";
import { deckPlayable, entryAssigned, isBasicLand, legalInDeck, newDeck, reconcileAllocations, sameCard } from "../decks/decks";
export type DeckChange =
  | { type: "create"; name: string; itemId: string }
  | { type: "rename"; deckId: string; name: string }
  | { type: "delete"; deckId: string }
  | { type: "add" | "remove"; deckId: string; itemId: string }
  | { type: "remove-missing"; deckId: string; entryId: string }
  | { type: "save-candidate"; deckId: string; candidate: Omit<SavedDeckCandidate, "id" | "createdAt"> }
  | { type: "remove-saved"; deckId: string; savedId: string }
  // One confirmed one-for-one swap: one card leaves the main deck and one owned copy joins it, in one revision.
  | {
      type: "swap";
      deckId: string;
      incomingItemId: string;
      outgoingCardIdentity: string;
      outgoingEntryId?: string;
      outgoingItemId?: string;
    }
  | {
      type: "import";
      deck: Deck;
      metadata: Record<string, CardMetadata>;
      allowDuplicateName: boolean;
    };
export interface DeckRepository {
  load(): Promise<Deck[]>;
  change(base: CollectionState, action: DeckChange): Promise<CollectionState>;
}
// An imported deck may only reference copies that are unassigned right now.
function checkImport(base: CollectionState, deck: Deck, allowDuplicateName: boolean) {
  if (!deck.name.trim()) throw new Error("Enter a deck name.");
  if ((base.decks || []).some((d) => d.id === deck.id)) throw new Error("This deck was already imported.");
  if (!allowDuplicateName && (base.decks || []).some((d) => normalizedName(d.name) === normalizedName(deck.name)))
    throw new Error("A deck with this name already exists. Existing decks are never overwritten.");
  if (!deck.commanders.length || deck.commanders.length > 2)
    throw new Error("Select one commander, or two for Partner/Background.");
  const wanted = new Map<string, number>();
  for (const c of deck.commanders) if (c.itemId) wanted.set(c.itemId, (wanted.get(c.itemId) || 0) + 1);
  for (const a of deck.assignments) {
    const item = base.items.find((i) => i.id === a.itemId);
    const card = item && base.metadata[item.scryfallId];
    if (!card) throw new Error("A selected printing is no longer in your collection. Prepare a fresh preview.");
    if (!legalInDeck(card, deck)) throw new Error(`${card.name} is outside the commander color identity.`);
    wanted.set(a.itemId, (wanted.get(a.itemId) || 0) + a.quantity);
  }
  for (const [itemId, quantity] of wanted) {
    const item = base.items.find((i) => i.id === itemId);
    if (!item || item.quantityUnassigned < quantity)
      throw new Error("Not enough unassigned copies remain for this import. No copies are taken from other decks. Prepare a fresh preview.");
  }
}
const identityOf = (base: CollectionState, scryfallId: string, fallback?: string) => {
  const card = base.metadata[scryfallId];
  return card ? cardIdentity(card) : fallback;
};
const matches = (base: CollectionState, id: string, scryfallId: string, entryIdentity?: string) => {
  const card = base.metadata[scryfallId];
  const byName = card && Object.values(base.metadata).find((c) => c.oracleId && normalizedName(c.name) === normalizedName(card.name));
  return entryIdentity === id || identityOf(base, scryfallId) === id || (!!byName && cardIdentity(byName) === id);
};
/** Adds one owned copy (or, for a basic land, one decklist copy that reserves nothing) to a deck being edited. */
function addOne(base: CollectionState, deck: Deck, itemId: string) {
  const item = base.items.find((i) => i.id === itemId);
  if (!item) throw new Error("This printing is no longer in your collection.");
  const card = base.metadata[item.scryfallId];
  if (!legalInDeck(card, deck)) throw new Error("This card is outside the commander color identity.");
  if (deck.entries && isBasicLand(card)) {
    // Basic lands are decklist resources: add to the list, keep the chosen printing, reserve nothing.
    const same = deck.entries.find((e) => e.board === "main" && base.metadata[e.scryfallId] && sameCard(base.metadata[e.scryfallId], card));
    if (same) {
      same.quantity++;
      same.basicLand = true;
    } else
      deck.entries.push({
        id: `${deck.id}:${crypto.randomUUID()}`, board: "main", quantity: 1, name: card.name, cardIdentity: cardIdentity(card),
        scryfallId: card.scryfallId, requestedPrinting: { setCode: item.setCode.toLowerCase(), collectorNumber: item.collectorNumber.toLowerCase() }, basicLand: true,
      });
    return;
  }
  if (item.quantityUnassigned < 1)
    throw new Error("No unassigned copy available. Release a copy from its deck first. No copies are taken from other decks.");
  let entryId: string | undefined;
  if (deck.entries) {
    // Fill a missing decklist entry for this card first; otherwise the decklist grows.
    const same = deck.entries.filter((e) => e.board === "main" && base.metadata[e.scryfallId] && sameCard(base.metadata[e.scryfallId], card));
    const target = same.find((e) => entryAssigned(deck, e) < e.quantity) || same[0];
    if (target) {
      if (entryAssigned(deck, target) >= target.quantity) target.quantity++;
      entryId = target.id;
    } else {
      entryId = `${deck.id}:${crypto.randomUUID()}`;
      deck.entries.push({ id: entryId, board: "main", quantity: 1, name: card.name, cardIdentity: cardIdentity(card), scryfallId: card.scryfallId });
    }
  }
  const assignment = deck.assignments.find((a) => a.itemId === item.id && a.entryId === entryId);
  if (assignment) assignment.quantity++;
  else deck.assignments.push({ itemId: item.id, quantity: 1, ...(entryId ? { entryId } : {}) });
}
/**
 * Removes one main-deck copy of a card by canonical identity. An entry deck loses one decklist copy and,
 * when that copy was physically assigned, releases one assignment; a missing or basic copy releases nothing.
 */
function removeOne(base: CollectionState, deck: Deck, identity: string, entryId?: string, itemId?: string) {
  if (deck.entries) {
    const candidates = deck.entries.filter((e) => e.board === "main" && matches(base, identity, e.scryfallId, e.cardIdentity));
    const entry = (entryId && candidates.find((e) => e.id === entryId)) || candidates.find((e) => entryAssigned(deck, e) < e.quantity) || candidates[0];
    if (!entry) throw new Error("The card to replace is no longer in this deck. Nothing was changed.");
    const assigned = entryAssigned(deck, entry);
    entry.quantity--;
    if (assigned > entry.quantity) {
      const linked = deck.assignments.filter((a) => a.entryId === entry.id);
      const assignment = (itemId && linked.find((a) => a.itemId === itemId)) || linked.at(-1);
      if (assignment) assignment.quantity--;
    }
    deck.entries = deck.entries.filter((e) => e.quantity > 0);
    deck.assignments = deck.assignments.filter((a) => a.quantity > 0);
    return;
  }
  const owned = deck.assignments.filter((a) => {
    const item = base.items.find((i) => i.id === a.itemId);
    return item && matches(base, identity, item.scryfallId);
  });
  const assignment = (itemId && owned.find((a) => a.itemId === itemId)) || owned.at(-1);
  if (!assignment) throw new Error("The card to replace is no longer in this deck. Nothing was changed.");
  assignment.quantity--;
  deck.assignments = deck.assignments.filter((a) => a.quantity > 0);
}
// Decks and ownership share one revision-checked transaction: never two independent writes.
export class LocalDeckRepository implements DeckRepository {
  constructor(private collection: CollectionRepository) {}
  async load() {
    return (await this.collection.load())?.decks || [];
  }
  async change(base: CollectionState, action: DeckChange) {
    let decks = structuredClone(base.decks || []);
    let metadata = base.metadata;
    const now = new Date().toISOString();
    if (action.type === "create")
      decks.push(newDeck(base, action.name, action.itemId));
    else if (action.type === "import") {
      checkImport(base, action.deck, action.allowDuplicateName);
      decks.push(structuredClone(action.deck));
      // Canonical card data for missing cards is added only where absent; owned metadata is never altered.
      metadata = { ...base.metadata };
      for (const [id, card] of Object.entries(action.metadata)) if (!metadata[id]) metadata[id] = card;
    } else {
      const deck = decks.find((d) => d.id === action.deckId);
      if (!deck)
        throw new Error("This deck no longer exists. Reload and retry.");
      if (action.type === "delete")
        decks = decks.filter((d) => d.id !== deck.id);
      else if (action.type === "rename") {
        if (!action.name.trim()) throw new Error("Enter a deck name.");
        deck.name = action.name.trim();
        deck.modifiedAt = now;
      } else if (action.type === "remove-missing") {
        const entry = deck.entries?.find((e) => e.id === action.entryId);
        if (!entry || entry.board !== "main" || entryAssigned(deck, entry) >= entry.quantity)
          throw new Error("No missing decklist card to remove.");
        entry.quantity--;
        deck.entries = deck.entries!.filter((e) => e.quantity > 0);
        deck.modifiedAt = now;
      } else if (action.type === "save-candidate") {
        const saved = deck.savedCandidates || [];
        // Saving the same candidate for the same goal again refreshes it instead of duplicating it.
        deck.savedCandidates = [
          ...saved.filter((c) => !(c.candidateIdentity === action.candidate.candidateIdentity && c.intent === action.candidate.intent)),
          { ...action.candidate, id: `saved:${crypto.randomUUID()}`, createdAt: now },
        ];
        deck.modifiedAt = now;
      } else if (action.type === "remove-saved") {
        if (!deck.savedCandidates?.some((c) => c.id === action.savedId)) throw new Error("This saved card was already removed.");
        deck.savedCandidates = deck.savedCandidates.filter((c) => c.id !== action.savedId);
        deck.modifiedAt = now;
      } else if (action.type === "swap") {
        // Validate against the state this write is based on; a stale base is also rejected by the revision check.
        const item = base.items.find((i) => i.id === action.incomingItemId);
        if (!item) throw new Error("The selected copy is no longer in your collection. Nothing was changed.");
        const card = base.metadata[item.scryfallId];
        const incoming = cardIdentity(card);
        if (incoming === action.outgoingCardIdentity) throw new Error("A card cannot replace itself. Nothing was changed.");
        if (deck.commanders.some((c) => c.cardIdentity === action.outgoingCardIdentity))
          throw new Error("The Commander is never swapped out. Nothing was changed.");
        if (!deckPlayable(card)) throw new Error(`${card.name} can't be played in a Commander deck. Nothing was changed.`);
        removeOne(base, deck, action.outgoingCardIdentity, action.outgoingEntryId, action.outgoingItemId);
        addOne(base, deck, item.id);
        deck.savedCandidates = deck.savedCandidates?.filter((c) => c.candidateIdentity !== incoming);
        deck.modifiedAt = now;
      } else if (action.type === "add") {
        addOne(base, deck, action.itemId);
        deck.modifiedAt = now;
      } else {
        const item = base.items.find((i) => i.id === action.itemId);
        if (!item)
          throw new Error("This printing is no longer in your collection.");
        const assignment = [...deck.assignments].reverse().find((a) => a.itemId === item.id);
        if (!assignment)
          throw new Error("No deck card assignment to remove.");
        assignment.quantity--;
        // Removing a deck card removes it from the decklist too; collection ownership is unchanged.
        const entry = deck.entries?.find((e) => e.id === assignment.entryId);
        if (entry) {
          entry.quantity--;
          deck.entries = deck.entries!.filter((e) => e.quantity > 0);
        }
        deck.assignments = deck.assignments.filter((a) => a.quantity > 0);
        deck.modifiedAt = now;
      }
    }
    return this.commit(base, decks, metadata);
  }
  private async commit(base: CollectionState, decks: Deck[], metadata: CollectionState["metadata"]) {
    const next = reconcileAllocations({
      ...base,
      metadata,
      decks,
      revision: base.revision + 1,
    });
    await this.collection.save(next, base.revision);
    return next;
  }
}
