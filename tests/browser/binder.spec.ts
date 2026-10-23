import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
async function ready(page: Page) {
  await page.goto("/");
  await expect(page.locator(".card-tile")).toHaveCount(32);
}
async function openFilters(page: Page) {
  await page.getByRole("button", { name: /^Filters/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
test("renders real artwork, correct density, no overflow, and clear navigation", async ({
  page,
}, info) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1:4173")) external.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await ready(page);
  const first = page.locator(".card-tile img").first();
  await expect(first).toBeVisible();
  await expect
    .poll(() => first.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(100);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const columns = await page
    .locator(".card-grid")
    .evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
    );
  expect(columns).toBe(
    info.project.name.startsWith("mobile")
      ? 2
      : info.project.name === "tablet"
        ? 4
        : 6,
  );
  await expect(first).toHaveCSS("opacity", "1");
  await page.screenshot({ path: info.outputPath("collection.png") });
  await page.locator(".card-tile").last().scrollIntoViewIfNeeded();
  const rect = await page.locator(".card-tile").last().boundingBox();
  const nav = (await page.locator(".bottom-nav").isVisible())
    ? await page.locator(".bottom-nav").boundingBox()
    : null;
  if (nav && rect) expect(rect.y + rect.height).toBeLessThanOrEqual(nav.y);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
test("searches exact, partial and case-insensitive names; clears and resets no-results", async ({
  page,
}) => {
  await ready(page);
  const search = page.getByRole("searchbox");
  await search.fill("Sol Ring");
  await expect(page.locator(".card-tile")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "View Sol Ring" }),
  ).toBeVisible();
  await search.fill("  sOL rI  ");
  await expect(page.locator(".card-tile")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(page.locator(".card-tile")).toHaveCount(32);
  await search.fill("this is not a magic card");
  await expect(
    page.getByRole("heading", { name: "No cards found" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset search & filters" }).click();
  await expect(search).toHaveValue("");
  await expect(page.locator(".card-tile")).toHaveCount(32);
});
test("combines quick color, type, search and sort; resets in one action", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Green", exact: true }).click();
  await page.getByRole("button", { name: "Creatures", exact: true }).click();
  await page.getByRole("searchbox").fill("scute");
  await page.getByLabel("Sort cards").selectOption("mana");
  await expect(page.locator(".card-tile")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "View Scute Swarm" }),
  ).toBeVisible();
  await expect(page.locator(".active-filter-label")).toHaveText(
    "2 active filters",
  );
  await page.getByRole("button", { name: "Reset all", exact: true }).click();
  await expect(page.locator(".card-tile")).toHaveCount(32);
  await page.getByRole("button", { name: "Red", exact: true }).click();
  await expect(page.locator(".card-tile")).toHaveCount(4);
});
test("drawer applies mana, rarity, set, foil and manually authored tag together", async ({
  page,
}) => {
  await ready(page);
  await openFilters(page);
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Minimum").fill("1");
  await dialog.getByLabel("Maximum").fill("1");
  await dialog.getByLabel("Rarity", { exact: true }).selectOption("rare");
  await dialog.getByLabel("Set", { exact: true }).selectOption("ktk");
  await dialog.getByLabel("Finish", { exact: true }).selectOption("foil");
  await dialog
    .getByLabel("Sample synergy tag", { exact: false })
    .selectOption("+1/+1 Counters");
  await page.screenshot({ path: test.info().outputPath("filters.png") });
  await dialog.getByRole("button", { name: "Apply · Show 1 cards" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".card-tile")).toHaveCount(1);
  await page.getByRole("button", { name: "View Hardened Scales" }).click();
  await expect(
    page.getByRole("heading", { name: "Hardened Scales", exact: true }),
  ).toBeVisible();
});
test("filter edits are cancelable and clear-all restores full collection", async ({
  page,
}) => {
  await ready(page);
  await openFilters(page);
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Blue", exact: true }).click();
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".card-tile")).toHaveCount(32);
  await page.getByRole("button", { name: "Blue", exact: true }).click();
  await openFilters(page);
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Clear all" }).click();
  await dialog.getByRole("button", { name: "Apply · Show 32 cards" }).click();
  await expect(page.locator(".card-tile")).toHaveCount(32);
});
test("sort control changes visible order for all supported sorts", async ({
  page,
}) => {
  await ready(page);
  const sort = page.getByLabel("Sort cards");
  await expect(page.locator(".tile-title").first()).toHaveText(
    "Adeline, Resplendent Cathar",
  );
  await sort.selectOption("mana");
  await expect(page.locator(".tile-title").first()).toHaveText("Command Tower");
  await sort.selectOption("color");
  await expect(page.locator(".tile-title").first()).toHaveText(
    "Adeline, Resplendent Cathar",
  );
  await sort.selectOption("set");
  await expect(page.locator(".tile-title").first()).toHaveText("Blood Artist");
});
test("details open first and last; explicit close, Escape, backdrop and browser back work", async ({
  page,
}, info) => {
  await ready(page);
  const first = page.locator(".card-tile").first();
  await first.click();
  let dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Adeline, Resplendent Cathar" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Close dialog" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("region", { name: "Card details" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Close dialog" }),
  ).toBeFocused();
  await expect(dialog.locator(".card-image img")).toBeVisible();
  await expect(dialog.locator(".card-image img")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: info.outputPath("detail.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(first).toBeFocused();
  await page.locator(".card-tile").last().click();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Zulaport Cutthroat" }),
  ).toBeVisible();
  await dialog.locator(".intelligence").scrollIntoViewIfNeeded();
  await expect(dialog.getByText("Manually curated sample tags")).toBeVisible();
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await expect(dialog).not.toBeVisible();
  await first.click();
  await page.goBack();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await first.click();
  await page.mouse.click(2, 2);
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("broken artwork has a graceful fallback and optional metadata stays readable", async ({
  page,
}) => {
  await page.route("**/cards/*", (route) => route.abort());
  await ready(page);
  await expect(page.locator(".image-fallback").first()).toBeVisible();
  await page.getByRole("button", { name: "View Forest", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".image-fallback")).toBeVisible();
  await dialog.locator(".intelligence").scrollIntoViewIfNeeded();
  await expect(dialog.getByText("No sample tags")).toBeVisible();
});
test("commanders remains a clearly marked future destination; binder state survives", async ({
  page,
}, info) => {
  await ready(page);
  await page.getByRole("searchbox").fill("Sol Ring");
  const nav = page.getByRole("navigation", {
    name: info.project.name.startsWith("mobile")
      ? "Mobile navigation"
      : "Main navigation",
  });
  await nav.getByRole("button", { name: "Commanders" }).click();
  await expect(
    page.getByText("Coming in a future release.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to your collection" }).click();
  await expect(page.locator(".card-tile")).toHaveCount(1);
});

test("loading skeletons transition into the binder and reduced motion is honored", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/*sampleCards*", async (route) => {
    await gate;
    await route.continue();
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("status", { name: "Loading collection" }),
    ).toBeVisible();
    await expect(page.locator(".skeleton-card")).toHaveCount(12);
    const animation = await page
      .locator(".skeleton-card > div")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(animation).toBe("none");
  } finally {
    release();
  }
  await expect(page.locator(".card-tile")).toHaveCount(32);
  await expect(
    page.getByRole("status", { name: "Loading collection" }),
  ).not.toBeVisible();
});

test("collection, filter drawer and card details meet automated accessibility baseline", async ({
  page,
}) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  await ready(page);
  for (const screen of ["collection", "filters", "detail"]) {
    if (screen === "filters") await openFilters(page);
    if (screen === "detail") {
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Close dialog" })
        .click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
      await page.locator(".card-tile").first().click();
    }
    if (screen !== "collection")
      await expect(page.getByRole("dialog")).toHaveCSS("opacity", "1");
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations,
      `${screen}: ${JSON.stringify(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => ({ target: n.target, message: n.failureSummary })) })))}`,
    ).toEqual([]);
  }
});
