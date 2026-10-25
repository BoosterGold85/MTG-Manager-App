import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { exportCsv, fixtureRow, sol, meren, forest } from "../importFixtures";

async function nav(page: Page, label: string) {
  await page.getByRole("navigation").filter({ visible: true }).getByRole("button", { name: label, exact: true }).click();
}
async function importCollection(page: Page, rows = [fixtureRow(sol, 3), fixtureRow(meren, 1), fixtureRow(forest, 2)]) {
  await page.getByRole("button", { name: "Import Collection", exact: true }).first().click();
  await page.locator("input[type=file]").setInputFiles({ name: "ManaBox.csv", mimeType: "text/csv", buffer: Buffer.from(exportCsv(rows)) });
  await page.getByRole("button", { name: "Confirm import", exact: true }).click();
  await page.getByRole("button", { name: "Return to binder" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("screen and deck identity live in the URL, title and history", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".card-tile")).toHaveCount(32);
  await importCollection(page);
  await expect(page).toHaveTitle("MTG Manager — My Collection");
  await nav(page, "Decks");
  await expect(page).toHaveURL(/\?view=decks$/);
  await expect(page).toHaveTitle("MTG Manager — Decks");
  await page.getByRole("button", { name: "New Deck", exact: true }).click();
  await page.getByRole("textbox", { name: "Deck name", exact: true }).fill("Routed Deck");
  await page.getByRole("button", { name: "Choose Commander", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Meren of Clan Nel Toth/ }).click();
  await expect(page.getByRole("heading", { name: "Routed Deck", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\?view=decks&deck=[\w-]+$/);
  await expect(page).toHaveTitle("MTG Manager — Routed Deck");
  const deckUrl = page.url();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Routed Deck", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: /My Decks/ })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveTitle("MTG Manager — My Collection");
  await expect(page.locator(".card-tile")).toHaveCount(3);
  // A card detail overlay still closes with Back without changing the screen.
  await page.getByRole("button", { name: "View Sol Ring", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveTitle("MTG Manager — My Collection");
  // Opening a deck from Card Detail replaces the overlay entry.
  await page.getByRole("button", { name: "View Meren of Clan Nel Toth", exact: true }).click();
  await page.getByRole("region", { name: "Deck Usage" }).getByRole("button", { name: "Routed Deck ×1" }).click();
  await expect(page).toHaveURL(deckUrl);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveTitle("MTG Manager — My Collection");
  // A deleted or unknown deck link falls back to the library.
  await page.goto("/?view=decks&deck=missing-deck");
  await expect(page.getByRole("heading", { name: /My Decks/ })).toBeVisible();
  await expect(page).toHaveURL(/\?view=decks$/);
});

test("another tab offers the newer collection without discarding this tab's work", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.locator(".card-tile")).toHaveCount(32);
  const other = await context.newPage();
  await other.goto("/");
  await expect(other.locator(".card-tile")).toHaveCount(32);
  await importCollection(page);
  await expect(other.getByText("Your collection changed in another tab or window.")).toBeVisible();
  await expect(other.locator(".card-tile")).toHaveCount(32);
  await other.getByRole("button", { name: "Load latest", exact: true }).click();
  await expect(other.locator(".card-tile")).toHaveCount(3);
  await expect(other.getByText("Your collection changed in another tab or window.")).toHaveCount(0);
  // The tab that saved never sees its own notice.
  await expect(page.getByText("Your collection changed in another tab or window.")).toHaveCount(0);
});

test("records versus copies wording and deck empty-state paths", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".card-tile")).toHaveCount(32);
  await importCollection(page);
  await expect(page.locator(".results-line")).toContainText("3 records · 6 copies in your binder");
  await expect(page.locator(".collection-footer")).toContainText("3 collection records · 6 copies");
  await nav(page, "Decks");
  const empty = page.locator(".empty-state");
  await expect(empty).toContainText("Import an existing deck now");
  await expect(empty).toContainText("New Deck from an owned commander");
  await expect(empty).not.toContainText("Import your collection first");
});
