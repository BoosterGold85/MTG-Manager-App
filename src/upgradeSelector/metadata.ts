// Release date and EDHREC rank for the Upgrade Selector. A separate IndexedDB database: existing
// collection, deck and metadata stores are never opened, migrated or cleared by this module.
// Refreshed on demand through the same-origin lookup proxy, never more than once a week per card.
import { siteLookupFetch } from "../import/transport";

export const SELECTOR_DB = "mtg-upgrade-selector";
export const SELECTOR_DB_VERSION = 1;
export const SELECTOR_STORE = "meta";
export const META_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const BATCH = 75;

export interface SelectorMeta {
  scryfallId: string;
  releasedAt?: string;
  edhrecRank?: number | null;
  fetchedAt: string;
}

export interface MetaRefresh {
  meta: Map<string, SelectorMeta>;
  /** True when any batch failed. Obscurity for the affected cards is provisional, not proof they are common. */
  interrupted: boolean;
}

function open(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(SELECTOR_DB, SELECTOR_DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(SELECTOR_STORE, { keyPath: "scryfallId" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Upgrade Selector cache blocked"));
  });
}

/** Reads cached rows. Any storage failure returns an empty map, so the selector still works, just with more lookups. */
export async function readSelectorMeta(ids: string[], factory: IDBFactory | undefined = globalThis.indexedDB): Promise<Map<string, SelectorMeta>> {
  const out = new Map<string, SelectorMeta>();
  if (!factory || !ids.length) return out;
  try {
    const db = await open(factory);
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(SELECTOR_STORE, "readonly");
        const store = tx.objectStore(SELECTOR_STORE);
        for (const id of ids) {
          const request = store.get(id);
          request.onsuccess = () => request.result && out.set(id, request.result as SelectorMeta);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  } catch {
    return new Map();
  }
  return out;
}

async function writeSelectorMeta(rows: SelectorMeta[], factory: IDBFactory | undefined) {
  if (!factory || !rows.length) return;
  try {
    const db = await open(factory);
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(SELECTOR_STORE, "readwrite");
        for (const row of rows) tx.objectStore(SELECTOR_STORE).put(row);
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  } catch {
    // A failed cache write only costs a later lookup.
  }
}

interface CollectionResponse {
  data?: { id?: string; released_at?: string; edhrec_rank?: number }[];
}

/** Returns fresh metadata for every id, fetching only missing or stale rows. Transient failures set `interrupted`. */
export async function refreshSelectorMeta(
  ids: string[],
  options: { fetcher?: typeof fetch; factory?: IDBFactory | undefined; now?: number; signal?: AbortSignal } = {},
): Promise<MetaRefresh> {
  const fetcher = options.fetcher ?? siteLookupFetch;
  const factory = options.factory === undefined ? globalThis.indexedDB : options.factory;
  const now = options.now ?? Date.now();
  const unique = [...new Set(ids)];
  const cached = await readSelectorMeta(unique, factory);
  const meta = new Map<string, SelectorMeta>();
  const stale: string[] = [];
  for (const id of unique) {
    const row = cached.get(id);
    if (row && now - Date.parse(row.fetchedAt) < META_TTL_MS) meta.set(id, row);
    else stale.push(id);
  }
  let interrupted = false;
  for (let start = 0; start < stale.length; start += BATCH) {
    const batch = stale.slice(start, start + BATCH);
    try {
      const response = await fetcher("https://api.scryfall.com/cards/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ identifiers: batch.map((id) => ({ id })) }),
        signal: options.signal,
      });
      if (!response.ok) throw new Error(`lookup ${response.status}`);
      const json = (await response.json()) as CollectionResponse;
      const fetchedAt = new Date(now).toISOString();
      const rows: SelectorMeta[] = (json.data || []).flatMap((card) =>
        card.id && batch.includes(card.id)
          ? [{ scryfallId: card.id, releasedAt: card.released_at, edhrecRank: card.edhrec_rank ?? null, fetchedAt }]
          : [],
      );
      // Cards Scryfall did not return are cached as unknown, so they are not re-requested every visit.
      for (const id of batch) if (!rows.some((row) => row.scryfallId === id)) rows.push({ scryfallId: id, fetchedAt });
      await writeSelectorMeta(rows, factory);
      for (const row of rows) meta.set(row.scryfallId, row);
    } catch (error) {
      if (options.signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) throw error;
      interrupted = true;
    }
  }
  return { meta, interrupted };
}
