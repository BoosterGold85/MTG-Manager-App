import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { intelligenceFixture } from "../deckIntelligenceFixture";
import { legacyFixture } from "../legacyFixture";
import { apiCard } from "../importFixtures";
import { seed, readState } from "./workspaceHelpers";

test("Legacy overview distinguishes coverage and explains the actual Mayhem relationship", async ({ page }) => {
  const f = intelligenceFixture();
  await seed(page, f.state, f.deck.name);
  const coverage = page.getByRole("region", { name: "Card Analysis Coverage", exact: true });
  await expect(coverage).toBeVisible(); await expect(coverage).toContainText("3 unique printing entries · 3 total copies · 3 canonical cards");
  await expect(page.getByRole("region", { name: "Format legality", exact: true })).toContainText("Legacy does not rotate");
  await expect(page.getByRole("region", { name: "Format legality", exact: true })).not.toContainText("Standard rotation");
  await coverage.getByText("Exact cards and analysis explanations", { exact: true }).click();
  await coverage.locator("summary").filter({ hasText: "1 × Vision of Love" }).click();
  await expect(coverage).toContainText("no physical assignment");
  const chains = page.getByRole("region", { name: "Synergy Chains", exact: true });
  await chains.getByText("Explore cards and interaction evidence", { exact: true }).click();
  await chains.locator("summary").filter({ hasText: "Discard → Mayhem" }).click();
  await expect(chains).toContainText("Choose the discard option"); await expect(chains).toContainText("{B}{R}");
  await chains.getByRole("button", { name: "Read Carnage, Crimson Chaos", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Mayhem");
  await expect(page.getByRole("dialog")).toContainText("Card rules reference");
  await expect(page.getByRole("dialog")).not.toContainText("In your binder");
  await page.getByRole("dialog").getByRole("button", { name: /Close/ }).first().click();
  await chains.locator("summary").filter({ hasText: "Graveyard placement ≠ discard" }).click();
  await expect(chains).toContainText("is not discarding it from hand");
  expect((await readState(page)).decks![0].entries).toEqual(f.deck.entries);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).include(".deck-intelligence").analyze()).violations).toEqual([]);
});

test("manual deck intent survives refresh and reload without moving copies", async ({ page }) => {
  const f = intelligenceFixture(); await seed(page, f.state, f.deck.name);
  const strategy = page.getByRole("region", { name: "Deck Strategy", exact: true });
  await strategy.getByText("Set deck intent and optimization target", { exact: true }).click();
  await strategy.getByLabel("Your deck plan").fill("Discard Carnage and cast it through Mayhem");
  await strategy.getByLabel("Optimization target").selectOption("competitive");
  await strategy.getByRole("button", { name: "Save deck intent" }).click();
  await expect(strategy).toContainText("Your stated plan: Discard Carnage");
  let calls = 0;
  await page.route("**/api/scryfall/cards/collection", async route => { calls++; await route.fulfill({ json: { object: "list", data: f.cards.map(apiCard) } }); });
  const coverage = page.getByRole("region", { name: "Card Analysis Coverage", exact: true });
  await coverage.getByText("Exact cards and analysis explanations", { exact: true }).click();
  await coverage.locator("summary").filter({ hasText: "1 × Vision of Love" }).click();
  await coverage.getByRole("button", { name: "Refresh metadata for Vision of Love", exact: true }).click();
  await expect(coverage).toContainText("1 metadata matches returned"); expect(calls).toBe(1);
  await page.reload();
  await expect(page.getByRole("region", { name: "Deck Strategy", exact: true })).toContainText("Your stated plan: Discard Carnage");
  const state = await readState(page); expect(state.decks![0].intelligenceIntent?.target).toBe("competitive");
  expect(state.decks![0].entries).toEqual(f.deck.entries); expect(state.items).toEqual(f.state.items);
});

test("owned upgrade review explains before/after roles and preserves assignments until confirmation", async ({ page }) => {
  const f = legacyFixture(); await seed(page, f.state, f.deck.name, "Upgrades");
  const panel = page.getByRole("region", { name: "Legacy Upgrades", exact: true });
  await expect(panel.getByRole("status")).toContainText("2 eligible owned printings");
  await panel.getByRole("button", { name: `Compare ${f.candidate.name}`, exact: true }).click();
  const dialog = page.getByRole("dialog"); await dialog.getByLabel("Replace main-deck entry").selectOption("weak");
  await dialog.getByText("Deck goals, partners and role changes", { exact: true }).click();
  await expect(dialog).toContainText("Before → after modeled role coverage");
  await expect(dialog).toContainText("Preview only");
  const state = await readState(page); expect(state.items).toEqual(f.state.items); expect(state.decks![0].assignments).toEqual(f.deck.assignments);
});
