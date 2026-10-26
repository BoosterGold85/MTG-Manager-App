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
test("actual Reign proves Changeling and typed smoothing, rejects Soldier Commander claims, and compares potential cuts without writes", async ({
  page,
}, info) => {
  await setup(page);
  const before = await read(page),
    calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("api.scryfall.com")) calls.push(r.url());
  });
  await page
    .getByRole("button", { name: "Explore Synergy", exact: true })
    .click();
  const dialog = page.getByRole("dialog"),
    recommended = dialog.getByRole("region", {
      name: "Recommended",
      exact: true,
    });
  const wayfinder = recommended
    .locator(".synergy-candidates>li")
    .filter({ hasText: "Changeling Wayfinder" });
  await expect(wayfinder).toContainText(/Synergy (7\d|8[0-2])/);
  await expect(wayfinder).toContainText("Confidence: High");
  await expect(wayfinder.locator(".candidate-summary")).toContainText(
    /Changeling.*Dragon.*entering triggers Lathliss/,
  );
  await expect(wayfinder.locator(".candidate-summary")).toContainText(
    "basic land to hand",
  );
  await expect(wayfinder.locator(".score-breakdown dl")).toHaveCount(0);
  const measures = () =>
    page.evaluate(() => [
      performance.getEntriesByName("mtg:strategy-profile").length,
      performance.getEntriesByName("mtg:recommendation-profile").length,
    ]);
  const counts = await measures();
  await wayfinder.getByText("Why this score?", { exact: true }).click();
  const details = wayfinder.locator(".score-breakdown");
  await expect(details).toContainText("basic land to hand");
  await expect(details).not.toContainText("fills a needed unrestricted tutor");
  await expect(
    details.getByText("basic land to hand · changeling · land smoothing", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(details).toContainText("Commander interaction");
  await expect(details).toContainText("Existing-card interaction");
  const points = (await details.locator("dd").allTextContents()).map(
    parseFloat,
  );
  await expect(details).toContainText(
    `Raw total: ${points.reduce((n, p) => n + p, 0)}`,
  );
  expect(await measures()).toEqual(counts);
  await wayfinder
    .getByRole("button", { name: "Compare Changeling Wayfinder", exact: true })
    .click();
  const comparisons = dialog.getByRole("region", {
    name: "Potential replacements",
  });
  await expect(comparisons).toContainText("local Synergy heuristic");
  const choose = comparisons
    .getByRole("button", { name: /^Compare against/ })
    .first();
  await expect(choose).toBeVisible();
  await choose.click();
  await expect(
    dialog.getByRole("region", { name: "Current deck card", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("region", { name: "Heuristic comparison delta" }),
  ).toContainText("not a universal power rating");
  await dialog
    .getByRole("button", { name: "Close comparison", exact: true })
    .click();
  await dialog
    .getByRole("searchbox", { name: "Search owned candidates" })
    .fill("Fire Nation");
  const other = dialog.locator(".other-legal-cards");
  await expect(other).not.toHaveAttribute("open", "");
  await other.locator(":scope>summary").click();
  await expect(other).toContainText("Poor Fit");
  await expect(other.locator(".candidate-summary")).toContainText("Soldier");
  await expect(other.locator(".candidate-summary")).toContainText(
    "do not satisfy",
  );
  await other.getByText("Why this score?", { exact: true }).click();
  await expect(other.locator(".score-breakdown")).toContainText(
    "Commander relationship: 0/25",
  );
  await expect(other.locator(".score-breakdown")).toContainText(
    "wrong_token_type",
  );
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
    path: info.outputPath("reign-typed-recommendations.png"),
  });
  await page.keyboard.press("Escape");
  expect(await read(page)).toEqual(before);
  expect(calls).toEqual([]);
});
test("low-confidence candidates retain manual comparison but never propose cuts; search and cached profiles survive disclosures", async ({
  page,
}) => {
  await setup(page);
  const before = await read(page);
  await page
    .getByRole("button", { name: "Explore Synergy", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("searchbox", { name: "Search owned candidates" })
    .fill("Uncertain");
  const other = dialog.locator(".other-legal-cards");
  if (await other.count()) await other.locator(":scope>summary").click();
  const row = dialog.locator(".synergy-candidates>li");
  await expect(row).toContainText("Confidence: Low");
  await row
    .getByRole("button", { name: "Compare Uncertain Dragon", exact: true })
    .click();
  const suggestions = dialog.getByRole("region", {
    name: "Potential replacements",
  });
  await expect(suggestions).toContainText("No sufficiently confident");
  await expect(suggestions.getByRole("button")).toHaveCount(0);
  await expect(
    dialog.getByRole("combobox", { name: "Compare with a card in this deck" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  expect(await read(page)).toEqual(before);
});
