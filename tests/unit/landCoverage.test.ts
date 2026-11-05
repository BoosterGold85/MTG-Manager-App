import { describe, expect, it } from "vitest";
import raw from "../data/land-coverage.json";
import { oracleCard } from "../upgradeCandidates";
import { cardCoverage } from "../../src/upgrades/coverage";
import { cardFunction, deckCardFunction } from "../../src/upgrades/cardFunction";
import { SupplyIndex } from "../../src/upgrades/conditions";
import { hasCapability } from "../../src/synergy/semantics";

const cards = raw.map(c => oracleCard(c.name, c.mana_cost || "", c.cmc || 0, c.type_line, c.oracle_text, ["G"], {
  keywords: c.keywords, power: c.power ?? undefined, toughness: c.toughness ?? undefined,
}));
const card = (name: string) => cards.find(c => c.name === name)!;
const synthetic = (text: string, type = "Enchantment") => oracleCard(`Fixture ${text}`, "{2}{G}", 3, type, text, ["G"]);
const supply = (text: string, type: string, quantity: number) => new SupplyIndex([{ card: synthetic(text, type), quantity, commander: false }]);

describe("the thirteen land-deck coverage reports", () => {
  for (const c of cards) it(`${c.name}: recognizes the printed abilities under any name`, () => {
    for (const candidate of [c, { ...c, name: "Renamed Fixture", oracleId: `renamed:${c.name}`, oracleText: c.oracleText?.split(c.name).join("Renamed Fixture") }]) {
      expect(cardCoverage(candidate).abilities.filter(a => a.status === "unsupported")).toEqual([]);
      expect(cardCoverage(candidate).state).toBe("full");
    }
  });

  it("library land access is card access, not an extra land drop", () => {
    const c = synthetic("You may play lands from the top of your library.");
    expect(cardFunction(c).roles.cardAdvantage).toBeGreaterThan(0);
    expect(cardFunction(c).roles.ramp).toBeUndefined();
    expect(deckCardFunction(c, supply("", "Creature", 30)).roles.cardAdvantage).toBeUndefined();
    expect(deckCardFunction(c, supply("", "Land", 30)).roles.cardAdvantage).toBeGreaterThan(0);
    expect(hasCapability(synthetic("You may look at the top card of your library any time."), "TOP_LIBRARY_LANDS")).toBe(false);
  });

  it("fixing is distinct from ramp and does not apply to opponents' lands", () => {
    expect(cardFunction(card("Dryad of the Ilysian Grove")).roles.ramp).toBeGreaterThan(0);
    const fixing = synthetic("Lands you control are every basic land type in addition to their other types.");
    expect(cardFunction(fixing).roles.ramp).toBeUndefined();
    expect(hasCapability(synthetic("Lands your opponents control are every basic land type in addition to their other types."), "LAND_TYPE_FIXING")).toBe(false);
  });

  it("regeneration counts as limited protection, not recursion or indestructibility", () => {
    const fn = cardFunction(synthetic("{1}{G}: Regenerate target creature."));
    expect(fn.roles.protection).toBeGreaterThan(0);
    expect(fn.roles.recursion).toBeUndefined();
    expect(fn.impactReasons.join(" ")).toContain("does not stop exile");
    expect(hasCapability(synthetic("Target creature can't be regenerated."), "REGENERATE")).toBe(false);
  });

  it("land animation does not create tokens or add land drops", () => {
    const fn = cardFunction(card("Lair of the Hydra"));
    expect(fn.roles.finishers).toBeGreaterThan(0);
    expect(fn.roles.tokens).toBeUndefined();
    expect(fn.roles.ramp).toBeUndefined();
  });

  it("hand cheats require creatures and do not count as casting or drawing them", () => {
    const c = synthetic("Put up to two creature cards from your hand onto the battlefield.", "Sorcery");
    expect(cardFunction(c).roles.cardAdvantage).toBeUndefined();
    expect(deckCardFunction(c, supply("", "Land", 30)).roles.ramp).toBeUndefined();
    expect(deckCardFunction(c, supply("", "Creature", 20)).roles.ramp).toBeGreaterThan(0);
    expect(hasCapability(synthetic("Return target creature card from your graveyard to your hand."), "HAND_CREATURE_CHEAT")).toBe(false);
  });

  it("keyword counters do not masquerade as +1/+1 counters", () => {
    const c = synthetic("Put a trample counter on target creature you control.");
    expect(hasCapability(c, "KEYWORD_COUNTER")).toBe(true);
    expect(hasCapability(synthetic("Put a +1/+1 counter on target creature you control."), "KEYWORD_COUNTER")).toBe(false);
  });

  it("retrace needs both nonland permanents and lands, and does not recur instants", () => {
    const c = synthetic("During your turn, nonland permanent cards in your graveyard have retrace.");
    expect(deckCardFunction(c, supply("", "Creature", 30)).roles.recursion).toBeUndefined();
    expect(deckCardFunction(c, supply("", "Land", 30)).roles.recursion).toBeUndefined();
    const enough = new SupplyIndex([
      { card: synthetic("", "Land"), quantity: 30, commander: false },
      { card: synthetic("", "Creature"), quantity: 20, commander: false },
    ]);
    expect(deckCardFunction(c, enough).roles.recursion).toBeGreaterThan(0);
    expect(hasCapability(synthetic("During your turn, instant cards in your graveyard have retrace."), "GRAVEYARD_RETRACE")).toBe(false);
  });

  it("toughness-entry supply excludes creatures with equal or lower toughness", () => {
    const c = card("Fecund Greenshell");
    const check = (power: string, toughness: string) => {
      const s = new SupplyIndex([{ card: { ...synthetic("", "Creature"), power, toughness }, quantity: 10, commander: false }]);
      return deckCardFunction(c, s).conditions!.find(x => x.key.startsWith("enters:"))!;
    };
    expect(check("2", "4").factor).toBe(1);
    expect(check("4", "4").factor).toBe(0);
    expect(check("5", "2").factor).toBe(0);
    expect(check("*", "4").factor).toBe(0);
  });

  it("late land thresholds and the city's blessing do not get immediate full credit", () => {
    const late = synthetic("As long as you control ten or more lands, creatures you control get +2/+2.");
    const always = synthetic("Creatures you control get +2/+2.");
    expect(cardFunction(late).roles.finishers).toBeLessThan(cardFunction(always).roles.finishers!);
    const restricted = card("Wayward Swordtooth");
    const free = { ...restricted, oracleText: restricted.oracleText!.split("\n").filter(l => !l.includes("can't attack or block")).join("\n") };
    expect(cardFunction(restricted).bodyScore).toBeLessThan(cardFunction(free).bodyScore);
  });
});
