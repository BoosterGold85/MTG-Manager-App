import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  reignOfDragonsFixture,
  canonicalFactsCards,
} from "../recommendationFixtures";
import { scoringCard } from "../scoringFixtures";
import { synergyFixture } from "../synergyFixtures";
import { section, writeState } from "./workspaceHelpers";
import type { CollectionState } from "../../src/models/collection";
import { deckCount } from "../../src/decks/decks";
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
async function setup(page: Page, mutate?: (f: ReturnType<typeof reignOfDragonsFixture>) => void) {
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
  mutate?.(f);
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
async function openImprove(page: Page) {
  await section(page, "Upgrades");
  const upgrades = page.getByRole("region", { name: "Upgrades", exact: true });
  await upgrades.getByRole("button", { name: /Improve My Current Deck/ }).click();
  await expect(upgrades.getByRole("status")).toHaveText(/\d+ candidates?/);
  return upgrades;
}
const reign = (s: unknown) => (s as CollectionState).decks!.find((d) => d.name === "Reign of Dragons")!;
const entryQty = (s: unknown, name: string) => reign(s).entries!.filter((e) => e.name === name).reduce((n, e) => n + e.quantity, 0);
const itemFor = (s: unknown, name: string) => {
  const state = s as CollectionState;
  return state.items.find((i) => state.metadata[i.scryfallId]?.name === name)!;
};
test("Reign: Improve ranks by best one-for-one swap with simple cards, and Review Swap evaluates best, manual and invalid cuts without writes", async ({
  page,
}, info) => {
  await setup(page);
  const before = await read(page),
    calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("api.scryfall.com")) calls.push(r.url());
  });
  const upgrades = await openImprove(page);
  await expect(upgrades.getByRole("status")).toHaveText("3 candidates");
  const rows = upgrades.locator(".synergy-candidates>li");
  const wayfinder = rows.filter({ hasText: "Changeling Wayfinder" });
  await expect(rows.first()).toContainText("Changeling Wayfinder");
  await expect(wayfinder.locator(".upgrade-headline")).toHaveText(/Minor Upgrade \+0\.\d\d/);
  await expect(wayfinder.locator(".upgrade-cut")).toContainText("Best swap: cut");
  await expect(wayfinder.locator(".upgrade-why")).not.toHaveAttribute("open", "");
  await wayfinder.getByText("Why?", { exact: true }).click();
  await expect(wayfinder.locator(".upgrade-why")).toContainText("Confidence: High");
  await expect(wayfinder.locator(".upgrade-why")).toContainText(/Commander Fit: [A-Za-z]+ · \d+/);
  await expect(rows.filter({ hasText: "Fire Nation Attacks" }).locator(".upgrade-headline")).toContainText("Sidegrade");
  const bestCut = (await wayfinder.locator(".upgrade-cut").innerText()).replace("Best swap: cut ", "");
  await wayfinder.getByRole("button", { name: "Review Swap", exact: true }).click();
  const review = page.getByRole("dialog");
  await expect(review.getByRole("heading", { name: "Review Swap" })).toBeVisible();
  await expect(review.getByRole("region", { name: "Card going out" })).toContainText(bestCut);
  await expect(review.getByRole("region", { name: "Card coming in" })).toContainText("Changeling Wayfinder");
  await expect(review.getByRole("region", { name: "Expected deck impact" })).toContainText("Synergy engines");
  await expect(review.locator(".swap-value")).toContainText(/Upgrade Value \+0\.\d\d · Minor Upgrade/);
  await expect(review.getByRole("region", { name: "Physical copy" })).toContainText("Available 1");
  await expect(review).toHaveCSS("opacity", "1");
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("review-swap.png") });
  await review.getByRole("button", { name: "Choose Different Cut", exact: true }).click();
  const another = review.getByRole("combobox", { name: "Another card in this deck" });
  await another.selectOption({ label: "Lightning Bolt" });
  await expect(review.getByRole("region", { name: "Card going out" })).toContainText("Lightning Bolt");
  await expect(review.locator(".swap-value")).toContainText("Upgrade Value");
  await expect(review.getByRole("button", { name: "Confirm Swap", exact: true })).toBeEnabled();
  await another.selectOption({ label: "Mountain" });
  await expect(review).toContainText("Not a valid swap: Lands are never cut for a spell");
  await expect(review.getByRole("button", { name: "Confirm Swap", exact: true })).toBeDisabled();
  await review.getByRole("button", { name: new RegExp(`^${bestCut}.*best$`) }).click();
  await expect(review.getByRole("button", { name: "Confirm Swap", exact: true })).toBeEnabled();
  await review.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await read(page)).toEqual(before);
  expect(calls).toEqual([]);
});
test("Confirm Swap is one atomic write: one card out, one owned copy in, count unchanged, then results recalculate", async ({ page }) => {
  await setup(page);
  const before = await read(page);
  const upgrades = await openImprove(page);
  const wayfinder = upgrades.locator(".synergy-candidates>li").filter({ hasText: "Changeling Wayfinder" });
  const bestCut = (await wayfinder.locator(".upgrade-cut").innerText()).replace("Best swap: cut ", "");
  await wayfinder.getByRole("button", { name: "Save Upgrade", exact: true }).click();
  await expect(wayfinder.getByRole("button", { name: "Saved", exact: true })).toBeVisible();
  const saved = await read(page);
  await wayfinder.getByRole("button", { name: "Review Swap", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm Swap", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: `Changeling Wayfinder replaced ${bestCut}.` })).toBeVisible();
  await expect(page).toHaveURL(/tab=upgrades/);
  await expect(upgrades.getByRole("status")).toHaveText("2 candidates");
  const after = await read(page);
  expect((after as CollectionState).revision).toBe((saved as CollectionState).revision + 1);
  expect(deckCount(reign(after))).toBe(deckCount(reign(before)));
  expect(entryQty(after, bestCut)).toBe(entryQty(before, bestCut) - 1);
  expect(entryQty(after, "Changeling Wayfinder")).toBe(1);
  const incoming = itemFor(after, "Changeling Wayfinder");
  expect(incoming).toMatchObject({ quantityOwned: 1, quantityAssigned: 1, quantityUnassigned: 0 });
  expect(reign(after).assignments.filter((a) => a.itemId === incoming.id)).toHaveLength(1);
  const outgoing = itemFor(before, bestCut);
  if (outgoing) {
    const was = reign(before).assignments.filter((a) => a.itemId === outgoing.id).reduce((n, a) => n + a.quantity, 0);
    expect(itemFor(after, bestCut).quantityUnassigned).toBe(outgoing.quantityUnassigned + (was ? 1 : 0));
    expect(itemFor(after, bestCut).quantityOwned).toBe(outgoing.quantityOwned);
  }
  // The saved upgrade is fulfilled, so it leaves Saved automatically.
  expect(reign(after).savedCandidates).toEqual([]);
  await section(page, "Cards");
  await expect(page.getByRole("heading", { name: "Changeling Wayfinder ×1", exact: true })).toBeVisible();
});
test("Save Upgrade persists across reload with a recalculated grade; a stale or unavailable copy rejects Confirm Swap with no write", async ({ page }) => {
  await setup(page);
  const upgrades = await openImprove(page);
  const wayfinder = upgrades.locator(".synergy-candidates>li").filter({ hasText: "Changeling Wayfinder" });
  await wayfinder.getByRole("button", { name: "Save Upgrade", exact: true }).click();
  await expect(wayfinder.getByRole("button", { name: "Saved", exact: true })).toBeVisible();
  await page.reload();
  const again = page.getByRole("region", { name: "Upgrades", exact: true });
  await again.getByRole("button", { name: /^Saved/ }).click();
  const saved = again.getByRole("region", { name: "Saved candidates" });
  await expect(saved.locator("li")).toContainText("Changeling Wayfinder");
  await expect(saved.locator("li .upgrade-headline")).toHaveText(/Minor Upgrade \+0\.\d\d/);
  await expect(saved.locator("li")).toContainText("Suggested out:");
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await saved.getByRole("button", { name: "Review Swap", exact: true }).click();
  const review = page.getByRole("dialog");
  await expect(review.getByRole("button", { name: "Confirm Swap", exact: true })).toBeEnabled();
  // Another tab assigns the only copy elsewhere before this tab confirms.
  const current = (await read(page)) as CollectionState;
  const changed = structuredClone(current);
  const item = changed.items.find((i) => changed.metadata[i.scryfallId]?.name === "Changeling Wayfinder")!;
  item.quantityAssigned = 1;
  item.quantityUnassigned = 0;
  changed.decks!.find((d) => d.name === "Reign of Dragons")!.assignments.push({ itemId: item.id, quantity: 1, entryId: changed.decks!.find((d) => d.name === "Reign of Dragons")!.entries![0].id });
  changed.decks!.find((d) => d.name === "Reign of Dragons")!.entries![0].quantity += 1;
  changed.revision += 1;
  await writeState(page, changed);
  await review.getByRole("button", { name: "Confirm Swap", exact: true }).click();
  await expect(review.getByRole("alert")).toContainText("Swap not saved");
  expect(await read(page)).toEqual(changed);
  await review.getByRole("button", { name: "Cancel", exact: true }).click();
  // This tab is now behind the stored revision; after loading the latest state, Remove works.
  await page.reload();
  await page.getByRole("region", { name: "Upgrades", exact: true }).getByRole("button", { name: /^Saved/ }).click();
  await page.getByRole("button", { name: "Remove Changeling Wayfinder from Saved", exact: true }).click();
  await expect(page.getByRole("region", { name: "Upgrades", exact: true })).toContainText("Nothing saved yet.");
});
test("a copy assigned to another deck can be saved and reviewed but never swapped in; the other deck is untouched", async ({ page }) => {
  await setup(page, (f) => {
    const item = f.state.items.find((i) => f.state.metadata[i.scryfallId]?.name === "Changeling Wayfinder")!;
    item.quantityAssigned = 1;
    item.quantityUnassigned = 0;
    const other = { ...structuredClone(f.deck), id: "deck-b", name: "Deck B", entries: undefined, assignments: [{ itemId: item.id, quantity: 1 }] };
    other.commanders = f.deck.commanders.map((c) => ({ ...c, itemId: undefined, entryId: undefined }));
    f.state.decks!.push(other);
  });
  const before = await read(page);
  const upgrades = await openImprove(page);
  const wayfinder = upgrades.locator(".synergy-candidates>li").filter({ hasText: "Changeling Wayfinder" });
  await expect(wayfinder).toContainText("No available copy");
  await wayfinder.getByRole("button", { name: "Save Upgrade", exact: true }).click();
  await expect(wayfinder.getByRole("button", { name: "Saved", exact: true })).toBeVisible();
  await wayfinder.getByRole("button", { name: "Review Swap", exact: true }).click();
  const review = page.getByRole("dialog");
  await expect(review.getByRole("region", { name: "Physical copy" })).toContainText("No available copy");
  await expect(review.getByRole("button", { name: "Confirm Swap", exact: true })).toBeDisabled();
  await review.getByRole("button", { name: "Cancel", exact: true }).click();
  const after = (await read(page)) as CollectionState;
  expect(after.decks!.find((d) => d.id === "deck-b")).toEqual((before as CollectionState).decks!.find((d) => d.id === "deck-b"));
  expect(reign(after).entries).toEqual(reign(before).entries);
});
test("low confidence stays capped and below confident results; the detail view shows all three scores separately", async ({
  page,
}) => {
  await setup(page);
  const before = await read(page);
  const upgrades = await openImprove(page);
  await upgrades.getByRole("searchbox", { name: "Search owned candidates" }).fill("Uncertain");
  const row = upgrades.locator(".synergy-candidates>li");
  await row.getByText("Why?", { exact: true }).click();
  await expect(row).toContainText("Confidence: Low");
  await expect(row.locator(".upgrade-headline")).not.toContainText(/Major Upgrade|Strong Upgrade|Moderate Upgrade/);
  await upgrades.getByRole("searchbox", { name: "Search owned candidates" }).fill("");
  await upgrades.getByRole("button", { name: "Change goal", exact: true }).click();
  await upgrades.getByRole("button", { name: /Build Around My Commander/ }).click();
  await expect(upgrades.getByRole("status")).toHaveText(/\d+ candidates?/);
  const priorities = (await upgrades.locator(".synergy-candidates>li .upgrade-number").allTextContents()).map(Number);
  expect(priorities).toEqual([...priorities].sort((a, b) => b - a));
  // Full decks offer Evaluate as Upgrade instead of adding a 101st card.
  await expect(upgrades.getByRole("button", { name: "Add to Deck" })).toHaveCount(0);
  await upgrades.locator(".synergy-candidates>li").filter({ hasText: "Changeling Wayfinder" }).getByRole("button", { name: "Card Details", exact: true }).click();
  const scores = page.getByRole("region", { name: "Upgrades I Own scores" });
  await expect(scores).toContainText(/Commander Fit[A-Za-z]+ — \d+/);
  await expect(scores).toContainText(/Build Priority[A-Za-z ]+ — \d+/);
  await expect(scores).toContainText(/Upgrade ValueMinor Upgrade \(\+0\.\d\d\) · best swap: cut/);
  await page.keyboard.press("Escape");
  await upgrades.locator(".synergy-candidates>li").filter({ hasText: "Changeling Wayfinder" }).getByRole("button", { name: "Evaluate as Upgrade", exact: true }).click();
  await expect(upgrades.getByRole("searchbox", { name: "Search owned candidates" })).toHaveValue("Changeling Wayfinder");
  await expect(upgrades.getByRole("status")).toHaveText("1 candidate");
  await expect(upgrades.locator(".synergy-candidates>li")).toContainText("Best swap: cut");
  expect(await read(page)).toEqual(before);
});
