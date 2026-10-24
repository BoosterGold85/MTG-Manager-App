import { it, expect } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { announceCollectionChange, subscribeCollectionChanges, TAB_ID } from "../../src/storage/collectionSync";
import { IndexedDbCollectionRepository } from "../../src/storage/collectionRepository";
import { emptyCollection } from "../../src/models/collection";
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));
it("delivers other tabs' revisions and ignores this tab's own announcements", async () => {
  const seen: number[] = [];
  const stop = subscribeCollectionChanges((change) => seen.push(change.revision));
  announceCollectionChange(3);
  const other = new BroadcastChannel("mtg-manager-collection");
  other.postMessage({ revision: 7, source: "another-tab" });
  other.postMessage({ revision: "bad", source: "another-tab" });
  await tick();
  other.close();
  stop();
  expect(seen).toEqual([7]);
});
it("a committed save announces its new revision; a rejected stale save announces nothing", async () => {
  const heard: { revision: number; source: string }[] = [];
  const listener = new BroadcastChannel("mtg-manager-collection");
  listener.onmessage = (event) => heard.push(event.data);
  const repo = new IndexedDbCollectionRepository(crypto.randomUUID(), new IDBFactory());
  await repo.save({ ...emptyCollection(), revision: 1 }, 0);
  await expect(repo.save({ ...emptyCollection(), revision: 1 }, 0)).rejects.toThrow(/changed in another tab/);
  await tick();
  listener.close();
  expect(heard).toEqual([{ revision: 1, source: TAB_ID }]);
});
