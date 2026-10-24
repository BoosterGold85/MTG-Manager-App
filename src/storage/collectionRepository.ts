import type {
  CollectionRepository,
  CollectionState,
} from "../models/collection";
const storageError = (error: unknown) => {
  if (error instanceof Error && error.name === "QuotaExceededError")
    return new Error(
      "This browser has run out of storage. No collection changes were saved. Free space and retry.",
    );
  return new Error(
    "Could not access browser storage. No collection changes were saved. Allow site storage and try again.",
  );
};
export function validateState(value: unknown): CollectionState {
  const state = value as CollectionState | null;
  if (
    !state ||
    state.schemaVersion !== 1 ||
    !Number.isSafeInteger(state.revision) ||
    state.revision < 0 ||
    !Array.isArray(state.items) ||
    !state.metadata ||
    !state.nameMatches ||
    !Array.isArray(state.unresolved)
  )
    throw new Error(
      "Saved collection data is not supported or could not be read. It has not been overwritten.",
    );
  if (state.intelligence) {
    const intelligence=state.intelligence;
    if (!intelligence.auto || !intelligence.overrides || Array.isArray(intelligence.auto) || Array.isArray(intelligence.overrides))
      throw new Error("Saved card intelligence is inconsistent. It has not been overwritten.");
    for (const analysis of Object.values(intelligence.auto)) {
      if (!analysis || typeof analysis.rulesetVersion !== 'string' || !Array.isArray(analysis.assignments) || !analysis.creatureTypes || !Array.isArray(analysis.creatureTypes.own) || !Array.isArray(analysis.creatureTypes.referenced) || !Array.isArray(analysis.creatureTypes.synergy) || analysis.assignments.some(a=>!a.tagId || !Array.isArray(a.evidence) || !Number.isFinite(a.confidence)))
        throw new Error("Saved card intelligence is inconsistent. It has not been overwritten.");
    }
    for (const override of Object.values(intelligence.overrides)) {
      if (!override || !Array.isArray(override.added) || !Array.isArray(override.suppressed) || [...override.added,...override.suppressed].some(id=>typeof id !== 'string'))
        throw new Error("Saved tag corrections are inconsistent. They have not been overwritten.");
    }
  }
  const ids = new Set<string>();
  for (const item of state.items) {
    const card = state.metadata[item.scryfallId];
    if (
      !item.id ||
      ids.has(item.id) ||
      !card ||
      !card.name ||
      !Array.isArray(card.colorIdentity) ||
      !Number.isSafeInteger(item.quantityOwned) ||
      !Number.isSafeInteger(item.quantityAssigned) ||
      item.quantityOwned < 0 ||
      item.quantityAssigned < 0 ||
      item.quantityAssigned > item.quantityOwned ||
      item.quantityUnassigned !== item.quantityOwned - item.quantityAssigned ||
      !Array.isArray(item.sourceRows)
    )
      throw new Error(
        "Saved collection records are inconsistent. They have not been overwritten.",
      );
    ids.add(item.id);
  }
  return state;
}
export class IndexedDbCollectionRepository implements CollectionRepository {
  private database: Promise<IDBDatabase> | null = null;
  constructor(
    private name = "mtg-manager-collection",
    private factory: IDBFactory = globalThis.indexedDB,
  ) {}
  private open(): Promise<IDBDatabase> {
    if (!this.factory)
      return Promise.reject(
        new Error(
          "This browser does not support local collection storage. Use a browser with IndexedDB enabled.",
        ),
      );
    if (!this.database)
      this.database = new Promise<IDBDatabase>((resolve, reject) => {
        const request = this.factory.open(this.name, 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("state");
        request.onerror = () => reject(storageError(request.error));
        request.onblocked = () =>
          reject(
            new Error(
              "Another tab is blocking collection storage. Close other MTG Manager tabs and retry.",
            ),
          );
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => {
            db.close();
            this.database = null;
          };
          resolve(db);
        };
      }).catch((error) => {
        this.database = null;
        throw error;
      });
    return this.database;
  }
  async load(): Promise<CollectionState | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("state", "readonly");
      const request = transaction.objectStore("state").get("collection");
      request.onsuccess = () => {
        try {
          resolve(
            request.result === undefined ? null : validateState(request.result),
          );
        } catch (error) {
          reject(error);
        }
      };
      request.onerror = () => reject(storageError(request.error));
    });
  }
  async save(next: CollectionState, expectedRevision: number): Promise<void> {
    validateState(next);
    if (next.revision !== expectedRevision + 1)
      throw new Error("Invalid collection revision. Reload the collection and try again.");
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("state", "readwrite");
      let failure: Error | null = null;
      const store = transaction.objectStore("state");
      const request = store.get("collection");
      request.onsuccess = () => {
        try {
          const current =
            request.result === undefined ? null : validateState(request.result);
          if ((current?.revision || 0) !== expectedRevision)
            throw new Error(
              "The collection changed in another tab. Reload the collection and try again. For an import, prepare a fresh preview.",
            );
          store.put(next, "collection");
        } catch (error) {
          failure =
            error instanceof Error && error.name === "QuotaExceededError"
              ? storageError(error)
              : error instanceof Error
                ? error
                : new Error("Could not save this collection.");
          transaction.abort();
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () =>
        reject(failure || storageError(transaction.error));
    });
  }
}
export const collectionRepository = new IndexedDbCollectionRepository();
