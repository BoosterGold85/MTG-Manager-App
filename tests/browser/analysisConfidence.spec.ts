import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { dnaFixture } from "../dnaFixtures";
import { milesCards } from "../milesFixture";
import { oracleCard } from "../upgradeCandidates";
import { writeState } from "./workspaceHelpers";
import { observed } from "../semanticFixture";
import { uugguuFixture } from "../uugguuFixture";
import { hurskaFixture } from "../hurskaFixture";

// A Commander whose trigger the engine can't classify, cards using an unmodeled mechanic, a partially understood card,
// a card whose record is missing its rules text, and a valid vanilla creature (which must not be flagged).
function uncertainDeck() {
  const clash = oracleCard("Clash Captain", "{2}{W}{U}", 4, "Legendary Creature — Human Soldier", "Whenever you win a clash, draw a card.", ["W", "U"]);
  const odd = ["Odd One", "Odd Two", "Odd Three", "Odd Four", "Odd Five"].map((n) =>
    oracleCard(n, "{2}{W}", 3, "Enchantment", "At the beginning of each upkeep, each player chooses a number. Reveal those numbers simultaneously.", ["W"]),
  );
  const main = milesCards.filter((c) => c.name !== 'Miles "Tails" Prower' && c.name !== "Parhelion II");
  const blank = { ...milesCards.find((c) => c.name === "Parhelion II")!, oracleText: undefined, cardFaces: undefined };
  const f = dnaFixture(clash, [...main.slice(0, main.length - odd.length - 2), ...odd, blank, observed("Walking Corpse"), observed("Delina, Wild Mage")]);
  f.state.revision = 1;
  f.deck.name = "Clash Deck";
  return f;
}
test("Overview says what the app isn't sure about, before Deck Health", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".card-tile")).toHaveCount(32);
  await writeState(page, uncertainDeck().state);
  await page.reload();
  await page.getByRole("navigation").filter({ visible: true }).getByRole("button", { name: "Decks", exact: true }).click();
  await page.locator(".deck-card").click();
  const callout = page.getByRole("region", { name: "Analysis confidence", exact: true });
  await expect(callout).toBeVisible();
  await expect(callout.getByRole("heading")).toHaveText("The app isn't sure how this deck works");
  await expect(callout).toContainText("Clash Captain");
  await expect(callout).toContainText("win a clash");
  await expect(callout).toContainText(/5 cards use mechanics the app doesn't model yet/);
  await expect(callout).toContainText("Odd One");
  await expect(callout).toContainText(/\d+ cards? ha(?:s|ve) effects the app only partially understands\. Recognized effects still count/);
  await expect(callout).toContainText("Delina, Wild Mage");
  await expect(callout).toContainText(/1 card could not be matched to canonical card data/);
  await expect(callout).toContainText("Parhelion II");
  // A vanilla creature's empty rules text is valid data, not a missing record.
  await expect(callout).not.toContainText("Walking Corpse");
  await expect(callout).not.toContainText("don't count");
  const order = await page.locator(".deck-overview > section").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  expect(order.indexOf("Analysis confidence")).toBe(order.indexOf("Deck Health") - 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("the supplied Uugguu deck has no missing-data or unsupported-ability warning", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".card-tile")).toHaveCount(32);
  await writeState(page, uugguuFixture().state);
  await page.reload();
  await page.getByRole("navigation").filter({ visible: true }).getByRole("button", { name: "Decks", exact: true }).click();
  await page.locator(".deck-card").click();
  const overview = page.locator(".deck-overview");
  await expect(overview).toBeVisible();
  await expect(page.getByRole("region", { name: "Deck Health", exact: true })).toBeVisible();
  await expect(overview).not.toContainText("partially understands");
  await expect(overview).not.toContainText("uses a mechanic the app doesn't model yet");
  await expect(overview).not.toContainText("use mechanics the app doesn't model yet");
  await expect(overview).not.toContainText("could not be matched to canonical card data");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("the supplied Hurska deck recognizes its Food and life-gain abilities", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".card-tile")).toHaveCount(32);
  await writeState(page, hurskaFixture().state);
  await page.reload();
  await page.getByRole("navigation").filter({ visible: true }).getByRole("button", { name: "Decks", exact: true }).click();
  await page.locator(".deck-card").click();
  const overview = page.locator(".deck-overview");
  await expect(overview).toBeVisible();
  await expect(page.getByRole("region", { name: "Deck Health", exact: true })).toBeVisible();
  await expect(overview).not.toContainText("partially understands");
  await expect(overview).not.toContainText("mechanics the app doesn't model yet");
  await expect(overview).not.toContainText("uses a mechanic the app doesn't model yet");
  await expect(overview).not.toContainText("could not be matched to canonical card data");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
