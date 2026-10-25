import { announceCollectionChange } from "./collectionSync";
import type {
  CollectionRepository,
  CollectionState,
} from "../models/collection";
const storageError = (error: unknown) => {
  if (error instanceof Error && error.name === "QuotaExceededError")
    return new Error(
      "This browser has run out of storage. No collection changes were saved. Free space and retry.", {cause:error},
    );
  return new Error(
    "Could not access browser storage. No collection changes were saved. Allow site storage and try again.", {cause:error},
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
      (!state.decks && item.quantityAssigned > item.quantityOwned) ||
      item.quantityUnassigned !== Math.max(0, item.quantityOwned - item.quantityAssigned) ||
      !Array.isArray(item.sourceRows)
    )
      throw new Error(
        "Saved collection records are inconsistent. They have not been overwritten.",
      );
    ids.add(item.id);
  }
  if (state.decks) {
    if (!Array.isArray(state.decks)) throw new Error('Saved decks are inconsistent. They have not been overwritten.');
    const deckIds = new Set<string>();
    const assigned = new Map<string,number>();
    for (const deck of state.decks) {
      if (!deck.id || deckIds.has(deck.id) || !deck.name?.trim() || !Array.isArray(deck.commanders) || !deck.commanders.length || !Array.isArray(deck.assignments) || !Number.isFinite(Date.parse(deck.createdAt)) || !Number.isFinite(Date.parse(deck.modifiedAt))) throw new Error('Saved decks are inconsistent. They have not been overwritten.');
      deckIds.add(deck.id);
      const assignmentIds = new Set<string>();
      const entries = deck.entries;
      const entryIds = new Set<string>();
      if (entries !== undefined) {
        if (!Array.isArray(entries)) throw new Error('Saved decklist is inconsistent.');
        for (const e of entries) {
          if (!e?.id || entryIds.has(e.id) || !['commander','main'].includes(e.board) || !Number.isSafeInteger(e.quantity) || e.quantity<1 || !e.name || !e.cardIdentity || !state.metadata[e.scryfallId]) throw new Error('Saved decklist entry is inconsistent.');
          entryIds.add(e.id);
        }
      }
      if (deck.importIssues !== undefined && (!Array.isArray(deck.importIssues) || deck.importIssues.some(i=>!Number.isSafeInteger(i?.line) || typeof i.text!=='string' || typeof i.reason!=='string'))) throw new Error('Saved deck import problems are inconsistent.');
      const linked = new Map<string,number>();
      for (const c of deck.commanders) {
        const item = c.itemId===undefined ? undefined : state.items.find(i=>i.id===c.itemId);
        if ((c.itemId!==undefined && (!item || c.scryfallId!==item.scryfallId)) || (c.itemId===undefined && !state.metadata[c.scryfallId]) || (c.entryId!==undefined && !entryIds.has(c.entryId)) || !c.cardIdentity || !c.name || !Array.isArray(c.colorIdentity) || c.colorIdentity.some(color=>!['W','U','B','R','G'].includes(color))) throw new Error('Saved commander reference is inconsistent.');
        if (c.itemId) assigned.set(c.itemId,(assigned.get(c.itemId)||0)+1);
        if (c.itemId && c.entryId) linked.set(c.entryId,(linked.get(c.entryId)||0)+1);
      }
      for (const a of deck.assignments) {
        const key = JSON.stringify([a.itemId,a.entryId||'']);
        if (!ids.has(a.itemId) || assignmentIds.has(key) || !Number.isSafeInteger(a.quantity) || a.quantity<1 || (a.entryId!==undefined && !entryIds.has(a.entryId))) throw new Error('Saved deck assignment is inconsistent.');
        assignmentIds.add(key);assigned.set(a.itemId,(assigned.get(a.itemId)||0)+a.quantity);
        if (a.entryId) linked.set(a.entryId,(linked.get(a.entryId)||0)+a.quantity);
      }
      // A decklist entry can lack copies, but never have more copies assigned than it lists.
      for (const e of entries || []) if ((linked.get(e.id)||0)>e.quantity) throw new Error('Saved decklist assignments exceed their entries.');
    }
    if (state.items.some(i=>i.quantityAssigned!==(assigned.get(i.id)||0))) throw new Error('Saved deck allocation totals are inconsistent.');
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
    if (!this.database) {
      const connection = new Promise<IDBDatabase>((resolve, reject) => {
        const request = this.factory.open(this.name, 1);
        request.onupgradeneeded = () => request.result.createObjectStore("state");
        request.onerror = () => reject(storageError(request.error));
        request.onblocked = () => reject(new Error("Another tab is blocking collection storage. Close other MTG Manager tabs and retry."));
        request.onsuccess = () => {
          const db = request.result;
          const invalidate = () => {
            // An older connection's late event must not evict its replacement.
            if (this.database === connection) this.database = null;
          };
          db.onclose = invalidate;
          db.onversionchange = () => { invalidate(); db.close(); };
          // A blocked open may already have rejected; don't leak its eventual connection.
          if (this.database !== connection) { db.close(); return; }
          resolve(db);
        };
      }).catch((error) => {
        if (this.database === connection) this.database = null;
        throw error;
      });
      this.database = connection;
    }
    return this.database;
  }
  private async transact<T>(mode:IDBTransactionMode, operation:(tx:IDBTransaction)=>Promise<T>):Promise<T> {
    for (let attempt=0;attempt<2;attempt++) {
      const connection=this.open();
      const db=await connection;
      let transaction:IDBTransaction;
      try { transaction=db.transaction("state",mode); }
      catch(error) {
        const detail=error && typeof error==='object' ? error as {name?:unknown;message?:unknown} : null;
        const closing=detail?.name==='InvalidStateError' || (typeof detail?.message==='string' && /(?:connection|database).*clos(?:ing|ed)/i.test(detail.message));
        if (!closing) throw storageError(error);
        if(this.database===connection)this.database=null;
        try { db.close(); } catch { /* Already unusable; invalidation is sufficient. */ }
        if(attempt===0)continue;
        throw storageError(error);
      }
      // Start requests/attach handlers immediately, without an await after transaction creation.
      // Only creation is retried: an uncertain or aborted write is NEVER replayed.
      return operation(transaction);
    }
    throw storageError(undefined);
  }
  async load(): Promise<CollectionState | null> {
    return this.transact("readonly", transaction=>new Promise((resolve,reject)=>{
      let result:CollectionState|null=null;
      let failure:unknown;
      const request=transaction.objectStore("state").get("collection");
      request.onsuccess=()=>{
        try { result=request.result===undefined?null:validateState(request.result); }
        catch(error) {failure=error;transaction.abort();}
      };
      request.onerror=()=>{failure=storageError(request.error);};
      transaction.oncomplete=()=>resolve(result);
      transaction.onabort=transaction.onerror=()=>reject(failure || storageError(transaction.error));
    }));
  }
  async save(next: CollectionState, expectedRevision: number): Promise<void> {
    validateState(next);
    if (next.revision !== expectedRevision + 1)
      throw new Error("Invalid collection revision. Reload the collection and try again.");
    return this.transact("readwrite", transaction=>new Promise<void>((resolve, reject) => {
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
            error instanceof Error && error.name === "Error"
              ? error // Preserve revision/validation messages; native storage errors stay controlled.
              : storageError(error);
          transaction.abort();
        }
      };
      transaction.oncomplete = () => {
        // Advisory only: other open tabs offer to load the newer revision.
        try { announceCollectionChange(next.revision); } catch { /* Notification is optional. */ }
        resolve();
      };
      transaction.onabort = transaction.onerror = () =>
        reject(failure || storageError(transaction.error));
    }));
  }
}
export const collectionRepository = new IndexedDbCollectionRepository();
