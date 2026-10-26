import type { CardMetadata, CollectionState } from "../src/models/collection";
import type { Deck } from "../src/models/deck";
import { emptyCollection } from "../src/models/collection";
import { cardIdentity } from "../src/intelligence/tagger";
import { metadata, sol, meren } from "./importFixtures";
// Curated canonical-shaped semantic fixtures, not live Scryfall snapshots. Oracle excerpts
// isolate the tested interactions; no network, price data or external rankings are used.
let next = 0;
function card(
  name: string,
  typeLine: string,
  oracleText: string,
  keywords: string[] = [],
  manaValue = 4,
): CardMetadata {
  const index = ++next;
  return {
    name,
    typeLine,
    oracleText,
    keywords,
    manaValue,
    manaCost: "",
    colorIdentity: [],
    rarity: "rare",
    scryfallId: `55555555-0000-4000-8000-${String(index).padStart(12, "0")}`,
    oracleId: `dna:${name.toLowerCase()}`,
    setCode: "dna",
    collectorNumber: String(index),
    imageUrl: sol.imageUrl,
    thumbnailUrl: sol.thumbnailUrl,
  };
}
export const lathliss = card(
  "Lathliss, Dragon Queen",
  "Legendary Creature — Dragon",
  "Whenever another nontoken Dragon you control enters, create a 5/5 red Dragon creature token with flying.\n{1}{R}: Dragons you control get +1/+0 until end of turn.",
  ["Flying"],
  6,
);
lathliss.colorIdentity = ["R"];
export const dragons = [
  card(
    "Utvara Hellkite",
    "Creature — Dragon",
    "Whenever a Dragon you control attacks, create a 6/6 red Dragon creature token with flying.",
    ["Flying"],
    8,
  ),
  card(
    "Scourge of Valkas",
    "Creature — Dragon",
    "Whenever Scourge of Valkas or another Dragon you control enters, it deals X damage to any target, where X is the number of Dragons you control.",
    ["Flying"],
    5,
  ),
  card(
    "Dragonlord’s Servant",
    "Creature — Goblin Shaman",
    "Dragon spells you cast cost {1} less to cast.",
    [],
    2,
  ),
  card(
    "Dragonspeaker Shaman",
    "Creature — Human Barbarian Shaman",
    "Dragon spells you cast cost {2} less to cast.",
    [],
    3,
  ),
  card(
    "Dragon Broodmother",
    "Creature — Dragon",
    "At the beginning of each upkeep, create a 1/1 red and green Dragon creature token with flying.",
    ["Flying"],
    6,
  ),
  card(
    "Dragon Fodder",
    "Sorcery",
    "Create two 1/1 red Goblin creature tokens.",
    [],
    2,
  ),
  card(
    "Dragon Hatchling",
    "Creature — Dragon",
    "{R}: Dragon Hatchling gets +1/+0 until end of turn.",
    ["Flying"],
    2,
  ),
  metadata[sol.scryfallId],
  Object.values(metadata).find((c) => c.name === "Arcane Signet")!,
  Object.values(metadata).find((c) => c.name === "Cultivate")!,
];
export const atraxa = Object.values(metadata).find(
  (c) => c.name === "Atraxa, Praetors' Voice",
)!;
export const counters = [
  Object.values(metadata).find((c) => c.name === "Hardened Scales")!,
  card(
    "Corpsejack Menace",
    "Creature — Fungus",
    "If one or more +1/+1 counters would be put on a creature you control, twice that many +1/+1 counters are put on it instead.",
  ),
  card(
    "Evolution Sage",
    "Creature — Elf Druid",
    "Landfall — Whenever a land you control enters, proliferate.",
    [],
    3,
  ),
  card("Contentious Plan", "Sorcery", "Proliferate. Draw a card.", [], 2),
  card(
    "Deepglow Skate",
    "Creature — Fish",
    "When Deepglow Skate enters, double the number of each kind of counter on any number of target permanents.",
    [],
    5,
  ),
  card(
    "Incubation Druid",
    "Creature — Elf Druid",
    "{T}: Add one mana of any type that a land you control could produce.\n{3}{G}{G}: Adapt 3.",
    [],
    2,
  ),
  card(
    "Ironshell Beetle",
    "Creature — Insect",
    "When Ironshell Beetle enters, put a +1/+1 counter on target creature.",
    [],
    2,
  ),
  sol,
];
export const graveyard = [
  Object.values(metadata).find((c) => c.name === "Reanimate")!,
  Object.values(metadata).find((c) => c.name === "Victimize")!,
  card(
    "Stitcher’s Supplier",
    "Creature — Zombie",
    "When Stitcher’s Supplier enters or dies, you mill three cards.",
    [],
    1,
  ),
  card(
    "Mire Triton",
    "Creature — Zombie Merfolk",
    "When Mire Triton enters, you mill two cards and you gain 2 life.",
    [],
    2,
  ),
  card(
    "Eternal Witness",
    "Creature — Human Shaman",
    "When Eternal Witness enters, return target card from your graveyard to your hand.",
    [],
    3,
  ),
  card(
    "Dread Return",
    "Sorcery",
    "Return target creature card from your graveyard to the battlefield.",
    [],
    4,
  ),
  card(
    "Splinterfright",
    "Creature — Elemental",
    "Splinterfright’s power and toughness are each equal to the number of creature cards in your graveyard.\nAt the beginning of your upkeep, you mill two cards.",
    [],
    3,
  ),
  sol,
];
export const ghave = card(
  "Ghave, Guru of Spores",
  "Legendary Creature — Fungus Shaman",
  "Ghave enters with five +1/+1 counters on it.\n{1}, Remove a +1/+1 counter from a creature you control: Create a 1/1 green Saproling creature token.\n{1}, Sacrifice a creature: Put a +1/+1 counter on target creature.",
  [],
  5,
);
export const aristocrats = [
  Object.values(metadata).find((c) => c.name === "Blood Artist")!,
  Object.values(metadata).find((c) => c.name === "Zulaport Cutthroat")!,
  card(
    "Viscera Seer",
    "Creature — Vampire Wizard",
    "Sacrifice a creature: Scry 1.",
    [],
    1,
  ),
  card(
    "Woe Strider",
    "Creature — Horror",
    "When Woe Strider enters, create a 0/1 white Goat creature token.\nSacrifice another creature: Scry 1.",
    [],
    3,
  ),
  card(
    "Ophiomancer",
    "Creature — Human Shaman",
    "At the beginning of each upkeep, if you control no Snakes, create a 1/1 black Snake creature token with deathtouch.",
    [],
    3,
  ),
  card(
    "Bastion of Remembrance",
    "Enchantment",
    "When Bastion of Remembrance enters, create a 1/1 white Human Soldier creature token.\nWhenever a creature you control dies, each opponent loses 1 life and you gain 1 life.",
    [],
    3,
  ),
  card(
    "Reassembling Skeleton",
    "Creature — Skeleton Warrior",
    "{1}{B}: Return Reassembling Skeleton from your graveyard to the battlefield tapped.",
    [],
    2,
  ),
  sol,
];
export const incidental = card(
  "Incidental Treasure",
  "Creature — Human",
  "When Incidental Treasure enters, create a Treasure token.",
  [],
  2,
);
export const plainCommander = card(
  "Quiet Commander",
  "Legendary Creature — Human",
  "",
  [],
  3,
);
export function dnaFixture(
  commander: CardMetadata = lathliss,
  main: CardMetadata[] = dragons,
): { state: CollectionState; deck: Deck } {
  const all = [commander, ...main];
  const state = {
    ...emptyCollection(),
    metadata: Object.fromEntries(all.map((c) => [c.scryfallId, c])),
  };
  const deck: Deck = {
    id: "dna-deck",
    name: "Regression Deck",
    createdAt: "2026-01-01T00:00:00Z",
    modifiedAt: "2026-01-01T00:00:00Z",
    commanders: [
      {
        scryfallId: commander.scryfallId,
        name: commander.name,
        colorIdentity: commander.colorIdentity,
        cardIdentity: cardIdentity(commander),
        entryId: "cmdr",
      },
    ],
    assignments: [],
    entries: all.map((c, i) => ({
      id: i ? "entry-" + i : "cmdr",
      board: i ? "main" : "commander",
      name: c.name,
      quantity: 1,
      scryfallId: c.scryfallId,
      cardIdentity: cardIdentity(c),
    })),
  };
  state.decks = [deck];
  return { state, deck };
}
export const regressionDecks = [
  { name: "Dragon Typal", commander: lathliss, main: dragons },
  { name: "Counters", commander: atraxa, main: counters },
  { name: "Graveyard", commander: meren, main: graveyard },
  { name: "Tokens / Aristocrats", commander: ghave, main: aristocrats },
];
