import { test, expect } from "@playwright/test";
import { section } from "./workspaceHelpers";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import data from "../../src/data/sampleCards.json" with { type: "json" };
import type { SampleCollectionCard } from "../../src/models/card";
import { exportCsv, fixtureRow, apiCard, sol } from "../importFixtures";

const sample = data as SampleCollectionCard[];
const card = (name: string) => sample.find((c) => c.name === name)!;
const owned = ["Meren of Clan Nel Toth", "Sol Ring", "Forest", "Birds of Paradise", "Cultivate", "Reanimate", "Blood Artist", "Skullclamp"];
const flayer = { ...sol, scryfallId: "5a1c7d00-0000-4000-8000-000000000001", name: "Grim Flayer", setCode: "dmu", collectorNumber: "200", colorIdentity: ["B" as const, "G" as const], typeLine: "Creature — Human Warrior", manaValue: 2, manaCost: "{B}{G}", oracleText: "Trample\nWhenever Grim Flayer deals combat damage to a player, look at the top three cards of your library.", rarity: "mythic" as const };
const DECK = `Commander
1 Meren of Clan Nel Toth

Deck
1 Sol Ring
2 Forest
1 Birds of Paradise
1 Cultivate
1 Reanimate
1 Blood Artist
1 Skullclamp
1 Avenger of Zendikar
1 Grim Flayer`;
// Default Card Type → Mana Value → Name order.
const TYPE_ORDER = ["Birds of Paradise", "Blood Artist", "Grim Flayer", "Avenger of Zendikar", "Reanimate", "Cultivate", "Skullclamp", "Sol Ring", "Forest"];

async function nav(page: Page, label: string) {
  await page.getByRole("navigation").filter({ visible: true }).getByRole("button", { name: label, exact: true }).click();
}
async function setup(page: Page) {
  await page.route("https://api.scryfall.com/**", async (route) => {
    const ids = (route.request().postDataJSON()?.identifiers || []) as { name?: string }[];
    await route.fulfill({ json: { data: ids.filter((i) => i.name === "Grim Flayer").map(() => ({ ...apiCard(flayer), keywords: ["Trample"] })), not_found: ids.filter((i) => i.name !== "Grim Flayer") } });
  });
  await page.route("https://cards.scryfall.io/**", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator(".card-tile")).toHaveCount(32);
  await page.getByRole("button", { name: "Import Collection", exact: true }).first().click();
  await page.locator("input[type=file]").setInputFiles({
    name: "ManaBox.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(exportCsv(owned.map((n) => fixtureRow(card(n), n === "Forest" ? 3 : 1)))),
  });
  await page.getByRole("button", { name: "Confirm import", exact: true }).click();
  await page.getByRole("button", { name: "Return to binder" }).click();
  await nav(page, "Decks");
  await page.getByRole("button", { name: "Import Deck", exact: true }).click();
  await page.getByRole("button", { name: "Paste decklist text", exact: true }).click();
  await page.getByRole("textbox", { name: "Decklist text" }).fill(DECK);
  await page.getByRole("button", { name: "Preview import", exact: true }).click();
  await page.getByRole("textbox", { name: "Deck name" }).fill("Meren Browse");
  await page.getByRole("button", { name: "Confirm import", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Meren Browse", exact: true })).toBeVisible();
}
const detail = (page: Page) => page.getByRole("dialog");
const title = (page: Page) => detail(page).locator("#detail-title");
const position = (page: Page) => detail(page).locator(".detail-position");
async function walk(page: Page, expected: string[]) {
  for (const [i, name] of expected.entries()) {
    await expect(title(page)).toHaveText(name);
    await expect(position(page)).toHaveText(`${i + 1} of ${expected.length}`);
    if (i < expected.length - 1) await detail(page).getByRole("button", { name: "Next card" }).click();
  }
  await expect(detail(page).getByRole("button", { name: "Next card" })).toBeDisabled();
}

test("deck cards open full Card Detail and Previous/Next browses in place with boundaries", async ({ page }, info) => {
  await setup(page);
  await section(page, "Cards");
  const tiles = page.getByRole("region", { name: "Deck cards" }).locator(".deck-owned-card h3");
  await expect(tiles).toHaveText(TYPE_ORDER.map((n) => `${n} ×${n === "Forest" ? 2 : 1}`));
  await page.getByRole("button", { name: "Open Birds of Paradise details", exact: true }).click();
  await expect(detail(page)).toHaveCount(1);
  await expect(detail(page).getByRole("region", { name: "Oracle text" })).toBeVisible();
  await expect(detail(page).getByRole("region", { name: "Card Intelligence" })).toBeVisible();
  await expect(detail(page).getByRole("region", { name: "Deck Usage" })).toContainText("Meren Browse ×1");
  await expect(detail(page).getByRole("region", { name: "Deck entry" })).toContainText(`Physical assignment: ${card("Birds of Paradise").setCode.toUpperCase()} #${card("Birds of Paradise").collectorNumber} · nonfoil`);
  await expect(detail(page).getByRole("button", { name: "Previous card" })).toBeDisabled();
  await expect(position(page)).toHaveText("1 of 9");
  const handle = await detail(page).elementHandle();
  await detail(page).getByRole("button", { name: "Next card" }).click();
  await expect(title(page)).toHaveText("Blood Artist");
  await expect(position(page)).toHaveText("2 of 9");
  // Same open surface: the dialog element was never closed and replaced.
  expect(await handle!.evaluate((el) => (el as HTMLDialogElement).open && el.isConnected)).toBe(true);
  await detail(page).getByRole("button", { name: "Previous card" }).click();
  await expect(title(page)).toHaveText("Birds of Paradise");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(title(page)).toHaveText("Grim Flayer");
  await expect(detail(page).getByRole("region", { name: "Canonical keywords" })).toContainText("Trample");
  await expect(detail(page).getByRole("region", { name: "Deck entry" })).toContainText("Physical assignment: None");
  await expect(detail(page).getByRole("region", { name: "Deck entry" })).toContainText("Not currently owned");
  await expect(detail(page).getByText("In your binder", { exact: true })).toHaveCount(0);
  await expect(detail(page).getByRole("region", { name: "Deck Usage" })).toHaveCount(0);
  await expect(detail(page).getByRole("region", { name: "Card Intelligence" })).toBeVisible();
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).resolves.toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("deck-card-detail.png") });
  for (let i = 0; i < 6; i++) await detail(page).getByRole("button", { name: "Next card" }).click();
  await expect(title(page)).toHaveText("Forest");
  await expect(position(page)).toHaveText("9 of 9");
  await expect(detail(page).getByRole("button", { name: "Next card" })).toBeDisabled();
  await expect(detail(page).getByRole("region", { name: "Deck entry" })).toContainText("Forest ×2");
  // Basic lands are tracked in the decklist but never exclusively allocated.
  await expect(detail(page).getByRole("region", { name: "Deck entry" })).toContainText("Physical assignment: Not tracked (basic land)");
  await expect(detail(page).getByText("Basic land — allocation not tracked", { exact: false })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(detail(page)).toHaveCount(0);
});

test("sort and filters define the navigation sequence and position", async ({ page }) => {
  await setup(page);
  await section(page, "Cards");
  const sortBy = (label: string) => page.getByRole("combobox", { name: "Sort", exact: true }).selectOption({ label });
  // Type, theme and ownership filters live in the Filters sheet; the result shows as removable chips.
  const filter = async (name: string, value: string) => {
    await page.getByRole("button", { name: /^Filters/ }).click();
    await page.getByRole("dialog").getByRole("combobox", { name }).selectOption(value);
    await page.getByRole("button", { name: "Show cards", exact: true }).click();
  };
  const open = (name: string) => page.getByRole("button", { name: `Open ${name} details`, exact: true }).click();
  const close = () => detail(page).getByRole("button", { name: "Close dialog" }).click();
  await open("Birds of Paradise");
  await walk(page, TYPE_ORDER);
  await close();
  await sortBy("Name A–Z");
  const az = [...TYPE_ORDER].sort((a, b) => a.localeCompare(b));
  await open(az[0]);
  await walk(page, az);
  await close();
  await sortBy("Mana Value High → Low");
  await expect(page.locator(".deck-sort-metric").first()).toHaveText("MV 7");
  await open("Avenger of Zendikar");
  await walk(page, ["Avenger of Zendikar", "Cultivate", "Blood Artist", "Grim Flayer", "Birds of Paradise", "Reanimate", "Skullclamp", "Sol Ring", "Forest"]);
  await close();
  await sortBy("Card Type");
  await filter("Card type", "Sorcery");
  await expect(page.getByText("2 of 9 deck cards shown")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove filter: Sorcery" })).toBeVisible();
  await open("Reanimate");
  await walk(page, ["Reanimate", "Cultivate"]);
  await detail(page).getByRole("button", { name: "Previous card" }).click();
  await expect(position(page)).toHaveText("1 of 2");
  await expect(detail(page).getByRole("button", { name: "Previous card" })).toBeDisabled();
  await close();
  await page.getByRole("button", { name: "Remove filter: Sorcery" }).click();
  // The missing-cards notice applies the Missing ownership filter directly.
  await page.getByRole("button", { name: "View Missing", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove filter: Missing" })).toBeVisible();
  await open("Grim Flayer");
  await walk(page, ["Grim Flayer", "Avenger of Zendikar"]);
  await expect(detail(page).getByRole("region", { name: "Deck entry" })).toContainText("Physical assignment: None");
});

test("commander opens without deck navigation and Collection Card Detail is unchanged", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Open Meren of Clan Nel Toth details", exact: true }).click();
  await expect(detail(page).getByRole("region", { name: "Deck entry" })).toContainText("Meren of Clan Nel Toth ×1 · Commander");
  await expect(detail(page).getByRole("navigation", { name: "Deck card navigation" })).toHaveCount(0);
  await detail(page).getByRole("button", { name: "Close dialog" }).click();
  await nav(page, "Collection");
  await page.getByRole("button", { name: "View Sol Ring", exact: true }).click();
  await expect(detail(page).getByText("FROM YOUR COLLECTION", { exact: true })).toBeVisible();
  await expect(detail(page).getByRole("navigation", { name: "Deck card navigation" })).toHaveCount(0);
  await expect(detail(page).getByRole("region", { name: "Deck entry" })).toHaveCount(0);
  await expect(detail(page).getByText("In your binder", { exact: true })).toBeVisible();
  await expect(detail(page).getByRole("button", { name: "Remove from Collection" })).toBeVisible();
  await expect(detail(page).getByRole("region", { name: "Deck Usage" })).toContainText("Meren Browse ×1");
});
