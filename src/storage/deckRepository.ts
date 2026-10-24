import type {
  CollectionRepository,
  CollectionState,
} from "../models/collection";
import type { Deck } from "../models/deck";
import { legalInDeck, newDeck, reconcileAllocations } from "../decks/decks";
export type DeckChange =
  | { type: "create"; name: string; itemId: string }
  | { type: "rename"; deckId: string; name: string }
  | { type: "delete"; deckId: string }
  | { type: "add" | "remove"; deckId: string; itemId: string };
export interface DeckRepository {
  load(): Promise<Deck[]>;
  change(base: CollectionState, action: DeckChange): Promise<CollectionState>;
}
// Decks and ownership share one revision-checked transaction: never two independent writes.
export class LocalDeckRepository implements DeckRepository {
  constructor(private collection: CollectionRepository) {}
  async load() {
    return (await this.collection.load())?.decks || [];
  }
  async change(base: CollectionState, action: DeckChange) {
    let decks = structuredClone(base.decks || []);
    const now = new Date().toISOString();
    if (action.type === "create")
      decks.push(newDeck(base, action.name, action.itemId));
    else {
      const deck = decks.find((d) => d.id === action.deckId);
      if (!deck)
        throw new Error("This deck no longer exists. Reload and retry.");
      if (action.type === "delete")
        decks = decks.filter((d) => d.id !== deck.id);
      else if (action.type === "rename") {
        if (!action.name.trim()) throw new Error("Enter a deck name.");
        deck.name = action.name.trim();
        deck.modifiedAt = now;
      } else {
        const item = base.items.find((i) => i.id === action.itemId);
        if (!item)
          throw new Error("This printing is no longer in your collection.");
        const assignment = deck.assignments.find((a) => a.itemId === item.id);
        if (action.type === "add") {
          if (!legalInDeck(base.metadata[item.scryfallId], deck))
            throw new Error(
              "This card is outside the commander color identity.",
            );
          if (item.quantityUnassigned < 1)
            throw new Error(
              "No unassigned copy available. Release a copy from its deck first.",
            );
          if (assignment) assignment.quantity++;
          else deck.assignments.push({ itemId: item.id, quantity: 1 });
        } else {
          if (!assignment)
            throw new Error("No deck card assignment to remove.");
          assignment.quantity--;
          deck.assignments = deck.assignments.filter((a) => a.quantity > 0);
        }
        deck.modifiedAt = now;
      }
    }
    const next = reconcileAllocations({
      ...base,
      decks,
      revision: base.revision + 1,
    });
    await this.collection.save(next, base.revision);
    return next;
  }
}
