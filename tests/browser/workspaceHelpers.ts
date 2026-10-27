import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { CollectionState } from "../../src/models/collection";

export async function readState(page: Page) {
  return page.evaluate(
    async () =>
      await new Promise<CollectionState>((resolve, reject) => {
        const request = indexedDB.open("mtg-manager-collection", 1);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction("state", "readonly"),
            get = tx.objectStore("state").get("collection");
          tx.oncomplete = () => {
            db.close();
            resolve(get.result);
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}
export async function writeState(page: Page, state: CollectionState) {
  await page.evaluate(
    async (s) =>
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("mtg-manager-collection", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("state");
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction("state", "readwrite");
          tx.objectStore("state").put(s, "collection");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    state,
  );
}
/** Seeds a saved collection, then opens the named deck (optionally on a section). */
export async function seed(page: Page, state: CollectionState, deckName: string, tab = "") {
  await page.goto("/");
  await expect(page.locator(".card-tile")).toHaveCount(32);
  await writeState(page, state);
  await page.reload();
  await expect(page.locator(".sample-label")).toHaveText("YOUR COLLECTION");
  await page.getByRole("navigation").filter({ visible: true }).getByRole("button", { name: "Decks", exact: true }).click();
  await page.locator(".deck-card").filter({ hasText: deckName }).click();
  await expect(page.getByRole("heading", { name: deckName, exact: true })).toBeVisible();
  if (tab) await section(page, tab);
}
export const section = (page: Page, name: string) => page.getByRole("navigation", { name: "Deck sections" }).getByRole("button", { name, exact: true }).click();
