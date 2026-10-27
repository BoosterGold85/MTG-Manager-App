// Presentation families aggregate existing tags; the universal taxonomy is unchanged.
export interface ThemeFamily {
  id: string;
  label: string;
  tags: string[];
  plan: string;
  support?: boolean;
}
export const families: ThemeFamily[] = [
  {
    id: "graveyard",
    label: "Graveyard",
    tags: [
      "graveyard",
      "reanimator",
      "recursion",
      "self-mill",
      "graveyard-payoff",
      "land-recursion",
      "discard-outlet",
    ],
    plan: "fill the graveyard and recover its resources",
  },
  {
    id: "counters",
    label: "Counters",
    tags: ["plus-counters", "minus-counters", "counter-payoff", "proliferate"],
    plan: "build and amplify counters",
  },
  {
    id: "tokens",
    label: "Tokens",
    tags: ["tokens", "token-payoff", "go-wide", "populate"],
    plan: "create and support a wide creature board",
  },
  {
    id: "sacrifice",
    label: "Sacrifice / Death Payoffs",
    tags: [
      "aristocrats",
      "sacrifice-payoff",
      "sacrifice-outlet",
      "sacrifice-fodder",
      "death-triggers",
      "drain",
    ],
    plan: "use sacrifice and creature-death effects",
  },
  {
    id: "ramp",
    label: "Ramp",
    tags: ["ramp", "mana-dork", "mana-rock", "mana-fixing", "cost-reduction"],
    plan: "develop mana to support the main strategy",
    support: true,
  },
  {
    id: "advantage",
    label: "Card Advantage",
    tags: ["card-draw", "impulse-draw", "looting", "tutor", "topdeck"],
    plan: "keep cards and resources flowing",
    support: true,
  },
  {
    id: "combat",
    label: "Combat",
    tags: [
      "attack-triggers",
      "combat-damage-triggers",
      "extra-combat",
      "combat-trick",
    ],
    plan: "support attacks and combat effects",
  },
  {
    id: "lands",
    label: "Lands",
    tags: ["lands-matter", "landfall", "extra-land-drops", "land-sacrifice"],
    plan: "gain value from lands and land entries",
  },
  {
    id: "artifacts",
    label: "Artifacts",
    tags: ["artifacts"],
    plan: "enable and reward artifact interactions",
  },
  {
    id: "enchantments",
    label: "Enchantments",
    tags: ["enchantments"],
    plan: "enable and reward enchantment interactions",
  },
  {
    id: "voltron",
    label: "Equipment / Auras",
    tags: ["voltron", "equipment", "auras", "go-tall"],
    plan: "support an individual threat with Equipment or Auras",
  },
  {
    id: "pings",
    label: "Pings / Punisher",
    tags: ["opponent-life-loss", "punisher", "symmetric-draw"],
    plan: "ping opponents a little at a time, punishing what every player does",
  },
  {
    id: "discard",
    label: "Discard / Mayhem",
    tags: ["mayhem", "madness", "discard-payoff"],
    plan: "discard cards on purpose and cast or cash them in from the graveyard",
  },
  {
    id: "clones",
    label: "Clones & Copies",
    tags: ["clones", "copy-creature-spells"],
    plan: "copy creatures and permanents to repeat their best effects",
  },
  {
    id: "spells",
    label: "Spells",
    tags: ["instants-sorceries", "spellslinger", "copy-spells", "cast-exile"],
    plan: "enable and reward casting spells",
  },
  {
    id: "lifegain",
    label: "Lifegain",
    tags: ["lifegain", "lifegain-payoff"],
    plan: "gain life and use life-gain payoffs",
  },
  {
    id: "interaction",
    label: "Interaction",
    tags: [
      "removal",
      "creature-removal",
      "permanent-removal",
      "artifact-enchantment-removal",
      "board-wipe",
      "counterspell",
      "protection",
      "hexproof-ward",
      "graveyard-hate",
    ],
    plan: "interact with threats and protect resources",
    support: true,
  },
  ...[
    "treasure",
    "food",
    "clue",
    "poison",
    "energy",
    "monarch",
    "initiative",
    "blink",
    "untap",
    "tap-matters",
    "planeswalkers",
    "vehicles",
    "extra-turns",
    "flash",
  ].map((id) => ({
    id,
    label: (
      {
        treasure: "Treasure",
        food: "Food",
        clue: "Clues",
        poison: "Poison",
        energy: "Energy",
        monarch: "Monarch",
        initiative: "Initiative",
        blink: "Blink",
        untap: "Untap",
        "tap-matters": "Tap Matters",
        planeswalkers: "Planeswalkers",
        vehicles: "Vehicles",
        "extra-turns": "Extra Turns",
        flash: "Instant-Speed Play",
      } as Record<string, string>
    )[id],
    tags: [id],
    plan:
      ({ vehicles: "crew Vehicles and attack with them", planeswalkers: "protect and use planeswalkers", "extra-turns": "take extra turns", flash: "play at instant speed" } as Record<string, string>)[id] ||
      `support ${id.replaceAll("-", " ")} effects`,
  })),
];
export const tagFamily = new Map(
  families.flatMap((f) => f.tags.map((tag) => [tag, f.id] as const)),
);
export const DNA_VERSION = "0.6.12";
