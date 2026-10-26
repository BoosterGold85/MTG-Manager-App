import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { exportCsv, fixtureRow, sol, forest, meren, tatyova, apiCard } from "../importFixtures";

const witness = { ...sol, scryfallId: "7d5e9c2a-0000-4000-8000-000000000185", name: "Eternal Witness", setCode: "c21", collectorNumber: "185", colorIdentity: ["G" as const], typeLine: "Creature — Human Shaman", manaValue: 3 };
async function importCollection(page: Page) {
  await page.getByRole("button", { name: "Import Collection", exact: true }).first().click();
  await page.locator("input[type=file]").setInputFiles({
    name: "ManaBox.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      exportCsv([fixtureRow(sol, 3), fixtureRow(forest, 3), fixtureRow(meren, 3), fixtureRow(tatyova, 2), fixtureRow(sol, 1, { Foil: "foil" })]),
    ),
  });
  await page.getByRole("button", { name: "Confirm import", exact: true }).click();
  await page.getByRole("button", { name: "Return to binder" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}
async function nav(page: Page, label: string) {
  await page.getByRole("navigation").filter({ visible: true }).getByRole("button", { name: label, exact: true }).click();
}
async function start(page: Page) {
  const scryfall: string[] = [];
  await page.route("https://api.scryfall.com/**", async (route) => {
    scryfall.push(route.request().url());
    const ids = (route.request().postDataJSON()?.identifiers || []) as { name?: string }[];
    await route.fulfill({ json: { data: ids.filter((i) => i.name === "Eternal Witness").map(() => apiCard(witness)), not_found: ids.filter((i) => i.name !== "Eternal Witness") } });
  });
  await page.route("https://cards.scryfall.io/**", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator(".card-tile")).toHaveCount(32);
  await importCollection(page);
  await nav(page, "Decks");
  return scryfall;
}
async function axe(page: Page) {
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
}
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
const PASTE = `1 Meren of Clan Nel Toth
1 Sol Ring (CMM) 410
4 Forest
1 Eternal Witness
1 Tatyova, Benthic Druid
1 Bogus Card`;

test("paste import previews ownership, requires commander, keeps missing cards and survives reload", async ({ page }, info) => {
  const scryfall = await start(page);
  await page.getByRole("button", { name: "Import Deck", exact: true }).click();
  await page.getByRole("button", { name: "Paste decklist text", exact: true }).click();
  await page.getByRole("textbox", { name: "Decklist text" }).fill(PASTE);
  await page.getByRole("button", { name: "Preview import", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("region", { name: "Commander selection" })).toContainText("does not identify a commander");
  await expect(dialog.getByRole("button", { name: "Confirm import", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("region", { name: "Before importing" })).toContainText("Select the commander before importing.");
  await dialog.getByRole("checkbox", { name: /Meren of Clan Nel Toth/ }).check();
  const summary = dialog.getByRole("definition");
  await expect(summary.nth(0)).toHaveText("8");
  // Meren + Sol Ring are exact owned copies; the 4 Forests are basic lands and are never allocated.
  await expect(summary.nth(1)).toHaveText("2");
  await expect(summary.nth(4)).toHaveText("1");
  await expect(dialog.getByRole("region", { name: "Decklist preview" })).toContainText("Deck requests: CMM #410");
  await expect(dialog.getByRole("region", { name: "Decklist preview" })).toContainText("Exact owned copy");
  await expect(dialog.getByRole("region", { name: "Decklist preview" })).toContainText("Basic land — allocation not tracked");
  await expect(dialog.locator(".sync-note").first()).toContainText("4 basic lands (not allocated)");
  await expect(dialog.getByRole("region", { name: "Decklist preview" })).toContainText("Eternal Witness ×1");
  await expect(dialog.getByRole("region", { name: "Color identity conflicts" })).toContainText(tatyova.name);
  await expect(dialog.getByRole("region", { name: "Problem rows" })).toContainText("Bogus Card");
  await expect(dialog.getByRole("region", { name: "Problem rows" })).toContainText("Card not recognized");
  await fits(page);
  await axe(page);
  await page.screenshot({ path: info.outputPath("deck-import-preview.png"), fullPage: true });
  await dialog.getByRole("button", { name: "Confirm import", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Imported deck", exact: true })).toBeVisible();
  await expect(page.locator(".collection-subtitle").first()).toContainText("8 cards · 2 copies assigned · 2 missing · 4 basic lands (not allocated)");
  const missing = page.getByRole("region", { name: "Missing and unassigned cards" });
  await expect(missing).toContainText("Eternal Witness ×1");
  await expect(missing).toContainText("Missing — not owned");
  await expect(missing).toContainText("Outside commander color identity");
  await expect(missing).not.toContainText("Forest");
  await expect(page.getByRole("region", { name: "Rows not imported" })).toContainText("Bogus Card");
  await fits(page);
  await axe(page);
  await page.screenshot({ path: info.outputPath("imported-deck.png"), fullPage: true });
  expect(scryfall.length).toBe(1);
  await page.reload();
  await nav(page, "Decks");
  await expect(page.locator(".deck-card")).toContainText("8 cards · 2 copies assigned · 2 missing · 4 basic lands (not allocated)");
  await page.locator(".deck-card").click();
  await expect(page.getByRole("heading", { name: "Sol Ring ×1", exact: true })).toBeVisible();
  await nav(page, "Collection");
  await expect(page.locator(".card-tile")).toHaveCount(5);
  await page.getByRole("button", { name: "View Sol Ring", exact: true }).first().click();
  await expect(page.getByRole("region", { name: "Deck Usage" })).toContainText("Owned: 3 · Available: 2 · Assigned: 1");
});

test("ManaBox file upload with Commander section, printing choice and duplicate name never overwrites", async ({ page }) => {
  await start(page);
  const file = {
    name: "Graveyard.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Commander\n1 Meren of Clan Nel Toth (CMM) 346\n\nDeck\n1 Sol Ring\n2 Forest (M21) 272\n"),
  };
  for (const round of [1, 2]) {
    await page.getByRole("button", { name: "Import Deck", exact: true }).click();
    await page.getByLabel("ManaBox deck file").setInputFiles(file);
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("region", { name: "Commander selection" })).toContainText("Taken from the export's Commander section.");
    await expect(dialog.getByRole("textbox", { name: "Deck name" })).toHaveValue("Graveyard");
    if (round === 1) {
      const review = dialog.getByRole("region", { name: "Needs review" });
      await expect(review).toContainText("Sol Ring ×1");
      await expect(dialog.getByRole("button", { name: "Confirm import", exact: true })).toBeDisabled();
      await review.getByRole("button", { name: "Use one Sol Ring CMM #410 foil", exact: true }).click();
      await review.getByRole("button", { name: "Use selected copies for Sol Ring", exact: true }).click();
    } else {
      // The foil copy now belongs to the first deck; only the nonfoil group remains, so it is suggested.
      await expect(dialog.getByRole("region", { name: "Needs review" })).toHaveCount(0);
      const conflict = dialog.getByRole("region", { name: "Deck name conflict" });
      await expect(conflict).toContainText("will not be overwritten");
      await expect(dialog.getByRole("button", { name: "Confirm import", exact: true })).toBeDisabled();
      await axe(page);
      await conflict.getByRole("button", { name: "Import as new deck", exact: true }).click();
    }
    await dialog.getByRole("button", { name: "Confirm import", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.getByRole("button", { name: "All decks", exact: true }).click();
  }
  await expect(page.locator(".deck-card")).toHaveCount(2);
  await expect(page.locator(".deck-card").nth(0)).toContainText("4 cards · 2 copies assigned · 0 missing · 2 basic lands (not allocated)");
  await expect(page.locator(".deck-card").nth(1)).toContainText("4 cards · 2 copies assigned · 0 missing · 2 basic lands (not allocated)");
  await nav(page, "Collection");
  await page.getByRole("button", { name: "View Sol Ring", exact: true }).nth(1).click();
  await expect(page.getByRole("region", { name: "Deck Usage" })).toContainText("Owned: 1 · Available: 0 · Assigned: 1");
});
