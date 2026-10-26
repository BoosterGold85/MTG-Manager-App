import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { namedScoringCard, scoringCard } from "../scoringFixtures";
import { reignOfDragonsFixture } from "../recommendationFixtures";
import { synergyFixture } from "../synergyFixtures";
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
      }),
  );
}
async function setup(page: Page) {
  const f = reignOfDragonsFixture(),
    owned = synergyFixture().owned;
  f.state.revision = 1;
  f.deck.name = "Dragon scoring regression";
  f.deck.entries = f.deck.entries!.filter(
    (e) => !["Dragon Tempest", "Utvara Hellkite"].includes(e.name),
  );
  for (const name of [
    "Alania's Pathmaker",
    "Harnesser of Storms",
    "Mongoose Lizard",
    "Dragon Tempest",
    "Utvara Hellkite",
  ]) {
    const card = namedScoringCard(name);
    f.state.metadata[card.scryfallId] = card;
    f.state.items.push(
      owned(card, card.scryfallId, 1, name === "Utvara Hellkite" ? 1 : 0),
    );
  }
  // Deliberately inefficient but relevant support exercises the middle tier.
  const middle = {
    ...scoringCard(
      "Costly Dragon Support",
      "Creature — Goblin",
      "Dragon spells you cast cost {1} less to cast.",
      6,
    ),
    colorIdentity: ["R"] as const,
  };
  const middleCard = { ...middle, colorIdentity: [...middle.colorIdentity] };
  f.state.metadata[middleCard.scryfallId] = middleCard;
  f.state.items.push(owned(middleCard, middleCard.scryfallId, 1));
  f.state.decks!.push({
    ...f.deck,
    id: "other-deck",
    name: "Other Dragons",
    entries: undefined,
    commanders: f.deck.commanders.map((c) => {
      const next = { ...c };
      delete next.entryId;
      return next;
    }),
    assignments: [
      { itemId: namedScoringCard("Utvara Hellkite").scryfallId, quantity: 1 },
    ],
  });
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
  await page
    .getByRole("navigation")
    .filter({ visible: true })
    .getByRole("button", { name: "Decks", exact: true })
    .click();
  await page
    .locator(".deck-card")
    .filter({ hasText: "Dragon scoring regression" })
    .click();
}
test("strong engines are recommendations; named beta false positives stay collapsed with honest labels and exact signed breakdowns", async ({
  page,
}, info) => {
  await setup(page);
  const before = await snapshot(page),
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
    }),
    other = dialog.locator(".other-legal-cards");
  await expect(recommended).toBeVisible();
  await expect(recommended).toContainText("Dragon Tempest");
  await expect(recommended).toContainText("Utvara Hellkite");
  await expect(recommended).toContainText("Other Dragons");
  await expect(recommended).toContainText("Owned 1 · Available 0");
  await expect(recommended).toContainText("Available 1 · Owned 1");
  for (const [tier, min, max] of [
    ["Recommended", 70, 100],
    ["Worth Considering", 50, 69],
  ] as const) {
    const region = dialog.getByRole("region", { name: tier, exact: true });
    await expect(region).toBeVisible();
    for (const label of await region.locator("h3>span").allTextContents()) {
      const score = Number(label.match(/Synergy (\d+)/)![1]);
      expect(score).toBeGreaterThanOrEqual(min);
      expect(score).toBeLessThanOrEqual(max);
    }
  }
  await expect(
    recommended.getByRole("button", {
      name: "Compare Dragon Tempest",
      exact: true,
    }),
  ).toBeVisible();
  await expect(recommended.locator(".score-breakdown dl")).toHaveCount(0);
  for (const summary of await recommended
    .locator(".candidate-summary")
    .allTextContents()) {
    expect(summary).not.toMatch(/\d|contextual target|raw total|clamped/i);
  }
  for (const name of [
    "Alania's Pathmaker",
    "Harnesser of Storms",
    "Mongoose Lizard",
  ]) {
    await expect(recommended).not.toContainText(name);
    await expect(other).toContainText(name);
  }
  await expect(other).not.toHaveAttribute("open", "");
  await expect(
    other.getByRole("button", { name: /Compare Alania/ }),
  ).not.toBeVisible();
  await expect(
    recommended.locator(".score-breakdown").first(),
  ).not.toHaveAttribute("open", "");
  await other.locator(":scope>summary").click();
  const row = other
    .locator("li")
    .filter({ has: page.getByRole("heading", { name: /Alania.s Pathmaker/ }) });
  await expect(row).toContainText("Poor Fit");
  await expect(row.locator(".candidate-summary")).not.toHaveText("");
  await expect(row.locator(".candidate-summary")).not.toContainText(
    "contextual target",
  );
  await expect(row.locator(".candidate-summary")).not.toContainText(/\d/);
  await expect(row).not.toContainText("Conflicts:");
  const count = await page.evaluate(
    () => performance.getEntriesByName("mtg:strategy-profile").length,
  );
  await expect(row.locator(".score-breakdown dl")).toHaveCount(0);
  await row.getByText("Why this score?", { exact: true }).click();
  expect(
    await page.evaluate(
      () => performance.getEntriesByName("mtg:strategy-profile").length,
    ),
  ).toBe(count);
  const breakdown = row.locator(".score-breakdown");
  await expect(breakdown).toContainText("wrong_tribal_type");
  await expect(breakdown).toContainText("No verified Commander interaction");
  await expect(breakdown).toContainText("Existing-card interaction");
  const points = (await breakdown.locator("dd").allTextContents()).map(
      (value) => parseFloat(value),
    ),
    raw = points.reduce((n, p) => n + p, 0),
    score = Number(
      (await row.locator("h3>span").innerText()).match(/Synergy (\d+)/)![1],
    );
  expect(score).toBe(Math.max(0, Math.min(100, raw)));
  expect(points.some((p) => p < 0)).toBe(true);
  await expect(breakdown).toContainText(`Raw total: ${raw}`);
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
  await page.screenshot({ path: info.outputPath("contextual-scoring.png") });
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  expect(await snapshot(page)).toEqual(before);
  expect(calls).toEqual([]);
});
test("search, availability and reopen reuse the strategy profile and preserve score order without saved changes", async ({
  page,
}) => {
  await setup(page);
  const before = await snapshot(page),
    computations = () =>
      page.evaluate(
        () => performance.getEntriesByName("mtg:strategy-profile").length,
      ),
    initial = await computations();
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("button", { name: "Explore Synergy", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    const values = (
      await dialog.locator(".synergy-candidates>li h3>span").allTextContents()
    ).map((t) => Number(t.match(/Synergy (\d+)/)![1]));
    expect(values).toEqual([...values].sort((a, b) => b - a));
    await dialog
      .getByRole("combobox", { name: "Copy availability" })
      .selectOption("assigned");
    await expect(dialog).toContainText("Utvara Hellkite");
    await dialog
      .getByRole("combobox", { name: "Copy availability" })
      .selectOption("all");
    await dialog
      .getByRole("searchbox", { name: "Search owned candidates" })
      .fill("Mongoose");
    await expect(dialog.locator(".other-legal-cards")).not.toHaveAttribute(
      "open",
      "",
    );
    await dialog.locator(".other-legal-cards>summary").click();
    await expect(dialog.locator(".synergy-candidates>li")).toContainText(
      "Poor Fit",
    );
    await page.keyboard.press("Escape");
  }
  expect(await computations()).toBe(initial);
  expect(await snapshot(page)).toEqual(before);
});
