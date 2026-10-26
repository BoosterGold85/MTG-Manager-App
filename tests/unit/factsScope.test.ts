import { it, expect } from "vitest";
import { extractCardFacts, benefitsYou, scopeOf } from "../../src/synergy/facts";
import { candidates } from "../upgradeCandidates";
import { reignCards } from "../recommendationFixtures";
const facts = (c: Parameters<typeof extractCardFacts>[0]) => extractCardFacts(c);
const reign = (name: string) => reignCards.find((c) => c.name === name)!;

it("scope never turns 'any player' wording into you", () => {
  expect(scopeOf("Each player other than target player creates a 5/5 red Dragon creature token with flying.")).toBe("other_players");
  expect(scopeOf("Each opponent creates a 1/1 token.")).toBe("each_opponent");
  expect(scopeOf("Target player draws two cards.")).toBe("target_player");
  expect(scopeOf("Each player draws a card.")).toBe("each_player");
  expect(scopeOf("Create a Treasure token.")).toBe("you");
  expect(scopeOf("Destroy target creature.")).toBe("you");
  const dragons = facts(candidates.deathByDragons).faces[0].createsTokens[0];
  expect(dragons.controller).toBe("other_players");
  expect(benefitsYou(dragons.controller)).toBe(false);
});
it("token multipliers are scoped: Xorn multiplies Treasure only, Doubling Season every token", () => {
  const xorn = facts(candidates.xorn);
  expect(xorn.typedRoles).toContain("scoped_token_multiplier");
  expect(xorn.typedRoles).not.toContain("token_doubler");
  expect(xorn.faces[0].tokenMultipliers[0].scopes).toEqual(["Treasure"]);
  const season = facts(candidates.doublingSeason);
  expect(season.typedRoles).toContain("token_doubler");
  expect(season.faces[0].tokenMultipliers[0].scopes).toEqual(["any"]);
});
it("damage sources and multipliers are typed by combat scope", () => {
  const fiery = facts(candidates.fieryEmancipation);
  expect(fiery.faces[0].damage[0]).toMatchObject({ role: "multiplier", combat: "any", controller: "you" });
  expect(fiery.typedRoles).toEqual(expect.arrayContaining(["damage_multiplier", "combat_damage_multiplier", "noncombat_damage_multiplier"]));
  const tempest = facts(reign("Dragon Tempest"));
  expect(tempest.typedRoles).toEqual(expect.arrayContaining(["damage_source", "triggered_damage", "noncombat_damage"]));
  expect(facts(reign("Lightning Bolt")).typedRoles).toContain("damage_source");
  expect(facts(reign("Lightning Bolt")).typedRoles).not.toContain("triggered_damage");
});
it("extra combats, attack triggers and double strike are typed", () => {
  expect(facts(candidates.savageBeating).typedRoles).toEqual(expect.arrayContaining(["additional_combat", "combat_multiplier"]));
  expect(facts(candidates.combatCelebrant).typedRoles).toContain("additional_combat");
  expect(facts(reign("Utvara Hellkite")).typedRoles).toEqual(expect.arrayContaining(["attack_trigger", "on_attack_token_generation"]));
});
it("removal is recorded as specific answer coverage", () => {
  const blast = facts(candidates.vandalblast).faces[0].answers[0];
  expect(blast).toMatchObject({ targets: ["artifact"], mode: "destroy", mass: true, opponentsOnly: true, instantSpeed: false });
  const warp = facts(reign("Chaos Warp")).faces[0].answers[0];
  expect(warp).toMatchObject({ mode: "shuffle", instantSpeed: true });
  expect(warp.targets).toContain("permanent");
  expect(facts(reign("Lightning Bolt")).faces[0].answers[0]).toMatchObject({ mode: "damage", targets: ["creature", "planeswalker"], instantSpeed: true });
  expect(facts(reign("Blasphemous Act")).faces[0].answers[0]).toMatchObject({ mass: true, targets: ["creature"] });
});
