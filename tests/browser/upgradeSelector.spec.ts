import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { kwainFixture } from "../kwainFixture";
import { seed, readState } from "./workspaceHelpers";

// Scryfall release/rank for the saved Kwain deck, served by a mocked same-origin lookup (no live network).
const raw = JSON.parse(readFileSync(new URL("../data/kwain-group-hug.json", import.meta.url), "utf8")) as { id: string; released_at?: string; edhrec_rank?: number }[];

test("Find Upgrades shows theme, swaps and a niche gem without changing the deck", async ({ page }) => {
  const f = kwainFixture();
  let lookups = 0;
  await page.route("**/api/scryfall/cards/collection", async (route) => {
    lookups++;
    const ids = (route.request().postDataJSON() as { identifiers: { id: string }[] }).identifiers.map((i) => i.id);
    const data = raw.filter((c) => ids.includes(c.id)).map((c) => ({ id: c.id, released_at: c.released_at, edhrec_rank: c.edhrec_rank }));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ object: "list", data }) });
  });
  await seed(page, f.state, f.deck.name);
  const before = await readState(page);

  const selector = page.getByRole("region", { name: "Upgrade Selector", exact: true });
  await expect(selector).toBeVisible();
  await selector.getByRole("button", { name: "Find Upgrades", exact: true }).click();
  await expect(selector.getByRole("heading", { name: "Theme", exact: true })).toBeVisible();
  await expect(selector).toContainText("The engine is");
  await expect(selector.getByRole("heading", { name: "Suggested one-for-one swaps", exact: true })).toBeVisible();
  await expect(selector.getByRole("heading", { name: "Niche gem", exact: true })).toBeVisible();
  await expect(selector).toContainText("AI review");
  await expect(selector).toContainText("Not configured");
  expect(lookups).toBeGreaterThan(0);

  // Read-only: the saved deck and collection are byte-for-byte the same JSON after the scan.
  expect(JSON.stringify(await readState(page))).toBe(JSON.stringify(before));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).include(".upgrade-selector").analyze()).violations).toEqual([]);
});
