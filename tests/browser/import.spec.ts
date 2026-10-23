import { test, expect } from "@playwright/test";
import type { Page, Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  exportCsv,
  solRow,
  sol,
  meren,
  tatyova,
  fixtureRow,
} from "../importFixtures";
import opt from "../fixtures/scryfall-opt.json" with { type: "json" };
async function start(page: Page) {
  await page.goto("/");
  await expect(page.locator(".card-tile")).toHaveCount(32);
}
async function open(page: Page) {
  await page.locator(".import-button").click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Import Collection", exact: true }),
  ).toBeVisible();
  return dialog;
}
async function upload(page: Page, csv: string, name = "ManaBox.csv") {
  await page
    .locator("input[type=file]")
    .setInputFiles({ name, mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(
    page.getByRole("dialog").getByText("REVIEW BEFORE SAVING", { exact: true }),
  ).toBeVisible();
}
const stat = (dialog: Locator, name: string) =>
  dialog.getByText(name, { exact: true }).locator("..").locator("dd");
async function confirm(page: Page) {
  await page
    .getByRole("button", { name: "Confirm import", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Collection imported", exact: true }),
  ).toBeVisible();
}
async function returnToBinder(page: Page) {
  await page.getByRole("button", { name: "Return to binder" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}

test("valid upload previews without writing, persists ownership and re-imports quantities idempotently", async ({
  page,
}, info) => {
  const apiCalls: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith("https://api.scryfall.com"))
      apiCalls.push(request.url());
  });
  await start(page);
  let dialog = await open(page);
  const csv = exportCsv([solRow(1)]);
  await upload(page, csv);
  await expect(stat(dialog, "New records")).toHaveText("1");
  // Leaving a preview never changes the binder or its persisted state.
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await expect(page.locator(".card-tile")).toHaveCount(32);
  dialog = await open(page);
  await upload(page, csv);
  await confirm(page);
  await returnToBinder(page);
  await expect(page.locator(".card-tile")).toHaveCount(1);
  await expect(page.locator(".sample-label")).toHaveText("YOUR COLLECTION");
  await page.reload();
  await expect(page.locator(".card-tile")).toHaveCount(1);
  await page
    .getByRole("button", { name: "View Sol Ring", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Card details" })
    .locator(".card-facts")
    .scrollIntoViewIfNeeded();
  await expect(page.getByText("1 unassigned · 0 assigned")).toBeVisible();
  await page.getByText("Original import fields", { exact: true }).click();
  await expect(page.locator(".source-fields pre")).toContainText("2.50");
  await page.getByRole("button", { name: "Close dialog" }).click();
  dialog = await open(page);
  await upload(page, csv);
  await expect(stat(dialog, "Unchanged records")).toHaveText("1");
  await expect(stat(dialog, "New records")).toHaveText("0");
  await confirm(page);
  await returnToBinder(page);
  dialog = await open(page);
  await upload(page, exportCsv([solRow(2)]));
  await expect(stat(dialog, "Updated records")).toHaveText("1");
  await page.screenshot({ path: info.outputPath("import-preview.png") });
  await confirm(page);
  await returnToBinder(page);
  await expect(page.locator(".card-tile")).toHaveCount(1);
  await expect(page.locator(".quantity")).toHaveText("2");
  await page.reload();
  await expect(page.locator(".quantity")).toHaveText("2");
  expect(apiCalls).toEqual([]);
  await page.screenshot({ path: info.outputPath("imported-binder.png") });
});

test("imported variants retain normal filters, sort and Commander Colors subset matching", async ({
  page,
}) => {
  await start(page);
  await open(page);
  await upload(
    page,
    exportCsv([
      solRow(1),
      solRow(2, { Foil: "foil" }),
      fixtureRow(meren, 1, { "Scryfall ID": "" }),
      fixtureRow(tatyova),
    ]),
  );
  await confirm(page);
  await returnToBinder(page);
  await expect(page.locator(".card-tile")).toHaveCount(4);
  await page.getByRole("button", { name: /^Filters/ }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Commander Colors", { exact: true })
    .selectOption("BG");
  await dialog.getByRole("button", { name: "Apply · Show 3 cards" }).click();
  await expect(page.locator(".card-tile")).toHaveCount(3);
  await expect(
    page.getByRole("button", {
      name: "View Tatyova, Benthic Druid",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Green", exact: true }).click();
  await expect(page.locator(".card-tile")).toHaveCount(1);
  await page.getByRole("searchbox").fill("meren");
  await expect(
    page.getByRole("button", {
      name: "View Meren of Clan Nel Toth",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset all", exact: true }).click();
  await expect(page.locator(".card-tile")).toHaveCount(4);
  await page.getByLabel("Sort cards").selectOption("mana");
  await expect(page.locator(".tile-title").first()).toHaveText("Sol Ring");
  await page.getByRole("button", { name: /^Filters/ }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Finish", { exact: true }).selectOption("foil");
  await dialog.getByRole("button", { name: "Apply · Show 1 cards" }).click();
  await expect(page.locator(".card-tile")).toHaveCount(1);
});

test("partial success keeps unknown rows and their original fields available after reload", async ({
  page,
}) => {
  await page.route("https://api.scryfall.com/**", (route) =>
    route.fulfill({ json: { data: [], not_found: [] } }),
  );
  await start(page);
  let dialog = await open(page);
  await upload(
    page,
    exportCsv([
      solRow(),
      solRow(1, {
        Name: "Unknown card",
        "Scryfall ID": "00000000-0000-4000-8000-000000000099",
        "Set code": "tst",
        "Collector number": "99",
        "Purchase price": "7.25",
      }),
    ]),
  );
  await expect(stat(dialog, "Recognized rows")).toHaveText("1");
  await expect(stat(dialog, "Problem rows")).toHaveText("1");
  await dialog
    .getByRole("button", { name: "Confirm import", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Imported, with rows to review",
      exact: true,
    }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download all problem rows" }).click();
  expect((await download).suggestedFilename()).toBe(
    "mtg-manager-unresolved-rows.json",
  );
  await returnToBinder(page);
  await page.reload();
  await expect(page.locator(".card-tile")).toHaveCount(1);
  dialog = await open(page);
  await expect(
    dialog.getByRole("heading", { name: "Saved rows to review · 1" }),
  ).toBeVisible();
  await dialog.getByText("Original row", { exact: true }).click();
  await expect(dialog.locator("pre")).toContainText("7.25");
});

test("malformed CSV and cancel leave saved collection untouched; duplicates combine visibly", async ({
  page,
}) => {
  await start(page);
  let dialog = await open(page);
  await page.locator("input[type=file]").setInputFiles({
    name: "broken.csv",
    mimeType: "text/csv",
    buffer: Buffer.from('Name,Quantity\n"unclosed,2'),
  });
  await expect(dialog.getByRole("alert")).toContainText("Malformed CSV");
  await expect(
    dialog.getByRole("button", { name: "Confirm import" }),
  ).toHaveCount(0);
  await upload(page, exportCsv([solRow(1), solRow(2)]));
  await expect(stat(dialog, "Combined duplicate rows")).toHaveText("1");
  await expect(dialog.locator(".import-quantity")).toHaveText("3");
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.locator(".card-tile")).toHaveCount(32);
  dialog = await open(page);
  await upload(page, exportCsv([solRow(1), solRow(2)]));
  await confirm(page);
  await returnToBinder(page);
  await expect(page.locator(".quantity")).toHaveText("3");
});

test("Scryfall enrichment happens during preview, caches metadata and does not refetch on browsing", async ({
  page,
}) => {
  let calls = 0;
  await page.route("https://cards.scryfall.io/**", (route) => route.abort());
  await page.route(
    "https://api.scryfall.com/cards/collection",
    async (route) => {
      calls++;
      const body = route.request().postDataJSON() as {
        identifiers: { id: string }[];
      };
      expect(body.identifiers).toEqual([{ id: opt.id }]);
      await route.fulfill({
        headers: { "Access-Control-Allow-Origin": "*" },
        json: { data: [opt], not_found: [] },
      });
    },
  );
  await start(page);
  await open(page);
  const csv = exportCsv([
    { Name: opt.name, "Scryfall ID": opt.id, Quantity: 1 },
  ]);
  await upload(page, csv);
  await confirm(page);
  await returnToBinder(page);
  await expect(
    page.getByRole("button", { name: "View Opt", exact: true }),
  ).toBeVisible();
  expect(calls).toBe(1);
  await page.reload();
  await expect(page.locator(".card-tile")).toHaveCount(1);
  await open(page);
  await upload(page, csv);
  await expect(stat(page.getByRole("dialog"), "Unchanged records")).toHaveText(
    "1",
  );
  expect(calls).toBe(1);
});

test("large export is parsed off the main thread, previewed and saved without per-row requests", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const apiCalls: string[] = [];
  page.on("request", (r) => {
    if (r.url().startsWith("https://api.scryfall.com")) apiCalls.push(r.url());
  });
  await start(page);
  const dialog = await open(page);
  await upload(
    page,
    exportCsv(Array.from({ length: 5000 }, () => solRow(1))),
    "large.csv",
  );
  await expect(stat(dialog, "Recognized rows")).toHaveText("5,000");
  await expect(stat(dialog, "Combined duplicate rows")).toHaveText("4,999");
  await confirm(page);
  await returnToBinder(page);
  await page.reload();
  await expect(page.locator(".card-tile")).toHaveCount(1);
  await expect(page.locator(".quantity")).toHaveText("5000");
  expect(apiCalls).toEqual([]);
});

test("storage failure leaves the old collection intact and allows a safe retry", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.put;
    let fail = true;
    IDBObjectStore.prototype.put = function (
      value: unknown,
      key?: IDBValidKey,
    ) {
      if (key === "collection" && fail) {
        fail = false;
        throw new DOMException("Simulated storage full", "QuotaExceededError");
      }
      return original.call(this, value, key!);
    };
  });
  await start(page);
  const dialog = await open(page);
  await upload(page, exportCsv([solRow(1)]));
  await dialog
    .getByRole("button", { name: "Confirm import", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "No collection changes were saved",
  );
  await expect(
    dialog.getByText("REVIEW BEFORE SAVING", { exact: true }),
  ).toBeVisible();
  await confirm(page);
  await returnToBinder(page);
  await expect(page.locator(".card-tile")).toHaveCount(1);
});

test("import upload, preview and success fit the frozen shell and meet accessibility baseline", async ({
  page,
}, info) => {
  await start(page);
  await open(page);
  let dialog = page.getByRole("dialog");
  for (const phase of ["upload", "preview", "success"]) {
    if (phase === "preview") await upload(page, exportCsv([solRow()]));
    if (phase === "success") await confirm(page);
    dialog = page.getByRole("dialog");
    await expect(dialog).toHaveCSS("opacity", "1");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const violations = (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations;
    expect(
      violations,
      JSON.stringify(
        violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.failureSummary),
        })),
      ),
    ).toEqual([]);
    await page.screenshot({ path: info.outputPath(`import-${phase}.png`) });
  }
});

test("large distinct inventories render progressively while search covers the full collection", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await start(page);
  await open(page);
  await upload(
    page,
    exportCsv(
      Array.from({ length: 1000 }, (_, i) =>
        fixtureRow(i % 2 ? sol : meren, 1, { "Binder Name": `Location ${i}` }),
      ),
    ),
  );
  await confirm(page);
  await returnToBinder(page);
  await expect(page.locator(".card-tile")).toHaveCount(120);
  await expect(page.locator(".results-line strong")).toHaveText("1000");
  await page
    .getByRole("button", { name: "Show more cards", exact: true })
    .click();
  await expect(page.locator(".card-tile")).toHaveCount(240);
  await page.getByRole("searchbox").fill("Sol Ring");
  await expect(page.locator(".results-line strong")).toHaveText("500");
  await expect(page.locator(".card-tile")).toHaveCount(120);
  await expect(page.locator(".tile-title").first()).toHaveText("Sol Ring");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("a problematic duplicate group cannot silently shrink a saved holding", async ({
  page,
}) => {
  await start(page);
  await open(page);
  await upload(page, exportCsv([solRow(6)]));
  await confirm(page);
  await returnToBinder(page);
  const dialog = await open(page);
  await upload(page, exportCsv([solRow(2), solRow(1, { Quantity: "broken" })]));
  await expect(stat(dialog, "Recognized rows")).toHaveText("0");
  await expect(stat(dialog, "Problem rows")).toHaveText("2");
  await expect(
    dialog.getByText(
      "1 printing/variant group(s) left unchanged to avoid saving an incomplete quantity.",
    ),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Save problem rows" }).click();
  await expect(
    dialog.getByRole("heading", {
      name: "Imported, with rows to review",
      exact: true,
    }),
  ).toBeVisible();
  await returnToBinder(page);
  await page.reload();
  await expect(page.locator(".quantity")).toHaveText("6");
});
