import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
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
  await expect(
    page.getByRole("button", { name: "Explore Synergy", exact: true }),
  ).toHaveCount(0);
  await page
    .locator(".deck-card")
    .filter({ hasText: "Regression Deck" })
    .click();
  await expect(
    page.getByRole("button", { name: "Explore Synergy", exact: true }),
  ).toBeVisible();
  return f;
}
test("owned candidates explain fit, group printings, show availability and usage, compare without writes or lookups", async ({
  page,
}, info) => {
  await setup(page);
  const before = await snapshot(page);
  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("api.scryfall.com")) calls.push(r.url());
  });
  await page
    .getByRole("button", { name: "Explore Synergy", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Upgrades I Own", exact: true }),
  ).toBeVisible();
  await expect(dialog.getByRole("status")).toHaveText("2 candidates");
  const candidate = dialog.locator(".synergy-candidates>li").first();
  await expect(candidate).toContainText("Utvara Hellkite");
  await expect(candidate).toContainText("Available: 2 · Owned: 3");
  await expect(candidate).toContainText("Used in: Miirym (1)");
  await expect(candidate).toContainText("Dragon");
  expect(await dialog.locator(".synergy-candidates>li").count()).toBe(2);
  await dialog
    .getByRole("button", { name: "Compare Utvara Hellkite", exact: true })
    .click();
  const comparison = dialog.getByRole("region", {
    name: "Candidate comparison",
    exact: true,
  });
  await expect(comparison).toBeFocused();
  await comparison
    .getByLabel("Compare with a card in this deck")
    .selectOption({ label: "Dragon Hatchling" });
  await expect(
    comparison.getByRole("region", { name: "Current deck card", exact: true }),
  ).toContainText("Dragon Hatchling");
  await expect(
    comparison.getByRole("region", { name: "In This Deck", exact: true }),
  ).toHaveCount(2);
  await expect(comparison).toContainText(
    "Choosing this comparison makes no deck changes.",
  );
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
  await page.screenshot({
    path: info.outputPath("owned-synergy-comparison.png"),
  });
  await comparison
    .getByRole("button", { name: "View candidate card details", exact: true })
    .click();
  await expect(page.locator("#detail-title")).toHaveText("Utvara Hellkite");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "Upgrades I Own", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  expect(await snapshot(page)).toEqual(before);
  expect(calls).toEqual([]);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Regression Deck", exact: true }),
  ).toBeVisible();
  expect(await snapshot(page)).toEqual(before);
  await page
    .getByRole("button", { name: "Explore Synergy", exact: true })
    .click();
  await page.goBack();
  await expect(page.getByRole("heading", { name: /My Decks/ })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .locator(".deck-card")
    .filter({ hasText: "Regression Deck" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await snapshot(page)).toEqual(before);
});
test("higher Synergy ranks first while assigned candidates stay visible; search, availability filter and empty state work", async ({
  page,
}) => {
  await setup(page, true);
  const before = await snapshot(page);
  await page
    .getByRole("button", { name: "Explore Synergy", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".synergy-candidates>li").first()).toContainText(
    "Utvara Hellkite",
  );
  await expect(dialog.locator(".synergy-candidates>li").first()).toContainText(
    "No unassigned copies",
  );
  await expect(dialog.locator(".synergy-candidates>li").first()).toContainText(
    "Miirym",
  );
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
  await expect(dialog.locator(".synergy-candidates>li")).toContainText(
    "Utvara Hellkite",
  );
  await dialog
    .getByRole("searchbox", { name: "Search owned candidates" })
    .fill("not-owned-anywhere");
  await expect(dialog.getByRole("status")).toHaveText("0 candidates");
  await expect(dialog).toContainText("No owned candidates match");
  await page.keyboard.press("Escape");
  expect(await snapshot(page)).toEqual(before);
});

test("large candidate lists render progressively while search covers all owned candidates", async ({
  page,
}) => {
  await setup(page, false, true);
  const before = await snapshot(page);
  await page
    .getByRole("button", { name: "Explore Synergy", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("status")).toHaveText("72 candidates");
  await expect(dialog.locator(".other-legal-cards")).not.toHaveAttribute(
    "open",
    "",
  );
  await expect(
    dialog.locator(".other-legal-cards .synergy-candidates>li"),
  ).toHaveCount(40);
  await dialog.locator(".other-legal-cards>summary").click();
  await dialog.getByRole("button", { name: "Show more candidates" }).click();
  await expect(dialog.locator(".synergy-candidates>li")).toHaveCount(72);
  await dialog
    .getByRole("searchbox", { name: "Search owned candidates" })
    .fill("Owned Extra 069");
  await expect(dialog.locator(".synergy-candidates>li")).toHaveCount(1);
  await expect(dialog.locator(".synergy-candidates>li")).toContainText(
    "Owned Extra 069",
  );
  await page.keyboard.press("Escape");
  expect(await snapshot(page)).toEqual(before);
});
