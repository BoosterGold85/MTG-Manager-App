import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { dnaFixture } from "../dnaFixtures";
import { milesCards } from "../milesFixture";
import { oracleCard } from "../upgradeCandidates";
import { writeState } from "./workspaceHelpers";

// A Commander whose trigger the engine can't classify, plus cards it doesn't track and one with no saved rules text.
function uncertainDeck() {
  const clash = oracleCard("Clash Captain", "{2}{W}{U}", 4, "Legendary Creature — Human Soldier", "Whenever you win a clash, draw a card.", ["W", "U"]);
  const odd = ["Odd One", "Odd Two", "Odd Three", "Odd Four", "Odd Five"].map((n) =>
    oracleCard(n, "{2}{W}", 3, "Enchantment", "At the beginning of each upkeep, each player chooses a number. Reveal those numbers simultaneously.", ["W"]),
  );
  const main = milesCards.filter((c) => c.name !== 'Miles "Tails" Prower' && c.name !== "Parhelion II");
  const blank = { ...milesCards.find((c) => c.name === "Parhelion II")!, oracleText: "", cardFaces: undefined };
  const f = dnaFixture(clash, [...main.slice(0, main.length - odd.length), ...odd, blank]);
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
  await expect(callout).toContainText("Odd One");
  await expect(callout).toContainText("Parhelion II");
  const order = await page.locator(".deck-overview > section").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  expect(order.indexOf("Analysis confidence")).toBe(order.indexOf("Deck Health") - 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
