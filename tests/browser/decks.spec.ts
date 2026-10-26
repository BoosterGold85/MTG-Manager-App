import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  exportCsv,
  fixtureRow,
  sol,
  forest,
  meren,
  tatyova,
} from "../importFixtures";
async function importCards(page: Page, quantity = 3) {
  await page
    .getByRole("button", { name: "Import Collection", exact: true })
    .first()
    .click();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "ManaBox.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        exportCsv([
          fixtureRow(sol, quantity),
          fixtureRow(forest, 3),
          fixtureRow(meren, 3),
          fixtureRow(tatyova, 2),
          fixtureRow(sol, 1, { Foil: "foil" }),
        ]),
      ),
    });
  await page
    .getByRole("button", { name: "Confirm import", exact: true })
    .click();
  await page.getByRole("button", { name: "Return to binder" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}
async function nav(page: Page, label: string) {
  await page
    .getByRole("navigation")
    .filter({ visible: true })
    .getByRole("button", { name: label, exact: true })
    .click();
}
async function start(page: Page) {
  await page.goto("/");
  await expect(page.locator(".card-tile")).toHaveCount(32);
  await importCards(page);
  await nav(page, "Decks");
}
async function create(page: Page, name: string) {
  await page.getByRole("button", { name: "New Deck", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Deck name", exact: true })
    .fill(name);
  await page
    .getByRole("button", { name: "Choose Commander", exact: true })
    .click();
  await page
    .getByRole("searchbox", { name: "Search commanders" })
    .fill("Meren");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Meren of Clan Nel Toth/ })
    .click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}
async function addSol(page: Page, count = 1) {
  await page.getByRole("button", { name: "Add Cards", exact: true }).click();
  await page
    .getByRole("searchbox", { name: "Search owned cards" })
    .fill("Sol Ring");
  await page
    .getByRole("button", { name: "View Sol Ring", exact: true })
    .first()
    .click();
  for (let i = 0; i < count; i++) {
    await page
      .getByRole("button", { name: "Add one copy", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Add one copy", exact: true }),
    ).toBeEnabled();
  }
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
}
async function axe(page: Page) {
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
}
async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
test("owned commander, color boundary, assignment persistence, Deck Usage and premium mobile editor", async ({
  page,
}, info) => {
  await start(page);
  await expect(
    page.getByRole("heading", { name: "Build your first Commander deck." }),
  ).toBeVisible();
  await axe(page);
  await create(page, "Graveyard Stories");
  await expect(page.getByRole("region", { name: "Commander" })).toContainText(
    "Owned 3 · Assigned 1 · Available 2",
  );
  await page.getByRole("button", { name: "Add Cards", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "View Tatyova, Benthic Druid",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "View Forest", exact: true }),
  ).toBeVisible();
  await fits(page);
  await axe(page);
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Commander Colors" })
    .selectOption("C");
  await page.getByRole("button", { name: /Apply/ }).click();
  await expect(
    page.getByRole("button", { name: "View Forest", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "View Sol Ring", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Owned 3 · Assigned 0 · Available 3",
  );
  await page.getByRole("button", { name: "Add one copy", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Owned 3 · Assigned 1 · Available 2",
  );
  await axe(page);
  await page.screenshot({ path: info.outputPath("assign-copy.png") });
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Deck", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sol Ring ×1", exact: true }),
  ).toBeVisible();
  await fits(page);
  await axe(page);
  await page.screenshot({
    path: info.outputPath("deck-editor.png"),
    fullPage: true,
  });
  await page.reload();
  await nav(page, "Decks");
  await page.locator(".deck-card").click();
  await expect(
    page.getByRole("heading", { name: "Sol Ring ×1", exact: true }),
  ).toBeVisible();
  await nav(page, "Collection");
  await page
    .getByRole("button", { name: "View Sol Ring", exact: true })
    .first()
    .click();
  await expect(page.getByRole("region", { name: "Deck Usage" })).toContainText(
    "Owned: 3 · Available: 2 · Assigned: 1",
  );
  await page
    .getByRole("button", { name: "Graveyard Stories ×1", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Graveyard Stories", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("multiple decks, no copy transfer, explicit release, printing distinction and confirmed deletion", async ({
  page,
}, info) => {
  await start(page);
  await create(page, "Deck A");
  await addSol(page, 2);
  await page.getByRole("button", { name: "All decks", exact: true }).click();
  await create(page, "Deck B");
  await page.getByRole("button", { name: "Add Cards", exact: true }).click();
  await page
    .getByRole("searchbox", { name: "Search owned cards" })
    .fill("Sol Ring");
  await expect(page.locator(".card-tile")).toHaveCount(2);
  await page
    .getByRole("button", { name: "View Sol Ring", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Add one copy", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add one copy", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("dialog")).toContainText(
    "No unassigned copy available",
  );
  await expect(page.getByRole("dialog")).toContainText("Deck A ×2");
  await expect(page.getByRole("dialog")).toContainText("Deck B ×1");
  await page.screenshot({ path: info.outputPath("no-unassigned.png") });
  await page
    .getByRole("button", { name: "Remove one copy", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Available 1");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page
    .getByRole("button", { name: "View Sol Ring", exact: true })
    .nth(1)
    .click();
  await expect(page.getByRole("dialog")).toContainText("foil");
  await expect(page.getByRole("dialog")).toContainText(
    "Owned 1 · Assigned 0 · Available 1",
  );
  await page.getByRole("button", { name: "Add one copy", exact: true }).click();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Edit Deck", exact: true }).click();
  await page.getByRole("textbox", { name: "Deck name" }).fill("Deck B renamed");
  await page
    .getByRole("button", { name: "Save deck name", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit Deck", exact: true }).click();
  await page.getByRole("button", { name: "Delete deck", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Collection cards and ManaBox are unchanged",
  );
  await page
    .getByRole("button", { name: "Confirm delete deck", exact: true })
    .click();
  await expect(page.locator(".deck-card")).toHaveCount(1);
  await nav(page, "Collection");
  await expect(page.locator(".card-tile")).toHaveCount(5);
  await page
    .getByRole("button", { name: "View Sol Ring", exact: true })
    .first()
    .click();
  await expect(page.getByRole("region", { name: "Deck Usage" })).toContainText(
    "Assigned: 2",
  );
});
test("actual ManaBox re-import preserves assignments, exposes shortages and exports complete backup", async ({
  page,
}, info) => {
  await start(page);
  await create(page, "Persistent Deck");
  await addSol(page, 2);
  await nav(page, "Collection");
  await importCards(page, 1);
  await expect(
    page.getByText("Inventory needs reconciliation.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Review allocation conflicts" })
    .click();
  await expect(
    page.getByRole("region", { name: "Allocation conflicts" }),
  ).toContainText("Owned 1 · Assigned 2");
  await page.screenshot({
    path: info.outputPath("allocation-conflict.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Deck", exact: true }).click();
  await page
    .getByRole("button", { name: "Remove one Sol Ring", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Allocation conflicts" }),
  ).toHaveCount(0);
  await nav(page, "Collection");
  await page
    .getByRole("button", { name: "Manage Collection", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export Backup", exact: true })
    .click();
  const file = await download;
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const backup = JSON.parse(Buffer.concat(chunks).toString());
  expect(backup.applicationVersion).toBe("0.6.2");
  expect(backup.collection.decks[0].name).toBe("Persistent Deck");
  expect(backup.collection.decks[0].assignments[0].quantity).toBe(1);
  expect(backup.collection.decks[0].commanders[0].itemId).toBeTruthy();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.reload();
  await nav(page, "Decks");
  await page.locator(".deck-card").click();
  await expect(
    page.getByRole("heading", { name: "Sol Ring ×1", exact: true }),
  ).toBeVisible();
});
