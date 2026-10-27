import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  reignOfDragonsFixture,
  canonicalFactsCards,
} from "../recommendationFixtures";
import { scoringCard } from "../scoringFixtures";
import { synergyFixture } from "../synergyFixtures";
async function read(page: Page) {
  return page.evaluate(
    async () =>
      await new Promise<unknown>((resolve, reject) => {
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
async function setup(page: Page) {
  const f = reignOfDragonsFixture(),
    owned = synergyFixture().owned;
  f.state.revision = 1;
  const uncertain = {
    ...scoringCard("Uncertain Dragon", "Creature — Dragon", "", 1),
    colorIdentity: ["R"] as "R"[],
    oracleText: undefined,
  };
  for (const card of [...canonicalFactsCards, uncertain]) {
    f.state.metadata[card.scryfallId] = card;
    f.state.items.push(owned(card, card.scryfallId, 1));
  }
  await page.goto("/");
  await expect(page.locator(".card-tile")).toHaveCount(32);
  await page.evaluate(
    async (state) =>
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("mtg-manager-collection", 1);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction("state", "readwrite");
          tx.objectStore("state").put(state, "collection");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    f.state,
  );
  await page.reload();
  await expect(page.locator(".sample-label")).toHaveText("YOUR COLLECTION");
  await page
    .getByRole("navigation")
    .filter({ visible: true })
    .getByRole("button", { name: "Decks", exact: true })
    .click();
  await page
    .locator(".deck-card")
    .filter({ hasText: "Reign of Dragons" })
    .click();
}
async function openImprove(page: Page) {
  await page
    .getByRole("button", { name: "Upgrades I Own", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /Improve My Current Deck/ }).click();
  await expect(dialog.getByRole("status")).toHaveText(/\d+ candidates?/);
  return dialog;
}
test("Reign: Improve My Current Deck ranks by best one-for-one swap, explains the cut and compares any deck card without writes", async ({
  page,
}, info) => {
  await setup(page);
  const before = await read(page),
    calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("api.scryfall.com")) calls.push(r.url());
  });
  const dialog = await openImprove(page);
  await expect(dialog.getByRole("status")).toHaveText("3 candidates");
  const rows = dialog.locator(".synergy-candidates>li");
  const wayfinder = rows.filter({ hasText: "Changeling Wayfinder" });
  await expect(rows.first()).toContainText("Changeling Wayfinder");
  await expect(wayfinder).toContainText(/Minor Upgrade · \+0\.\d\d/);
  await expect(wayfinder).toContainText("Best swap: cut");
  await expect(wayfinder).toContainText("Confidence: High");
  await expect(wayfinder).toContainText(/Commander Fit: [A-Za-z]+ — \d+/);
  await expect(rows.filter({ hasText: "Fire Nation Attacks" })).toContainText(
    "Sidegrade",
  );
  await wayfinder
    .getByRole("button", { name: "Compare Changeling Wayfinder", exact: true })
    .click();
  const comparison = dialog.getByRole("region", {
    name: "Candidate comparison",
    exact: true,
  });
  await expect(comparison).toBeFocused();
  await expect(
    comparison.getByRole("heading", { name: /^Best swap: cut / }),
  ).toBeVisible();
  await expect(
    comparison.getByRole("definition").first(),
  ).toBeVisible();
  await comparison
    .getByLabel("Compare with a card in this deck")
    .selectOption({ label: "Lightning Bolt" });
  const chosen = comparison.getByRole("region", { name: "Chosen swap" });
  await expect(chosen).toContainText("Swap for Lightning Bolt");
  await expect(chosen).toContainText("Upgrade Value for this swap");
  await comparison
    .getByLabel("Compare with a card in this deck")
    .selectOption({ label: "Mountain" });
  await expect(chosen).toContainText("Not a valid swap");
  await expect(comparison).toContainText("Comparing makes no deck changes.");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("reign-improve-current-deck.png"),
  });
  await comparison
    .getByRole("button", { name: "Close comparison", exact: true })
    .click();
  await page.keyboard.press("Escape");
  expect(await read(page)).toEqual(before);
  expect(calls).toEqual([]);
});
test("low confidence stays capped and below confident results; the detail view shows all three scores separately", async ({
  page,
}) => {
  await setup(page);
  const before = await read(page);
  const dialog = await openImprove(page);
  await dialog
    .getByRole("searchbox", { name: "Search owned candidates" })
    .fill("Uncertain");
  const row = dialog.locator(".synergy-candidates>li");
  await expect(row).toContainText("Confidence: Low");
  await expect(row).not.toContainText(/Major Upgrade|Strong Upgrade|Moderate Upgrade/);
  await dialog
    .getByRole("searchbox", { name: "Search owned candidates" })
    .fill("");
  await dialog.getByRole("button", { name: "Change goal", exact: true }).click();
  await dialog.getByRole("button", { name: /Build Around My Commander/ }).click();
  await expect(dialog.getByRole("status")).toHaveText(/\d+ candidates?/);
  const priorities = (
    await dialog.locator(".synergy-candidates>li h3>span").allTextContents()
  ).map((t) => Number(t.match(/· (\d+)/)![1]));
  expect(priorities).toEqual([...priorities].sort((a, b) => b - a));
  await dialog
    .getByRole("button", { name: "View Changeling Wayfinder details", exact: true })
    .click();
  const scores = page.getByRole("region", { name: "Upgrades I Own scores" });
  await expect(scores).toContainText(/Commander Fit[A-Za-z]+ — \d+/);
  await expect(scores).toContainText(/Build Priority[A-Za-z ]+ — \d+/);
  await expect(scores).toContainText(/Upgrade ValueMinor Upgrade \(\+0\.\d\d\) · best swap: cut/);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  expect(await read(page)).toEqual(before);
});
