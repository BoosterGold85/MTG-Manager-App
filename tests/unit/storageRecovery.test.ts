import { it, expect, vi } from "vitest";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { IndexedDbCollectionRepository } from "../../src/storage/collectionRepository";
import { emptyCollection } from "../../src/models/collection";
function fixture(hook?: (db: IDBDatabase) => void) {
  const factory = new IDBFactory(),
    connections: IDBDatabase[] = [];
  const original = factory.open.bind(factory);
  const opens = vi
    .spyOn(factory, "open")
    .mockImplementation((name, version) => {
      const request = original(name, version);
      request.addEventListener("success", () => {
        connections.push(request.result);
        hook?.(request.result);
      });
      return request;
    });
  const repository = new IndexedDbCollectionRepository("recovery", factory);
  return { repository, connections, opens, factory };
}
it("a cached explicitly closed connection is reopened once before loading the unchanged snapshot", async () => {
  const f = fixture(),
    state = { ...emptyCollection(), revision: 1 };
  await f.repository.save(state, 0);
  f.connections[0].close();
  expect(await f.repository.load()).toEqual(state);
  expect(f.opens).toHaveBeenCalledTimes(2);
  expect(await f.repository.load()).toEqual(state);
  expect(f.opens).toHaveBeenCalledTimes(2);
});
it("save retries only transaction creation, writes once and retains revision concurrency protection", async () => {
  const f = fixture(),
    state = { ...emptyCollection(), revision: 1 };
  await f.repository.save(state, 0);
  f.connections[0].close();
  const puts = vi.spyOn(IDBObjectStore.prototype, "put");
  const next = { ...state, revision: 2 };
  await f.repository.save(next, 1);
  expect(puts).toHaveBeenCalledTimes(1);
  puts.mockRestore();
  expect(f.opens).toHaveBeenCalledTimes(2);
  expect(await f.repository.load()).toEqual(next);
  await expect(f.repository.save(next, 1)).rejects.toThrow("another tab");
  expect(await f.repository.load()).toEqual(next);
});
it("concurrent loads holding the old resolved promise share a replacement without evicting it", async () => {
  const f = fixture(),
    state = { ...emptyCollection(), revision: 1 };
  await f.repository.save(state, 0);
  const first = f.repository.load(),
    second = f.repository.load();
  f.connections[0].close();
  expect(await Promise.all([first, second])).toEqual([state, state]);
  expect(f.opens).toHaveBeenCalledTimes(2);
});
it("close and versionchange invalidate the cache; a late old close cannot clear a newer connection", async () => {
  const f = fixture();
  await f.repository.load();
  const old = f.connections[0],
    lateClose = old.onclose!;
  old.onversionchange!.call(old, {} as IDBVersionChangeEvent);
  await f.repository.load();
  expect(f.opens).toHaveBeenCalledTimes(2);
  lateClose.call(old, {} as Event);
  await f.repository.load();
  expect(f.opens).toHaveBeenCalledTimes(2);
  const current = f.connections[1];
  current.onclose!.call(current, {} as Event);
  current.close();
  await f.repository.load();
  expect(f.opens).toHaveBeenCalledTimes(3);
});
for (const mode of ["load", "save"] as const)
  it(`persistent transaction-start failure during ${mode} stops after two attempts with a controlled error`, async () => {
    let fail = false,
      attempts = 0;
    const f = fixture((db) => {
      const original = db.transaction.bind(db);
      vi.spyOn(db, "transaction").mockImplementation(
        (...args: Parameters<IDBDatabase["transaction"]>) => {
          if (fail) {
            attempts++;
            throw new DOMException(
              "The database connection is closing.",
              "InvalidStateError",
            );
          }
          return original(...args);
        },
      );
    });
    const state = { ...emptyCollection(), revision: 1 };
    await f.repository.save(state, 0);
    fail = true;
    const error = await (
      mode === "load"
        ? f.repository.load()
        : f.repository.save({ ...state, revision: 2 }, 1)
    ).catch((e) => e);
    expect(attempts).toBe(2);
    expect(error.message).toContain("Could not access browser storage");
    expect(error.message).not.toContain("transaction");
    expect(error.cause.name).toBe("InvalidStateError");
    fail = false;
    expect(await f.repository.load()).toEqual(state);
  });
it("a failed write after transaction creation is not retried or duplicated", async () => {
  const f = fixture(),
    state = { ...emptyCollection(), revision: 1 };
  await f.repository.save(state, 0);
  const puts = vi
    .spyOn(IDBObjectStore.prototype, "put")
    .mockImplementation(() => {
      throw new DOMException("Disk unavailable", "UnknownError");
    });
  await expect(f.repository.save({ ...state, revision: 2 }, 1)).rejects.toThrow(
    "Could not access browser storage",
  );
  expect(puts).toHaveBeenCalledTimes(1);
  expect(f.opens).toHaveBeenCalledTimes(1);
  puts.mockRestore();
  expect(await f.repository.load()).toEqual(state);
});
it("recognizes closing errors by name across realms rather than requiring Error inheritance", async () => {
  const f = fixture(),
    state = { ...emptyCollection(), revision: 1 };
  await f.repository.save(state, 0);
  vi.spyOn(f.connections[0], "transaction").mockImplementationOnce(() => {
    throw { name: "InvalidStateError", message: "Connection unavailable" };
  });
  expect(await f.repository.load()).toEqual(state);
  expect(f.opens).toHaveBeenCalledTimes(2);
});
it('a retry after connection closure still rejects a snapshot made stale by another tab', async () => {
  const f = fixture(), state = { ...emptyCollection(), revision: 1 };
  await f.repository.save(state, 0);
  f.connections[0].close();
  const other = new IndexedDbCollectionRepository('recovery', f.factory);
  const updated = { ...state, revision: 2 };
  await other.save(updated, 1);
  const puts = vi.spyOn(IDBObjectStore.prototype, 'put');
  await expect(f.repository.save(updated, 1)).rejects.toThrow('another tab');
  expect(puts).not.toHaveBeenCalled();
  puts.mockRestore();
  expect(await f.repository.load()).toEqual(updated);
});
