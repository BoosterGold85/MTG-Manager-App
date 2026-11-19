import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { synergyFixture } from "../synergyFixtures";
import { section } from "./workspaceHelpers";

// Recommended from your collection: the Upgrades landing shows owned, explained interactions with no goal to configure,
// reads the collection without writing it, and stays usable at phone width.
async function snapshot(page: Page) {
  return page.evaluate(
    async () =>
      await new Promise<unknown>((resolve, reject) => {
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
  const f = synergyFixture();
  f.state.revision = 1;
  await page.goto("/");
  await expect(page.locator(".card-tile")).toHaveCount(32);
  await page.evaluate(async (state) => {
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open("mtg-manager-collection", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("state");
      r.onsuccess = () => {
        const db = r.result,
          tx = db.transaction("state", "readwrite");
        tx.objectStore("state").put(state, "collection");
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, f.state);
  await page.reload();
  await expect(page.locator(".sample-label")).toHaveText("YOUR COLLECTION");
  await page.getByRole("navigation").filter({ visible: true }).getByRole("button", { name: "Decks", exact: true }).click();
  await page.locator(".deck-card").filter({ hasText: "Regression Deck" }).click();
  await expect(page.getByRole("heading", { name: "Regression Deck", exact: true })).toBeVisible();
}

test("Upgrades opens to recommendations from the owned collection, explained and read-only", async ({ page }, info) => {
  await setup(page);
  const before = await snapshot(page);
  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/scryfall/")) calls.push(r.url());
  });
  await section(page, "Upgrades");
  await expect(page).toHaveURL(/tab=upgrades/);
  const upgrades = page.getByRole("region", { name: "Upgrades", exact: true });
  // No goal to configure: the landing is the recommendation list, and the two goals sit below it.
  await expect(upgrades.getByRole("heading", { name: "Recommended from your collection" })).toBeVisible();
  await expect(upgrades.getByRole("status")).toHaveText(/^\d+ recommendations?$/, { timeout: 15000 });
  const count = Number((await upgrades.getByRole("status").textContent())!.match(/^(\d+)/)![1]);
  expect(count).toBeGreaterThan(0);
  const cards = upgrades.locator(".discovery-card");
  // Pages of ten: the list never floods the phone screen.
  await expect(cards).toHaveCount(Math.min(count, 10));
  const first = cards.first();
  await expect(first.locator(".strength-chip")).toHaveText(/Strongly supported|Plausible|Speculative/);
  for (const label of ["Why it's interesting", "Works with", "What happens", "Availability", "Potential change", "Confidence"]) {
    await expect(first).toContainText(label);
  }
  // Ownership is explicit on every card; an incomplete deck gets add-only recommendations.
  await expect(first).toContainText(/Available \d+ · Owned \d+|No available copy/);
  await expect(first.getByRole("button", { name: "Add to Deck" })).toHaveCount(1);
  await expect(first.getByRole("button", { name: "Review Swap" })).toHaveCount(0);
  await expect(first.getByRole("button", { name: "Save" })).toHaveCount(1);
  await expect(upgrades.getByRole("region", { name: "Explore by goal" })).toBeVisible();
  // Read-only: looking at recommendations writes nothing and calls no lookup service.
  expect(await snapshot(page)).toEqual(before);
  expect(calls).toEqual([]);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("upgrades-recommended.png") });
  // Saving is the only action here that changes the deck, and it saves the candidate rather than adding it.
  await first.getByRole("button", { name: "Save", exact: true }).click();
  await expect(first.getByRole("button", { name: "Saved", exact: true })).toHaveCount(1);
  await upgrades.getByRole("button", { name: /^Saved · \d+$/ }).click();
  await expect(upgrades.getByRole("heading", { name: /Saved · \d+/ })).toBeVisible();
});
