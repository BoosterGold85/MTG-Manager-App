import { describe, it, expect, vi } from "vitest";
import { brewCard, vorelCountersFixture } from "../brewFixture";
import { oracleCard } from "../upgradeCandidates";
import { effectConditions, SupplyIndex } from "../../src/upgrades/conditions";
import { hasSelfEntryAbility } from "../../src/upgrades/abilityScope";
import { placesCountersOn } from "../../src/upgrades/counterSupply";
import * as functions from "../../src/upgrades/cardFunction";
import { deckCardFunction } from "../../src/upgrades/cardFunction";
import { brewContext, evaluateBrew } from "../../src/upgrades/brew";
import { currentDeckModel, synergyFor } from "../../src/upgrades";
import { deckDnaCache } from "../../src/dna/engine";
import type { CardMetadata } from "../../src/models/collection";
const witness = () => brewCard("Evolution Witness");
const creature = (name: string, text: string) =>
  oracleCard(name, "{2}{G}", 3, "Creature — Elf", text, ["G"], {
    power: "2",
    toughness: "2",
  });
const suppliers = (cards: CardMetadata[]) =>
  new SupplyIndex(
    cards.map((card) => ({ card, quantity: 1, commander: false })),
  );

describe("causal recommendation accuracy", () => {
  it("does not count self-only Adapt, Outlast, Evolve, or enters-with counters as external placement", () => {
    for (const text of [
      "{1}{G}: Adapt 2.",
      "Outlast {G}",
      "Evolve",
      "This creature enters with three +1/+1 counters on it.",
    ])
      expect(
        placesCountersOn(creature("Self source", text), witness()),
        text,
      ).toBe(false);
    expect(placesCountersOn(witness(), witness(), true)).toBe(true);
  });
  it("does not count proliferate, replacement effects, receiving counters or doubling as initial placement", () => {
    for (const text of [
      "Proliferate.",
      "If one or more +1/+1 counters would be put on a creature you control, put that many plus one on it instead.",
      "Whenever one or more +1/+1 counters are put on this creature, draw a card.",
      "Double the number of counters on target creature.",
    ])
      expect(
        placesCountersOn(creature("Amplifier", text), witness()),
        text,
      ).toBe(false);
  });
  it("recognizes actual target, mass, entry and moving-counter sources", () => {
    for (const text of [
      "Put a +1/+1 counter on target creature.",
      "Put a +1/+1 counter on each creature you control.",
      "Each other creature you control enters with an additional +1/+1 counter on it.",
      "Whenever another creature you control enters, put a +1/+1 counter on that creature.",
      "You may move any number of +1/+1 counters from this creature onto other creatures.",
    ])
      expect(
        placesCountersOn(creature("External source", text), witness()),
        text,
      ).toBe(true);
  });
  it("does not count a source restricted to a different recipient type or an unknown qualifier", () => {
    for (const text of [
      "Put a +1/+1 counter on target artifact creature.",
      "Put a +1/+1 counter on target red creature.",
    ])
      expect(placesCountersOn(creature("Restricted", text), witness())).toBe(
        false,
      );
    const artifact = { ...witness(), typeLine: "Artifact Creature — Golem" };
    expect(
      placesCountersOn(
        creature(
          "Artifact source",
          "Put a +1/+1 counter on target artifact creature.",
        ),
        artifact,
      ),
    ).toBe(true);
  });
  it("does not award an unsupported recursion engine full credit from other self-only creatures", () => {
    const cards = Array.from({ length: 8 }, (_, i) =>
      creature(`Self ${i}`, "{1}{G}: Adapt 2."),
    );
    const fn = deckCardFunction(witness(), suppliers(cards));
    const c = fn.conditions!.find((c) => c.key.startsWith("counters:"))!;
    expect(c.suppliers).toEqual(["Evolution Witness"]);
    expect(c.supply).toBe(1);
    expect(c.factor).toBe(0);
    expect(fn.roles.recursion).toBeUndefined();
  });
  it("preserves real placement sources and caches recipient scopes independently", () => {
    const source = creature(
      "Artifact source",
      "Put a +1/+1 counter on target artifact creature.",
    );
    const normal = effectConditions(witness())[0],
      artifact = effectConditions({
        ...witness(),
        typeLine: "Artifact Creature — Golem",
      })[0];
    const index = suppliers([source]);
    expect(index.supply(normal).supply).toBe(0);
    expect(index.supply(artifact).supply).toBe(1);
    expect(normal.key).not.toBe(artifact.key);
  });
  it.each([
    ["When this creature enters, draw a card.", true],
    ["When Entry Tester enters, draw a card.", true],
    ["Imprint — When Entry Tester enters, exile target creature.", true],
    [
      "Whenever this creature or another Dragon you control enters, draw a card.",
      true,
    ],
    ["Whenever another creature enters, draw a card.", false],
    ["Whenever a creature you control enters, draw a card.", false],
    ["Whenever a creature enters, if it has a counter, draw a card.", false],
  ])("matches only actual self-entry triggers: %s", (text, expected) => {
    expect(hasSelfEntryAbility(creature("Entry Tester", text as string))).toBe(
      expected,
    );
  });
  it("does not claim blink reuses a trigger for OTHER creatures entering", () => {
    const f = vorelCountersFixture(),
      dna = deckDnaCache.get(f.state, f.deck),
      model = currentDeckModel(f.state, f.deck);
    const ctx = {
      ...brewContext(dna, model, "High"),
      copiers: [],
      blinkers: ["Blink source"],
    };
    const c = creature(
      "Arrival observer",
      "Whenever another creature enters, draw a card.",
    );
    const synergy = synergyFor(f.state, f.deck, {
      ...c,
      id: c.scryfallId,
      quantity: 1,
    });
    const b = evaluateBrew(ctx, c, synergy);
    expect(b.why.some((x) => x.title === "Repeat support")).toBe(false);
  });
  it("does not award a Hidden Gem label to a low-confidence candidate in a high-confidence deck", () => {
    const f = vorelCountersFixture(),
      c = witness(),
      dna = deckDnaCache.get(f.state, f.deck),
      model = currentDeckModel(f.state, f.deck);
    const base = brewContext(dna, model, "High");
    const ctx = {
      ...base,
      packages: base.packages.map((p) => ({ ...p, presence: 1 })),
      model: {
        ...model,
        cards: [],
        totals: {
          ...model.totals,
          roles: { ...model.totals.roles, recursion: 0 },
        },
      },
    };
    const synergy = synergyFor(f.state, f.deck, {
      ...c,
      id: c.scryfallId,
      quantity: 1,
    });
    const strong = {
      ...synergy,
      score: 100,
      recommendation: {
        ...synergy.recommendation!,
        links: Array.from({ length: 20 }, (_, i) => ({
          identity: `support-${i}`,
          name: `Support ${i}`,
          commander: i === 0,
          strength: 1,
        })),
      },
    };
    const fn = deckCardFunction(c, model.supply);
    const mock = vi
      .spyOn(functions, "deckCardFunction")
      .mockReturnValue({ ...fn, confidence: "Low" });
    try {
      const result = evaluateBrew(ctx, c, strong);
      expect(result.score).toBeGreaterThanOrEqual(85);
      expect(result.confidence).toBe("Low");
      expect(result.label).toBe("Potential Brew");
    } finally {
      mock.mockRestore();
    }
  });
  it("supports any-permanent counter observers, split distribution and multi-target placement", () => {
    const permanent = {
      ...witness(),
      typeLine: "Permanent",
      cardFaces: undefined,
    };
    expect(
      placesCountersOn(
        creature("Seed", "Put a +1/+1 counter on target creature."),
        permanent,
      ),
    ).toBe(true);
    for (const text of [
      "Put a +1/+1 counter on each of up to two target creatures.",
      "Distribute three +1/+1 counters among one, two, or three target creatures.",
    ])
      expect(placesCountersOn(creature("Seed", text), witness()), text).toBe(
        true,
      );
    expect(
      placesCountersOn(
        creature(
          "Opposing seed",
          "Target opponent puts a +1/+1 counter on target creature.",
        ),
        witness(),
      ),
    ).toBe(false);
  });
  it("does not assume blinking can reuse a reverse-face-only entry ability", () => {
    const c = {
      ...witness(),
      oracleText: undefined,
      cardFaces: [
        { name: "Front", typeLine: "Creature — Elf", oracleText: "Vigilance" },
        {
          name: "Reverse",
          typeLine: "Creature — Mutant",
          oracleText: "When Reverse enters, draw a card.",
        },
      ],
    };
    expect(hasSelfEntryAbility(c)).toBe(false);
  });
  it("preserves global counter observers without contaminating a self-recipient condition", () => {
    const selfSeed = creature("Self seed", "{1}{G}: Adapt 2.");
    const observer = creature(
      "Observer",
      "Whenever one or more +1/+1 counters are put on a creature you control, draw a card.",
    );
    const global = effectConditions(observer)[0],
      specific = effectConditions(witness())[0];
    const replacement = effectConditions(brewCard("Hardened Scales"))[0];
    const index = suppliers([selfSeed]);
    expect(index.supply(global).suppliers).toEqual(["Self seed"]);
    expect(index.supply(specific).suppliers).toEqual([]);
    expect(index.supply(replacement).suppliers).toEqual(["Self seed"]);
    expect(global.key).not.toBe(specific.key);
    const noncreature = {
      ...selfSeed,
      typeLine: "Artifact",
      oracleText: "Put a +1/+1 counter on this artifact.",
    };
    expect(suppliers([noncreature]).supply(global).supply).toBe(0);
  });
});
