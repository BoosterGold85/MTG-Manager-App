import { expect, it } from "vitest";
import { extractCardFacts, hasCreatureType } from "../../src/synergy/facts";
import { scoringCard } from "../scoringFixtures";
import { canonicalFactsCards } from "../recommendationFixtures";
it("canonical Wayfinder is a Changeling, searches a basic land to hand, and is not an unrestricted tutor or land ramp", () => {
  const facts = extractCardFacts(canonicalFactsCards[0]);
  expect(facts.typedRoles).toContain("basic_land_to_hand");
  expect(facts.typedRoles).toContain("land_smoothing");
  expect(facts.typedRoles).not.toContain("unrestricted_tutor");
  expect(facts.typedRoles).not.toContain("land_ramp");
  expect(facts.faces[0].searchesLibrary[0]).toMatchObject({
    basicOnly: true,
    destination: "hand",
    unrestricted: false,
  });
  expect(hasCreatureType(facts.faces[0], "Dragon")).toBe(true);
  expect(hasCreatureType(facts.faces[0], "ImaginaryType")).toBe(false);
});
it("canonical Fire Nation creates two Soldiers; firebending is token-scoped combat mana, not a ritual or Dragon token", () => {
  const facts = extractCardFacts(canonicalFactsCards[1]),
    face = facts.faces[0];
  expect(face.createsTokens).toHaveLength(1);
  expect(face.createsTokens[0]).toMatchObject({
    count: 2,
    creatureTypes: ["Soldier"],
    grantedAbilities: ["firebending 1"],
  });
  expect(face.addsMana).toHaveLength(1);
  expect(face.addsMana[0]).toMatchObject({
    scope: "created-token",
    timing: "triggered",
    amount: 1,
  });
  expect(facts.typedRoles).toContain("soldier_token");
  expect(facts.typedRoles).not.toContain("dragon_token");
  expect(facts.typedRoles).not.toContain("ritual");
  expect(hasCreatureType(face, "Dragon")).toBe(false);
});
for (const [target, destination, expected] of [
  ["a card", "into your hand", "unrestricted_tutor"],
  ["a creature card", "into your hand", "creature_tutor"],
  ["a Dragon card", "into your hand", "dragon_tutor"],
  ["an Elf card", "into your hand", "tribal_tutor"],
  ["an artifact card", "onto the battlefield", "artifact_tutor"],
  ["an enchantment card", "into your hand", "enchantment_tutor"],
  ["a land card", "into your hand", "land_tutor_to_hand"],
  ["a land card", "onto the battlefield", "land_tutor_to_battlefield"],
  [
    "a basic land card",
    "onto the battlefield tapped",
    "basic_land_to_battlefield",
  ],
  ["a card", "into your graveyard", "graveyard_tutor"],
  ["a card", "on top of your library", "topdeck_tutor"],
] as const)
  it(`classifies ${target} → ${destination} as ${expected}`, () => {
    const facts = extractCardFacts(
      scoringCard(
        "Search Fixture",
        "Sorcery",
        `Search your library for ${target}, put it ${destination}, then shuffle.`,
      ),
    );
    expect(facts.typedRoles).toContain(expected);
    if (target !== "a card")
      expect(facts.typedRoles).not.toContain("unrestricted_tutor");
  });
for (const [type, text, role] of [
  ["Artifact", "{T}: Add {R}.", "mana_rock"],
  ["Creature — Elf", "{T}: Add {G}.", "mana_dork"],
  ["Instant", "Add {R}{R}{R}.", "ritual"],
  [
    "Enchantment",
    "At the beginning of your combat, add {R}.",
    "temporary_combat_mana",
  ],
  ["Artifact", "Spells you cast cost {1} less to cast.", "cost_reduction"],
  [
    "Creature — Goblin",
    "Dragon spells you cast cost {1} less to cast.",
    "tribal_cost_reduction",
  ],
  ["Sorcery", "Create a Treasure token.", "treasure_generation"],
] as const)
  it(`classifies typed mana effect ${role}`, () => {
    expect(
      extractCardFacts(scoringCard("Mana Fixture", type, text)).typedRoles,
    ).toContain(role);
  });
for (const [text, role] of [
  [
    "Whenever another Dragon enters under your control, draw a card.",
    "tribal_etb_payoff",
  ],
  ["Whenever you cast a Dragon spell, draw a card.", "tribal_cast_payoff"],
  [
    "Whenever a Dragon you control attacks, draw a card.",
    "tribal_attack_payoff",
  ],
  ["Whenever a Dragon you control dies, draw a card.", "tribal_death_payoff"],
  [
    "Whenever a Dragon token enters under your control, draw a card.",
    "tribal_token_payoff",
  ],
  ["Other Dragon creatures you control get +1/+1.", "tribal_lord"],
  [
    "Return target Dragon card from your graveyard to your hand.",
    "tribal_recursion",
  ],
] as const)
  it(`records actual tribal effect ${role}`, () => {
    const facts = extractCardFacts(
      scoringCard("Tribal Fixture", "Enchantment", text),
    );
    expect(facts.typedRoles).toContain(role);
    expect(
      facts.faces[0].tribalEffects.some(
        (e) => e.creatureTypes.includes("Dragon") && e.text === text,
      ),
    ).toBe(true);
  });
it("does not mistake self names or isolated tags for tribal effects", () => {
  const card = scoringCard(
    "Dragon Egg",
    "Creature — Dragon",
    "When Dragon Egg dies, create a 2/2 red Dragon creature token with flying.",
  );
  const facts = extractCardFacts(card);
  expect(facts.typedRoles).toContain("dragon_token");
  expect(facts.typedRoles).not.toContain("tribal_death_payoff");
  expect(
    extractCardFacts({ ...card, oracleText: "", keywords: [] }).typedRoles,
  ).toEqual(["dragon"]);
});
it("preserves face boundaries, unknown colors, uncertain searches and does not mutate metadata", () => {
  const card = scoringCard("Two Faces", "Creature", "");
  card.cardFaces = [
    { name: "Front", typeLine: "Creature — Dragon", oracleText: "Flying" },
    {
      name: "Back",
      typeLine: "Sorcery",
      oracleText:
        "Search your library for a card with mana value 2, reveal it.",
    },
  ];
  const before = JSON.stringify(card),
    facts = extractCardFacts(card);
  expect(facts.colors).toBeUndefined();
  expect(facts.faces[0].searchesLibrary).toEqual([]);
  expect(facts.faces[1].searchesLibrary[0].unrestricted).toBe(false);
  expect(facts.uncertainties.join(" ")).toContain(
    "Unresolved library-search destination",
  );
  expect(JSON.stringify(card)).toBe(before);
});
