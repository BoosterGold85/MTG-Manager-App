import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { exportCsv, fixtureRow, sol, meren } from "../importFixtures";
async function nav(page: Page, label: string) {
  await page
    .getByRole("navigation")
    .filter({ visible: true })
    .getByRole("button", { name: label, exact: true })
    .click();
}
async function snapshot(page: Page) {
  return page.evaluate(
    async () =>
      await new Promise<Record<string, unknown>>((resolve, reject) => {
        const r = indexedDB.open("mtg-manager-collection", 1);
        r.onsuccess = () => {
          const db = r.result,
            tx = db.transaction("state", "readonly"),
            get = tx.objectStore("state").get("collection");
          tx.oncomplete = () => {
            db.close();
            resolve(get.result);
          };
          tx.onerror = () => reject(tx.error);
        };
        r.onerror = () => reject(r.error);
      }),
  );
}
async function setup(page: Page) {
  await page.goto("/");
  await expect(page.locator(".card-tile")).toHaveCount(32);
  await page
    .getByRole("button", { name: "Import Collection", exact: true })
    .first()
    .click();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "owned.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        exportCsv([fixtureRow(sol, 3), fixtureRow(meren, 2)]),
      ),
    });
  await page
    .getByRole("button", { name: "Confirm import", exact: true })
    .click();
  await page.getByRole("button", { name: "Return to binder" }).click();
  await nav(page, "Decks");
  await page.getByRole("button", { name: "New Deck", exact: true }).click();
  await page.getByRole("textbox", { name: "Deck name" }).fill("Existing deck");
  await page
    .getByRole("button", { name: "Choose Commander", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Meren of Clan Nel Toth/ })
    .click();
  await page.getByRole("button", { name: "All decks", exact: true }).click();
}
async function preview(page: Page) {
  await page.getByRole("button", { name: "Import Deck", exact: true }).click();
  await page
    .getByRole("button", { name: "Paste decklist text", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Decklist text" })
    .fill(
      `Commander\n1 ${meren.name} (${meren.setCode}) ${meren.collectorNumber}\nDeck\n99 ${sol.name} (${sol.setCode}) ${sol.collectorNumber}`,
    );
  await page
    .getByRole("button", { name: "Preview import", exact: true })
    .click();
}
test("storage failure blocks the 100-card ownership preview and confirmation; retry reads real ownership without touching saved data", async ({
  page,
}) => {
  await setup(page);
  const before = await snapshot(page);
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (
      ...args: Parameters<IDBDatabase["transaction"]>
    ) {
      if (this.name === "mtg-manager-collection" && args[1] === "readonly")
        throw new DOMException(
          "The database connection is closing.",
          "InvalidStateError",
        );
      return original.apply(this, args);
    };
    Object.assign(window, {
      restoreOwnershipStorage: () => {
        IDBDatabase.prototype.transaction = original;
      },
    });
  });
  await preview(page);
  await expect(page.getByRole("alert")).toContainText(
    "could not read your collection from this device",
  );
  await expect(
    page.getByRole("button", { name: "Confirm import", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("region", { name: "Import summary" }),
  ).toHaveCount(0);
  await expect(page.getByRole("dialog")).not.toContainText(
    "Failed to execute 'transaction'",
  );
  await page.evaluate(() => {
    (
      window as unknown as { restoreOwnershipStorage: () => void }
    ).restoreOwnershipStorage();
  });
  expect(await snapshot(page)).toEqual(before);
  await page
    .getByRole("button", { name: "Retry ownership check", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Decklist preview" }),
  ).toBeVisible();
  const summary = page.getByRole("dialog").getByRole("definition");
  await expect(summary.nth(0)).toHaveText("100");
  await expect(summary.nth(1)).toHaveText("4");
  await expect(summary.nth(4)).toHaveText("0");
  expect(await snapshot(page)).toEqual(before);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await snapshot(page)).toEqual(before);
});
test("closing cached connections recover before preview and save, committing a new deck exactly once", async ({
  page,
}) => {
  await setup(page);
  const before = await snapshot(page);
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    let read = true,
      write = true;
    let writes = 0;
    IDBDatabase.prototype.transaction = function (
      ...args: Parameters<IDBDatabase["transaction"]>
    ) {
      if (
        this.name === "mtg-manager-collection" &&
        ((args[1] === "readonly" && read) || (args[1] === "readwrite" && write))
      ) {
        if (args[1] === "readonly") read = false;
        else write = false;
        this.close();
        throw new DOMException(
          "The database connection is closing.",
          "InvalidStateError",
        );
      }
      if (this.name === "mtg-manager-collection" && args[1] === "readwrite")
        writes++;
      return original.apply(this, args);
    };
    Object.assign(window, { storageWriteCount: () => writes });
  });
  await preview(page);
  await expect(
    page.getByRole("region", { name: "Decklist preview" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByRole("definition").nth(1),
  ).toHaveText("4");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Deck name" })
    .fill("Recovered import");
  await page
    .getByRole("button", { name: "Confirm import", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Recovered import", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      (
        window as unknown as { storageWriteCount: () => number }
      ).storageWriteCount(),
    ),
  ).toBe(1);
  const after = await snapshot(page);
  expect(after.revision).toBe(Number(before.revision) + 1);
  expect((after.decks as unknown[]).length).toBe(2);
  expect((after.decks as unknown[])[0]).toEqual((before.decks as unknown[])[0]);
  expect(after.metadata).toEqual(before.metadata);
  const owned = (s: Record<string, unknown>) =>
    (s.items as { id: string; quantityOwned: number }[]).map((i) => [
      i.id,
      i.quantityOwned,
    ]);
  expect(owned(after)).toEqual(owned(before));
});
