import { describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { META_TTL_MS, readSelectorMeta, refreshSelectorMeta } from "../../src/upgradeSelector/metadata";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-11-26T12:00:00Z");

function collectionFetch(cards: Record<string, { released_at?: string; edhrec_rank?: number }>) {
  return vi.fn(async (_url: unknown, init?: RequestInit) => {
    const ids = (JSON.parse(String(init?.body)).identifiers as { id: string }[]).map((i) => i.id);
    const data = ids.filter((id) => cards[id]).map((id) => ({ id, ...cards[id] }));
    return new Response(JSON.stringify({ object: "list", data, not_found: ids.filter((id) => !cards[id]).map((id) => ({ id })) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

describe("upgrade selector metadata cache", () => {
  it("fetches release date and EDHREC rank by Scryfall id and stores them", async () => {
    const factory = new IDBFactory();
    const fetcher = collectionFetch({ a: { released_at: "2010-05-01", edhrec_rank: 9000 } });
    const result = await refreshSelectorMeta(["a"], { fetcher: fetcher as unknown as typeof fetch, factory, now: NOW });
    expect(result.interrupted).toBe(false);
    expect(result.meta.get("a")).toMatchObject({ releasedAt: "2010-05-01", edhrecRank: 9000 });
    expect((await readSelectorMeta(["a"], factory)).get("a")?.edhrecRank).toBe(9000);
  });

  it("serves fresh rows from the cache without a second request", async () => {
    const factory = new IDBFactory();
    const fetcher = collectionFetch({ a: { released_at: "2010-05-01", edhrec_rank: 9000 } });
    await refreshSelectorMeta(["a"], { fetcher: fetcher as unknown as typeof fetch, factory, now: NOW });
    await refreshSelectorMeta(["a"], { fetcher: fetcher as unknown as typeof fetch, factory, now: NOW + DAY });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("refetches rows older than the weekly TTL", async () => {
    const factory = new IDBFactory();
    const fetcher = collectionFetch({ a: { released_at: "2010-05-01", edhrec_rank: 9000 } });
    await refreshSelectorMeta(["a"], { fetcher: fetcher as unknown as typeof fetch, factory, now: NOW });
    await refreshSelectorMeta(["a"], { fetcher: fetcher as unknown as typeof fetch, factory, now: NOW + META_TTL_MS + 1 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("caches unknown cards as unknown so they are not re-requested on every visit", async () => {
    const factory = new IDBFactory();
    const fetcher = collectionFetch({});
    const result = await refreshSelectorMeta(["missing"], { fetcher: fetcher as unknown as typeof fetch, factory, now: NOW });
    expect(result.meta.get("missing")?.releasedAt).toBeUndefined();
    await refreshSelectorMeta(["missing"], { fetcher: fetcher as unknown as typeof fetch, factory, now: NOW + DAY });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("marks the refresh interrupted on a transient failure instead of inventing data", async () => {
    const factory = new IDBFactory();
    const fetcher = vi.fn(async () => new Response("busy", { status: 503 }));
    const result = await refreshSelectorMeta(["a"], { fetcher: fetcher as unknown as typeof fetch, factory, now: NOW });
    expect(result.interrupted).toBe(true);
    expect(result.meta.has("a")).toBe(false);
  });

  it("works without IndexedDB, falling back to uncached lookups", async () => {
    const fetcher = collectionFetch({ a: { released_at: "2010-05-01", edhrec_rank: 9000 } });
    const result = await refreshSelectorMeta(["a"], { fetcher: fetcher as unknown as typeof fetch, factory: undefined, now: NOW });
    expect(result.meta.get("a")?.releasedAt).toBe("2010-05-01");
  });
});
