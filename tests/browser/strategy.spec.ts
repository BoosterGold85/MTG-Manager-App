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
async function openGoal(page: Page, goal: RegExp) {
  await page
    .getByRole("button", { name: "Upgrades I Own", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: goal }).click();
  return dialog;
}
const names = async (dialog: ReturnType<Page["getByRole"]>) =>
  (await dialog.locator(".synergy-candidates>li h3").allTextContents()).map(
    (t) => t.split(/ (?:Build Priority|Major|Strong|Moderate|Minor|Sidegrade|Downgrade)/)[0].trim(),
  );
test("the two goals answer different questions: real engines lead upgrades, off-plan staples keep priority but not fit", async ({
  page,
}, info) => {
  await setup(page);
  const before = await snapshot(page),
    calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("api.scryfall.com")) calls.push(r.url());
  });
  let dialog = await openGoal(page, /Improve My Current Deck/);
  const improve = await names(dialog);
  for (const offPlan of ["Alania's Pathmaker", "Mongoose Lizard", "Costly Dragon Support"])
    expect(improve.indexOf("Dragon Tempest")).toBeLessThan(improve.indexOf(offPlan));
  expect(improve.indexOf("Utvara Hellkite")).toBeLessThan(improve.indexOf("Alania's Pathmaker"));
  await expect(
    dialog.locator(".synergy-candidates>li").filter({ hasText: "Dragon Tempest" }),
  ).toContainText("Best swap: cut");
  await dialog.getByRole("button", { name: "Change goal", exact: true }).click();
  await dialog.getByRole("button", { name: /Build Around My Commander/ }).click();
  await expect(
    dialog.getByRole("region", { name: "Commander Blueprint" }),
  ).toContainText("Lathliss");
  const row = (name: string) =>
    dialog.locator(".synergy-candidates>li").filter({
      has: page.getByRole("heading", { name: new RegExp(name) }),
    });
  await expect(row("Utvara Hellkite")).toContainText(/Commander Fit: (Excellent|Exceptional)/);
  await expect(row("Alania.s Pathmaker")).toContainText("Commander Fit: Weak");
  await expect(row("Harnesser of Storms")).toContainText("Commander Fit: Weak");
  await dialog.getByRole("combobox", { name: "Sort" }).selectOption("fit");
  const byFit = await names(dialog);
  expect(byFit.indexOf("Utvara Hellkite")).toBeLessThan(byFit.indexOf("Harnesser of Storms"));
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
  await page.screenshot({ path: info.outputPath("upgrades-two-goals.png") });
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  expect(await snapshot(page)).toEqual(before);
  expect(calls).toEqual([]);
  dialog = page.getByRole("dialog");
  await expect(dialog).toHaveCount(0);
});
test("search, availability and reopen reuse cached analysis and keep the same order without saved changes", async ({
  page,
}) => {
  await setup(page);
  const before = await snapshot(page),
    computations = () =>
      page.evaluate(
        () => performance.getEntriesByName("mtg:strategy-profile").length,
      );
  let first: string[] = [],
    initial = 0;
  for (let i = 0; i < 2; i++) {
    const dialog = await openGoal(page, /Improve My Current Deck/);
    const order = await names(dialog);
    if (i === 0) {
      first = order;
      initial = await computations();
    } else expect(order).toEqual(first);
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
    await expect(dialog.locator(".synergy-candidates>li")).toHaveCount(1);
    await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  }
  expect(await computations()).toBe(initial);
  expect(await snapshot(page)).toEqual(before);
});
