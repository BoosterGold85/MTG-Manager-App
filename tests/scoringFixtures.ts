import raw from "./data/scoring-cards.scryfall.json" with { type: "json" };
import type { CardMetadata } from "../src/models/collection";
import { dnaFixture, dragons, lathliss } from "./dnaFixtures";
import { sol } from "./importFixtures";
export function scoringCard(
  name: string,
  typeLine: string,
  oracleText: string,
  manaValue = 3,
  keywords: string[] = [],
): CardMetadata {
  return {
    name,
    typeLine,
    oracleText,
    manaValue,
    keywords,
    scryfallId: `scoring:${name}`,
    oracleId: `scoring:${name}`,
    colorIdentity: /Legendary/.test(typeLine) ? ["W", "U", "B", "R", "G"] : [],
    imageUrl: sol.imageUrl,
    thumbnailUrl: sol.thumbnailUrl,
    setCode: "tst",
    collectorNumber: name,
    manaCost: "",
    rarity: "rare",
  };
}
export const canonicalScoringCards = raw.map((c) => ({
  ...scoringCard(c.name, c.type_line, c.oracle_text, c.cmc, c.keywords),
  scryfallId: c.id,
  oracleId: c.oracle_id,
  manaCost: c.mana_cost,
  colorIdentity: c.color_identity as CardMetadata["colorIdentity"],
  ...("power" in c ? { power: c.power, toughness: c.toughness } : {}),
}));
export const namedScoringCard = (name: string) =>
  canonicalScoringCards.find((c) => c.name === name)!;
export const genericValue = namedScoringCard("Alania's Pathmaker");
export function dragonScoringFixture() {
  const main = [
    ...dragons.filter((c) => c.name !== "Utvara Hellkite"),
    namedScoringCard("Dragon Tempest"),
    ...Array.from({ length: 4 }, (_, i) =>
      scoringCard(
        `Sky Dragon ${i}`,
        "Creature — Dragon",
        "Flying",
        4 + (i % 3),
        ["Flying"],
      ),
    ),
  ];
  return dnaFixture(lathliss, main);
}
function copies(prefix: string, type: string, text: string, count = 9) {
  return Array.from({ length: count }, (_, i) =>
    scoringCard(`${prefix} ${i}`, type, text, 1 + (i % 5)),
  );
}
export const archetypeCases = [
  {
    name: "Dragon typal",
    fixture: dragonScoringFixture,
    support: namedScoringCard("Dragon Tempest"),
    weak: genericValue,
    primary: "typal:Dragon",
  },
  {
    name: "Spellslinger",
    fixture: () =>
      dnaFixture(
        scoringCard(
          "Spell Commander",
          "Legendary Creature — Human Wizard",
          "Whenever you cast an instant or sorcery spell, draw a card.",
        ),
        copies("Study", "Instant", "Draw a card."),
      ),
    support: scoringCard("Focused Study", "Instant", "Draw two cards.", 2),
    weak: scoringCard("Off-plan Fighter", "Creature — Warrior", "Flying", 6, [
      "Flying",
    ]),
    primary: "spells",
  },
  {
    name: "Aristocrats",
    fixture: () =>
      dnaFixture(
        scoringCard(
          "Death Commander",
          "Legendary Creature — Vampire",
          "Whenever another creature you control dies, each opponent loses 1 life and you gain 1 life.",
        ),
        [
          ...copies(
            "Fodder",
            "Creature — Skeleton",
            "When this creature dies, create a 1/1 Skeleton creature token.",
            6,
          ),
          ...copies(
            "Outlet",
            "Creature — Human",
            "Sacrifice a creature: Scry 1.",
            3,
          ),
        ],
      ),
    support: scoringCard(
      "Free Sacrifice Outlet",
      "Creature — Vampire",
      "Sacrifice a creature: Draw a card.",
      2,
    ),
    weak: scoringCard("Unrelated Giant", "Creature — Giant", "Vigilance", 6, [
      "Vigilance",
    ]),
    primary: "sacrifice",
  },
  {
    name: "Landfall",
    fixture: () =>
      dnaFixture(
        scoringCard(
          "Land Commander",
          "Legendary Creature — Elemental",
          "Whenever a land you control enters, create a 2/2 green Beast creature token.",
        ),
        [
          ...copies("Land", "Land — Forest", "{T}: Add {G}.", 18),
          ...copies(
            "Landfall Value",
            "Creature — Elemental",
            "Landfall — Whenever a land you control enters, draw a card.",
            6,
          ),
        ],
      ),
    support: scoringCard(
      "Additional Land Engine",
      "Enchantment",
      "You may play an additional land on each of your turns.",
      2,
    ),
    weak: genericValue,
    primary: "lands",
  },
  {
    name: "Voltron",
    fixture: () =>
      dnaFixture(
        scoringCard(
          "Equipment Commander",
          "Legendary Creature — Human Knight",
          "Whenever an Equipment you control enters, draw a card.",
        ),
        copies(
          "Equipment",
          "Artifact — Equipment",
          "Equipped creature gets +2/+2. Equip {2}.",
        ),
      ),
    support: scoringCard(
      "Haste Equipment",
      "Artifact — Equipment",
      "Equipped creature gets +2/+2 and has haste. Equip {1}.",
      2,
    ),
    weak: genericValue,
    primary: "voltron",
  },
  {
    name: "Artifact",
    fixture: () =>
      dnaFixture(
        scoringCard(
          "Artifact Commander",
          "Legendary Creature — Human Artificer",
          "Whenever you cast an artifact spell, create a Treasure token.",
        ),
        copies("Artifact", "Artifact", "{T}: Add {C}."),
      ),
    support: scoringCard(
      "Artifact Mana Engine",
      "Artifact",
      "{T}: Add {C}{C}.",
      2,
    ),
    weak: genericValue,
    primary: "artifacts",
  },
  {
    name: "Tokens",
    fixture: () =>
      dnaFixture(
        scoringCard(
          "Token Commander",
          "Legendary Creature — Elf",
          "Whenever one or more tokens you control enter, draw a card.",
        ),
        copies(
          "Token Maker",
          "Sorcery",
          "Create two 1/1 white Soldier creature tokens.",
        ),
      ),
    support: scoringCard(
      "Efficient Token Maker",
      "Sorcery",
      "Create three 1/1 white Soldier creature tokens.",
      2,
    ),
    weak: scoringCard("Plain Bear", "Creature — Bear", "", 2),
    primary: "tokens",
  },
  {
    name: "Graveyard / Reanimator",
    fixture: () =>
      dnaFixture(
        scoringCard(
          "Recursion Commander",
          "Legendary Creature — Human Shaman",
          "At the beginning of your end step, return target creature card from your graveyard to the battlefield.",
        ),
        [
          ...copies(
            "Self Mill",
            "Creature — Zombie",
            "When this creature enters, mill three cards.",
            6,
          ),
          ...copies(
            "Reanimation",
            "Sorcery",
            "Return target creature card from your graveyard to the battlefield.",
            3,
          ),
        ],
      ),
    support: scoringCard(
      "Cheap Reanimation",
      "Sorcery",
      "Return target creature card from your graveyard to the battlefield.",
      1,
    ),
    weak: scoringCard(
      "Graveyard Reset",
      "Artifact",
      "When this artifact enters, exile all cards from all graveyards.",
      2,
    ),
    primary: "graveyard",
  },
  {
    name: "+1/+1 Counters",
    fixture: () =>
      dnaFixture(
        scoringCard(
          "Counter Commander",
          "Legendary Creature — Phyrexian Angel",
          "At the beginning of your end step, proliferate.",
          4,
          ["Flying"],
        ),
        copies(
          "Counter Creature",
          "Creature — Human",
          "When this creature enters, put two +1/+1 counters on target creature.",
        ),
      ),
    support: scoringCard(
      "Counter Doubler",
      "Enchantment",
      "If one or more +1/+1 counters would be put on a creature you control, twice that many +1/+1 counters are put on it instead.",
      2,
    ),
    weak: genericValue,
    primary: "counters",
  },
  {
    name: "Generic Goodstuff",
    fixture: () =>
      dnaFixture(
        scoringCard(
          "Quiet Commander",
          "Legendary Creature — Human",
          "Vigilance",
          3,
          ["Vigilance"],
        ),
        [
          ...copies("Simple Body", "Creature — Human", "Vigilance", 8),
          ...copies("Draw Spell", "Sorcery", "Draw two cards.", 4),
          ...copies("Mana Piece", "Artifact", "{T}: Add {C}.", 4),
        ],
      ),
    support: scoringCard(
      "Flexible Protection",
      "Instant",
      "Choose one — Counter target spell; or target creature you control gains hexproof until end of turn. Draw a card.",
      1,
    ),
    weak: scoringCard("Overpriced Body", "Creature — Giant", "", 8),
    primary: "goodstuff",
  },
  {
    name: "Creature ETB / Blink",
    fixture: () =>
      dnaFixture(
        scoringCard(
          "Blink Commander",
          "Legendary Creature — Bird Wizard",
          "Whenever another creature you control enters, draw a card.\n{2}: Exile another target creature you control, then return it to the battlefield under your control.",
        ),
        copies(
          "ETB Value",
          "Creature — Human Wizard",
          "When this creature enters, draw a card.",
        ),
      ),
    support: genericValue,
    weak: scoringCard(
      "Generic Fight",
      "Instant",
      "Target creature gets +2/+0 until end of turn.",
      3,
    ),
    primary: "blink",
  },
];
