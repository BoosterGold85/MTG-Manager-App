import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { synergyFixture } from "../synergyFixtures";
import { section } from "./workspaceHelpers";
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
        r.onerror = () => reject(r.error);
      }),
  );
}
async function setup(page: Page, assignedOnly = false, large = false) {
  const f = synergyFixture();
  f.state.revision = 1;
  if (assignedOnly)
    f.state.items = f.state.items.filter((i) => i.id !== "utvara-foil");
  if (large)
    for (let i = 0; i < 70; i++) {
      const card = {
        ...f.utility,
        name: `Owned Extra ${String(i).padStart(3, "0")}`,
        scryfallId: `owned-extra-${i}`,
        oracleId: `owned-extra-${i}`,
      };
      f.state.metadata[card.scryfallId] = card;
      f.state.items.push(f.owned(card, card.scryfallId, 1));
    }
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
    .filter({ hasText: "Regression Deck" })
    .click();
  await expect(page.getByRole("heading", { name: "Regression Deck", exact: true })).toBeVisible();
  return f;
}
async function openUpgrades(page: Page) {
  await section(page, "Upgrades");
  await expect(page).toHaveURL(/tab=upgrades/);
  return page.getByRole("region", { name: "Upgrades", exact: true });
}
async function openBuild(page: Page) {
  const upgrades = await openUpgrades(page);
  await upgrades.getByRole("button", { name: /Build Around My Commander/ }).click();
  await expect(upgrades.getByRole("status")).toHaveText(/\d+ candidates?/);
  return upgrades;
}
const deckOf = (state: unknown) => (state as { decks: { id: string; name: string; assignments: { itemId: string; quantity: number }[]; savedCandidates?: { intent: string; candidateName: string }[] }[] }).decks.find((d) => d.name === "Regression Deck")!;
test("Upgrades is a deck section: the goal chooser separates the two questions and Build mode explains fit and priority without writes or lookups", async ({
  page,
}, info) => {
  await setup(page);
  const before = await snapshot(page);
  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("api.scryfall.com")) calls.push(r.url());
  });
  const upgrades = await openUpgrades(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const goals = upgrades.getByRole("region", { name: "Choose a goal" });
  await expect(goals.getByRole("heading", { name: "What are you trying to do?" })).toBeVisible();
  // A nine-card deck cannot simulate one-for-one swaps.
  await expect(goals.getByRole("button", { name: /Improve My Current Deck/ })).toBeDisabled();
  await expect(goals).toContainText("This deck has 9 of 99 cards");
  await goals.getByRole("button", { name: /Build Around My Commander/ }).click();
  await expect(upgrades.getByRole("status")).toHaveText("2 candidates");
  const candidate = upgrades.locator(".synergy-candidates>li").first();
  await expect(candidate.getByRole("heading", { level: 3 })).toHaveText("Utvara Hellkite");
  await expect(candidate.locator(".upgrade-headline")).toContainText(/Build Priority [A-Za-z ]+ \d+/);
  await expect(candidate.locator(".upgrade-secondary")).toContainText(/Commander Fit: [A-Za-z]+ · \d+/);
  await expect(candidate).toContainText("Available 2 · Owned 3");
  // Progressive disclosure: reasons stay closed until asked for.
  await expect(candidate.locator(".upgrade-why")).not.toHaveAttribute("open", "");
  await candidate.getByText("Why?", { exact: true }).click();
  await expect(candidate.locator(".upgrade-why")).toContainText("Why it fits");
  await expect(candidate.locator(".upgrade-why")).toContainText("Used in: Miirym (1)");
  await expect(candidate.getByRole("button", { name: /Review Swap/ })).toHaveCount(0);
  await expect(upgrades.getByText("Developer trace")).toHaveCount(0);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("upgrades-build-around.png") });
  await candidate.getByRole("button", { name: "Card Details", exact: true }).click();
  await expect(page.locator("#detail-title")).toHaveText("Utvara Hellkite");
  const scores = page.getByRole("region", { name: "Upgrades I Own scores" });
  await expect(scores).toContainText("Commander Fit");
  await expect(scores).toContainText("Build Priority");
  await expect(scores).toContainText("Needs at least 60 cards in the deck.");
  await page.keyboard.press("Escape");
  await expect(upgrades.getByRole("status")).toHaveText("2 candidates");
  await upgrades.getByRole("button", { name: "Change goal", exact: true }).click();
  await expect(upgrades.getByRole("heading", { name: "What are you trying to do?" })).toBeVisible();
  expect(await snapshot(page)).toEqual(before);
  expect(calls).toEqual([]);
  // The section survives reload and history.
  await page.reload();
  await expect(page.getByRole("region", { name: "Upgrades", exact: true })).toBeVisible();
  await section(page, "Cards");
  await page.goBack();
  await expect(page).toHaveURL(/tab=upgrades/);
  await expect(page.getByRole("region", { name: "Upgrades", exact: true })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/tab=cards/);
  expect(await snapshot(page)).toEqual(before);
});
test("Build mode adds an available candidate to an incomplete deck exactly once and stays in Upgrades", async ({ page }) => {
  await setup(page);
  const before = await snapshot(page);
  const upgrades = await openBuild(page);
  const utvara = upgrades.locator(".synergy-candidates>li").filter({ hasText: "Utvara Hellkite" });
  await utvara.getByRole("button", { name: "Add to Deck", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Utvara Hellkite added to Regression Deck." })).toBeVisible();
  await expect(upgrades.getByRole("status")).toHaveText("1 candidate");
  await expect(upgrades.locator(".synergy-candidates>li").filter({ hasText: "Utvara Hellkite" })).toHaveCount(0);
  await expect(page).toHaveURL(/tab=upgrades/);
  const after = await snapshot(page);
  const [b, a] = [before as { revision: number; items: { id: string; quantityAssigned: number; quantityOwned: number }[] }, after as { revision: number; items: { id: string; quantityAssigned: number; quantityOwned: number }[] }];
  expect(a.revision).toBe(b.revision + 1);
  const added = deckOf(after).assignments.filter((x) => !deckOf(before).assignments.some((y) => y.itemId === x.itemId));
  expect(added).toHaveLength(1);
  expect(added[0].quantity).toBe(1);
  const item = (s: typeof a) => s.items.find((i) => i.id === added[0].itemId)!;
  expect(item(a).quantityAssigned).toBe(item(b).quantityAssigned + 1);
  expect(item(a).quantityOwned).toBe(item(b).quantityOwned);
});
test("Save Candidate persists the build intent across reload and recalculates its scores; Remove clears it", async ({ page }) => {
  await setup(page);
  const upgrades = await openBuild(page);
  const utvara = upgrades.locator(".synergy-candidates>li").filter({ hasText: "Utvara Hellkite" });
  const priority = await utvara.locator(".upgrade-headline").innerText();
  await utvara.getByRole("button", { name: "Save Candidate", exact: true }).click();
  await expect(utvara.getByRole("button", { name: "Saved", exact: true })).toHaveAttribute("aria-pressed", "true");
  const stored = deckOf(await snapshot(page)).savedCandidates!;
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({ intent: "build", candidateName: "Utvara Hellkite" });
  expect(Object.keys(stored[0])).not.toContain("buildPriority");
  await page.reload();
  const again = page.getByRole("region", { name: "Upgrades", exact: true });
  await again.getByRole("button", { name: /^Saved/ }).click();
  const saved = again.getByRole("region", { name: "Saved candidates" });
  await expect(saved).toContainText("Saved · 1");
  await expect(saved.locator("li")).toContainText("Build Candidate");
  await expect(saved.locator("li")).toContainText(priority.replace(/^Build Priority\s*/, "").replace(/\s*\d+$/, ""));
  await expect(saved.locator("li")).toContainText(/Commander Fit [A-Za-z]+ · \d+/);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await saved.getByRole("button", { name: "Remove Utvara Hellkite from Saved", exact: true }).click();
  await expect(again).toContainText("Nothing saved yet.");
  await page.reload();
  expect(deckOf(await snapshot(page)).savedCandidates).toEqual([]);
});
test("assigned candidates stay visible; search, availability filter, sorting and empty state work", async ({
  page,
}) => {
  await setup(page, true);
  const before = await snapshot(page);
  const dialog = await openBuild(page);
  await expect(dialog.locator(".synergy-candidates>li").first()).toContainText(
    "Utvara Hellkite",
  );
  await expect(dialog.locator(".synergy-candidates>li").first()).toContainText(
    "Owned 1 · Available 0 · No available copy",
  );
  await expect(dialog.locator(".synergy-candidates>li").first().getByRole("button", { name: "Add to Deck" })).toBeDisabled();
  await dialog.getByRole("combobox", { name: "Sort" }).selectOption("name");
  await expect(dialog.locator(".synergy-candidates>li h3").first()).toContainText(
    "Quiet Owned Card",
  );
  await dialog.getByRole("combobox", { name: "Sort" }).selectOption("default");
  await dialog
    .getByRole("combobox", { name: "Copy availability" })
    .selectOption("available");
  await expect(dialog.getByRole("status")).toHaveText("1 candidate");
  await expect(dialog).not.toContainText("Utvara Hellkite");
  await dialog
    .getByRole("combobox", { name: "Copy availability" })
    .selectOption("assigned");
  await expect(dialog.locator(".synergy-candidates>li")).toHaveCount(1);
  await expect(dialog.locator(".synergy-candidates>li")).toContainText(
    "Utvara Hellkite",
  );
  await dialog
    .getByRole("combobox", { name: "Copy availability" })
    .selectOption("all");
  await dialog
    .getByRole("searchbox", { name: "Search owned candidates" })
    .fill("utvara");
  await expect(dialog.getByRole("status")).toHaveText("1 candidate");
  await dialog
    .getByRole("searchbox", { name: "Search owned candidates" })
    .fill("not-owned-anywhere");
  await expect(dialog.getByRole("status")).toHaveText("0 candidates");
  await expect(dialog).toContainText("No owned candidates match");
  expect(await snapshot(page)).toEqual(before);
});

test("large candidate lists render progressively while search covers all owned candidates", async ({
  page,
}) => {
  await setup(page, false, true);
  const before = await snapshot(page);
  const dialog = await openBuild(page);
  await expect(dialog.getByRole("status")).toHaveText("72 candidates");
  await expect(dialog.locator(".synergy-candidates>li")).toHaveCount(40);
  await dialog.getByRole("button", { name: "Show more candidates" }).click();
  await expect(dialog.locator(".synergy-candidates>li")).toHaveCount(72);
  await dialog
    .getByRole("searchbox", { name: "Search owned candidates" })
    .fill("Owned Extra 069");
  await expect(dialog.locator(".synergy-candidates>li")).toHaveCount(1);
  await expect(dialog.locator(".synergy-candidates>li")).toContainText(
    "Owned Extra 069",
  );
  expect(await snapshot(page)).toEqual(before);
});
