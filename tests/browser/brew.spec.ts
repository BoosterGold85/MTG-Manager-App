import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { vorelCountersFixture } from "../brewFixture";
import { section, writeState } from "./workspaceHelpers";

async function setup(page: Page) {
  const f = vorelCountersFixture();
  f.state.revision = 1;
  await page.goto("/");
  await expect(page.locator(".card-tile")).toHaveCount(32);
  await writeState(page, f.state);
  await page.reload();
  await expect(page.locator(".sample-label")).toHaveText("YOUR COLLECTION");
  await page.getByRole("navigation").filter({ visible: true }).getByRole("button", { name: "Decks", exact: true }).click();
  await page.locator(".deck-card").filter({ hasText: "Vorel Counters Brew" }).click();
  await section(page, "Upgrades");
  const upgrades = page.getByRole("region", { name: "Upgrades", exact: true });
  await upgrades.getByRole("button", { name: /Improve My Current Deck/ }).click();
  await expect(upgrades.getByRole("status")).toHaveText(/\d+ candidates?/);
  return upgrades;
}
const brewFilter = (upgrades: ReturnType<Page["getByRole"]>) => upgrades.locator(".synergy-controls label").filter({ hasText: /^Brew/ }).locator("select");
const fits = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

test("Brew Score sorts, filters and explains candidates without replacing Synergy", async ({ page }) => {
  const upgrades = await setup(page);
  const rows = upgrades.locator(".synergy-candidates>li");
  // The default Upgrade Value view stays as it was: no Brew headline.
  await expect(upgrades.locator(".brew-headline")).toHaveCount(0);
  await upgrades.getByLabel("Sort").selectOption("brew-desc");
  await expect(rows.first().locator("h3")).toHaveText("Evolution Witness");
  const first = rows.first();
  await expect(first.locator(".brew-headline")).toContainText(/Brew\s*\d+\s*Interesting Brew/);
  await expect(first).toContainText(/Synergy \d+/);
  await expect(first).toContainText("Connects Counters → Graveyard");
  const scores = await upgrades.locator(".brew-headline .upgrade-number").allTextContents();
  expect(scores.map(Number)).toEqual([...scores.map(Number)].sort((a, b) => b - a));
  await first.getByText("Why this brew?", { exact: true }).click();
  const why = first.locator(".brew-why");
  await expect(why).toContainText("Bridge");
  await expect(why).toContainText("Copy support");
  await expect(why).toContainText("Clone");
  expect(await fits(page)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  // Filters combine with search and availability.
  await brewFilter(upgrades).selectOption("interesting");
  await expect(upgrades.getByRole("status")).toHaveText("1 candidate");
  await upgrades.getByLabel("Copy availability").selectOption("available");
  await upgrades.getByLabel("Search owned candidates").fill("Elves");
  await expect(upgrades.getByRole("status")).toHaveText("0 candidates");
  await upgrades.getByLabel("Search owned candidates").fill("Witness");
  await expect(upgrades.getByRole("status")).toHaveText("1 candidate");
  await upgrades.getByLabel("Search owned candidates").fill("");
  await brewFilter(upgrades).selectOption("low");
  await expect(rows.locator("h3").filter({ hasText: "Evolution Witness" })).toHaveCount(0);
  // Hidden Gems: Brew 85+ only, highest first.
  await upgrades.getByRole("button", { name: "Hidden Gems", exact: true }).click();
  await expect(brewFilter(upgrades)).toHaveValue("gems");
  await expect(upgrades.getByLabel("Sort")).toHaveValue("brew-desc");
  await expect(upgrades.getByRole("status")).toHaveText("0 candidates");
  expect(await fits(page)).toBe(true);
});

test("Card Detail keeps Card Intelligence, In This Deck and Brew in This Deck distinct", async ({ page }) => {
  const upgrades = await setup(page);
  await upgrades.getByLabel("Sort").selectOption("brew-desc");
  await upgrades.locator(".synergy-candidates>li").first().getByRole("button", { name: "Card Details" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("region", { name: "In This Deck", exact: true })).toContainText(/Synergy \d+/);
  const brew = dialog.getByRole("region", { name: "Brew in this deck" });
  await expect(brew).toContainText(/Brew \d+/);
  await expect(brew).toContainText("Counters → Graveyard");
  await expect(dialog.locator(".detail-layout, .detail-content").first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector("dialog")!).opacity)).toBe("1");
  expect(await fits(page)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
