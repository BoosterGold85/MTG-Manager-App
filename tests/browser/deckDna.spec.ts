import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { dnaFixture, dragons, lathliss } from "../dnaFixtures";
import type { CollectionState } from "../../src/models/collection";
import { sol } from "../importFixtures";
import { section } from "./workspaceHelpers";
async function nav(page: Page, label: string) {
  await page
    .getByRole("navigation")
    .filter({ visible: true })
    .getByRole("button", { name: label, exact: true })
    .click();
}
async function setup(page: Page, withOwned = false) {
  const f = dnaFixture();
  f.state.revision = 1;
  if (withOwned)
    f.state.items = [
      {
        id: "sol-owned",
        scryfallId: sol.scryfallId,
        setCode: sol.setCode,
        collectorNumber: sol.collectorNumber!,
        quantityOwned: 3,
        quantityAssigned: 0,
        quantityUnassigned: 3,
        finish: "nonfoil",
        language: "en",
        condition: "nm",
        binderName: "Main",
        binderType: "binder",
        sourceRows: [],
      },
    ];
  await page.goto("/");
  await expect(page.locator(".card-tile")).toHaveCount(32);
  await page.evaluate(async (state: CollectionState) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("mtg-manager-collection", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("state");
      request.onerror = () => reject(request.error);
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
    });
  }, f.state);
  await page.reload();
  await nav(page, "Decks");
  await page.locator(".deck-card").click();
  await expect(
    page.getByRole("region", { name: "Deck DNA", exact: true }),
  ).toBeVisible();
  return f;
}
const computations = (page: Page) =>
  page.evaluate(() => performance.getEntriesByName("mtg:deck-dna").length);
// Theme name and percentage only (the row also offers "View Cards").
const themeLabels = async (page: Page) =>
  (await page.locator(".dna-theme").all()).length
    ? Promise.all((await page.locator(".dna-theme").all()).map(async (row) => `${await row.locator(".dna-theme-name").innerText()}${await row.locator(".dna-theme-percent").innerText()}`))
    : [];
const names = async (page: Page) =>
  (await page.locator(".deck-owned-grid h3").allTextContents()).map((n) =>
    n.replace(/\s*×\d+\s*$/, "").trim(),
  );
const scores = async (page: Page) =>
  (await page.locator(".deck-sort-metric").allTextContents()).map((n) =>
    Number(n.match(/SYNERGY (\d+)/)?.[1]),
  );
async function walk(page: Page, expected: string[]) {
  await page
    .getByRole("button", { name: `Open ${expected[0]} details`, exact: true })
    .click();
  for (const [i, name] of expected.entries()) {
    await expect(page.locator("#detail-title")).toHaveText(name);
    await expect(page.locator(".detail-position")).toHaveText(
      `${i + 1} of ${expected.length}`,
    );
    await expect(
      page.getByRole("region", { name: "In This Deck", exact: true }),
    ).toBeVisible();
    if (i < expected.length - 1)
      await page
        .getByRole("button", { name: "Next card", exact: true })
        .click();
  }
  await expect(
    page.getByRole("button", { name: "Next card", exact: true }),
  ).toBeDisabled();
  if (expected.length > 1) {
    await page
      .getByRole("button", { name: "Previous card", exact: true })
      .click();
    await expect(page.locator(".detail-position")).toHaveText(
      `${expected.length - 1} of ${expected.length}`,
    );
  }
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
}
test("saved deck DNA, deterministic percentages, summary, Core Plan, evidence and ownership-independent detail", async ({
  page,
}, info) => {
  await setup(page);
  const labels = await themeLabels(page);
  // Sparse evidence shows fewer themes rather than filler: since v0.6.12 flying alone isn't a Combat theme, so this
  // small Dragon fixture shows Dragons, Ramp and Tokens.
  expect(labels.length).toBeGreaterThanOrEqual(3);
  expect(labels.length).toBeLessThanOrEqual(7);
  expect(
    labels.reduce((n, label) => n + Number(label.match(/(\d+)%/)![1]), 0),
  ).toBe(100);
  await expect(
    page.getByRole("region", { name: "What This Deck Does", exact: true }),
  ).toContainText("Lathliss");
  const core = page.getByRole("region", { name: "Core Plan", exact: true });
  await expect(core.getByText("Primary", { exact: true })).toBeVisible();
  await expect(core.getByText("Key cards", { exact: true })).toBeVisible();
  // Overview leads with what the deck does and what it needs; methodology stays closed below.
  const order = await page.locator(".deck-overview > section, .deck-overview > details").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") || e.querySelector("summary")?.textContent || "").filter((l) => l !== "Analysis confidence"));
  expect(order.slice(0, 5)).toEqual(["Commander", "What This Deck Does", "Deck Health", "Core Plan", "Deck DNA"]);
  await expect(page.locator(".dna-method")).not.toHaveAttribute("open", "");
  await expect(page.getByRole("region", { name: "Deck Health" })).toContainText("Ramp");
  expect(await computations(page)).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("deck-dna.png"),
    fullPage: true,
  });
  await section(page, "Cards");
  await page
    .getByRole("button", {
      name: `Open ${dragons[0].name} details`,
      exact: true,
    })
    .click();
  const context = page.getByRole("region", {
    name: "In This Deck",
    exact: true,
  });
  await expect(context).toContainText("Synergy");
  await expect(context).toContainText(lathliss.name);
  await expect(
    page.getByRole("region", { name: "Deck entry", exact: true }),
  ).toContainText("Not currently owned");
  await context.getByText("Why this score?", { exact: true }).click();
  await expect(context).toContainText("Commander interaction");
  await expect(context).toContainText("Whenever");
  await expect(
    page.getByRole("region", { name: "Card Intelligence", exact: true }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("in-this-deck.png") });
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.reload();
  await nav(page, "Decks");
  await page.locator(".deck-card").click();
  await section(page, "Overview");
  expect(await themeLabels(page)).toEqual(labels);
});
test("both Synergy sorts and DNA theme filters drive Previous Next and position without recalculation", async ({
  page,
}) => {
  await setup(page);
  const before = await computations(page);
  const labels = await themeLabels(page);
  await section(page, "Cards");
  const sort = page.getByRole("combobox", { name: "Sort", exact: true });
  await sort.selectOption("synergy-desc");
  let values = await scores(page);
  expect(values).toEqual([...values].sort((a, b) => b - a));
  await walk(page, await names(page));
  await sort.selectOption("synergy-asc");
  values = await scores(page);
  expect(values).toEqual([...values].sort((a, b) => a - b));
  await walk(page, await names(page));
  // Selecting a DNA theme is explicit: View Cards opens Cards with a visible, removable chip.
  await section(page, "Overview");
  await page.getByRole("button", { name: "View Cards for Dragons Matter", exact: true }).click();
  await expect(page).toHaveURL(/tab=cards/);
  await expect(page.getByRole("button", { name: "Remove filter: Dragons Matter" })).toBeVisible();
  const filtered = await names(page);
  expect(filtered.length).toBeLessThan(dragons.length);
  expect(filtered).not.toContain("Sol Ring");
  expect(filtered).toContain("Dragonlord’s Servant");
  await walk(page, filtered);
  expect(await computations(page)).toBe(before);
  await page
    .getByRole("button", { name: "Clear deck filters", exact: true })
    .click();
  await expect(page.locator(".deck-owned-grid article")).toHaveCount(
    dragons.length,
  );
  await sort.selectOption("name-asc");
  await expect(page.locator(".deck-sort-metric")).toHaveCount(0);
  await section(page, "Overview");
  expect(await themeLabels(page)).toEqual(labels);
});
test("physical assignment leaves DNA unchanged, conceptual additions/removals recalculate, Collection detail stays universal", async ({
  page,
}) => {
  await setup(page, true);
  const before = await computations(page);
  const labels = await themeLabels(page);
  await section(page, "Cards");
  const addSol = async () => {
    await page.getByRole("button", { name: "Add Card", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "View Sol Ring", exact: true }).click();
    await page.getByRole("button", { name: "Add one copy", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Sol Ring added to" })).toBeVisible();
  };
  await addSol();
  expect(await computations(page)).toBe(before);
  await addSol();
  expect(await computations(page)).toBe(before + 1);
  await page.getByRole("button", { name: "Open Sol Ring details", exact: true }).click();
  await page
    .getByRole("button", { name: "Remove one Sol Ring", exact: true })
    .click();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await section(page, "Overview");
  // Wait for the revision-checked asynchronous save and resulting render.
  // The original conceptual composition can reuse its cached result.
  await expect.poll(() => themeLabels(page)).toEqual(labels);
  expect(await computations(page)).toBe(before + 1);
  await nav(page, "Collection");
  await page
    .getByRole("button", { name: "View Sol Ring", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "In This Deck", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Deck card navigation" }),
  ).toHaveCount(0);
});
