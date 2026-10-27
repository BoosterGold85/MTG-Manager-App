import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { reignOfDragonsFixture, canonicalFactsCards } from "../recommendationFixtures";
import { synergyFixture } from "../synergyFixtures";
import { readState, section, seed } from "./workspaceHelpers";

function reignWithCandidates() {
  const f = reignOfDragonsFixture(),
    owned = synergyFixture().owned;
  f.state.revision = 1;
  for (const card of canonicalFactsCards) {
    f.state.metadata[card.scryfallId] = card;
    f.state.items.push(owned(card, card.scryfallId, 1));
  }
  return f;
}
const axe = async (page: Page) => {
  // Dialogs fade in; check contrast once they are fully opaque.
  for (const dialog of await page.locator("dialog[open]").all()) await expect(dialog).toHaveCSS("opacity", "1");
  await axeNow(page);
};
const axeNow = async (page: Page) => expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
const fits = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
const active = (page: Page) => page.getByRole("navigation", { name: "Deck sections" }).locator('[aria-current="page"]');

test("deck sections live in the URL: default Overview, refresh, Back/Forward and invalid tabs", async ({ page }) => {
  await seed(page, reignWithCandidates().state, "Reign of Dragons");
  await expect(active(page)).toHaveText("Overview");
  await expect(page).toHaveURL(/\?view=decks&deck=[\w-]+$/);
  await section(page, "Cards");
  await expect(page).toHaveURL(/tab=cards/);
  await page.reload();
  await expect(active(page)).toHaveText("Cards");
  await expect(page.getByRole("region", { name: "Deck cards" })).toBeVisible();
  await section(page, "Upgrades");
  await expect(page).toHaveURL(/tab=upgrades/);
  await page.goBack();
  await expect(active(page)).toHaveText("Cards");
  await expect(page.getByRole("heading", { name: "Reign of Dragons", exact: true })).toBeVisible();
  await page.goForward();
  await expect(active(page)).toHaveText("Upgrades");
  const url = new URL(page.url());
  url.searchParams.set("tab", "nonsense");
  await page.goto(url.toString());
  await expect(active(page)).toHaveText("Overview");
  // The header carries identity only; actions moved to their sections.
  const header = page.locator(".deck-workspace-header");
  await expect(header).toContainText("Lathliss, Dragon Queen");
  await expect(header).toContainText("100 cards");
  await expect(header).toContainText("Mono Red");
  await expect(header.getByRole("button", { name: /Upgrades I Own|Edit Deck|Delete/ })).toHaveCount(0);
});

test("every section and the swap review pass accessibility checks without horizontal overflow", async ({ page }, info) => {
  await seed(page, reignWithCandidates().state, "Reign of Dragons");
  await expect(page.locator(".dna-method")).not.toHaveAttribute("open", "");
  await expect(page.locator(".deck-statistics")).not.toHaveAttribute("open", "");
  await axe(page);
  await fits(page);
  await section(page, "Cards");
  await axe(page);
  await fits(page);
  await page.getByRole("button", { name: /^Filters/ }).click();
  await axe(page);
  await page.getByRole("button", { name: "Show cards", exact: true }).click();
  await section(page, "Upgrades");
  const upgrades = page.getByRole("region", { name: "Upgrades", exact: true });
  await axe(page);
  await upgrades.getByRole("button", { name: /Build Around My Commander/ }).click();
  await expect(upgrades.getByRole("status")).toHaveText(/\d+ candidates?/);
  await axe(page);
  await fits(page);
  await upgrades.getByRole("button", { name: "Change goal", exact: true }).click();
  await upgrades.getByRole("button", { name: /Improve My Current Deck/ }).click();
  await expect(upgrades.getByRole("status")).toHaveText(/\d+ candidates?/);
  await axe(page);
  await fits(page);
  await upgrades.getByRole("button", { name: "Review Swap", exact: true }).first().click();
  await axe(page);
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  await upgrades.getByRole("button", { name: /^Saved/ }).click();
  await axe(page);
  await section(page, "Settings");
  await axe(page);
  await fits(page);
  await page.screenshot({ path: info.outputPath("settings.png"), fullPage: true });
});

test("phone tasks: understand, see shortages, find and explain an upgrade, save it, and swap it in two taps", async ({ page }, info) => {
  await seed(page, reignWithCandidates().state, "Reign of Dragons");
  // A: what the deck does, right after opening it.
  await expect(page.getByRole("region", { name: "What This Deck Does" })).toBeInViewport({ ratio: 0.1 });
  const summary = page.getByRole("region", { name: "What This Deck Does" }).locator("p");
  expect(parseFloat(await summary.evaluate((p) => getComputedStyle(p).fontSize))).toBeGreaterThanOrEqual(15);
  // B: what it is short on.
  const health = page.getByRole("region", { name: "Deck Health" });
  await expect(health).toContainText("Protection");
  await expect(health).toContainText("Low");
  // C: one tap to Upgrades.
  await section(page, "Upgrades");
  const upgrades = page.getByRole("region", { name: "Upgrades", exact: true });
  await upgrades.getByRole("button", { name: /Improve My Current Deck/ }).click();
  await expect(upgrades.getByRole("status")).toHaveText(/\d+ candidates?/);
  const top = upgrades.locator(".synergy-candidates>li").first();
  // D: why, without a developer trace.
  await top.getByText("Why?", { exact: true }).click();
  await expect(top.locator(".upgrade-why")).toContainText("Why this helps");
  await expect(top.getByText("Developer trace")).toHaveCount(0);
  // E: save in one tap.
  await top.getByRole("button", { name: "Save Upgrade", exact: true }).click();
  await expect(top.getByRole("button", { name: "Saved", exact: true })).toBeVisible();
  for (const button of await top.getByRole("button").all()) {
    const box = await button.boundingBox();
    if (box) expect(box.height).toBeGreaterThanOrEqual(44);
  }
  // F: Review Swap → Confirm Swap.
  const name = (await top.locator("h3").innerText()).trim();
  await top.getByRole("button", { name: "Review Swap", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm Swap", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: `${name} replaced` })).toBeVisible();
  await fits(page);
  await page.screenshot({ path: info.outputPath("after-swap.png") });
  const state = await readState(page);
  expect(state.decks![0].entries!.some((e) => e.name === name)).toBe(true);
});
