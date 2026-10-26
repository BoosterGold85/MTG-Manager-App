import { it, expect } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  IndexedDbCollectionRepository,
  validateState,
} from "../../src/storage/collectionRepository";
import { LocalDeckRepository } from "../../src/storage/deckRepository";
import { emptyCollection, collectionCards } from "../../src/models/collection";
import type { CollectionState } from "../../src/models/collection";
import {
  allocationConflicts,
  commanderEligible,
  deckCount,
  deckStats,
  deckUsage,
  legalInDeck,
  newDeck,
} from "../../src/decks/decks";
import {
  collectionBackup,
  changeCollection,
} from "../../src/storage/collectionManagement";
import {
  metadata,
  meren,
  tatyova,
  sol,
  forest,
  fixtureRow,
  exportCsv,
} from "../importFixtures";
import { inventoryKey, buildImportPlan } from "../../src/import/plan";
import { parseManaBox, identifierKey } from "../../src/import/csv";
import { filterCards, emptyFilters } from "../../src/utils/filters";
function initial(): CollectionState {
  const state = {
    ...emptyCollection(),
    revision: 1,
    metadata: structuredClone(metadata),
  };
  state.items = [meren, tatyova, sol, forest].map((c) => {
    const item = {
      id: "",
      scryfallId: c.scryfallId,
      setCode: c.setCode,
      collectorNumber: c.collectorNumber!,
      finish: "nonfoil" as const,
      language: "en",
      condition: "nm",
      binderName: "Main binder",
      binderType: "binder",
      quantityOwned: 3,
      quantityAssigned: 0,
      quantityUnassigned: 3,
      sourceRows: [],
    };
    item.id = inventoryKey(item);
    return item;
  });
  return state;
}
async function setup() {
  const factory = new IDBFactory();
  const repo = new IndexedDbCollectionRepository(crypto.randomUUID(), factory);
  const state = initial();
  await repo.save(state, 0);
  return { repo, decks: new LocalDeckRepository(repo), state };
}
const item = (s: CollectionState, name: string) =>
  s.items.find((i) => s.metadata[i.scryfallId].name === name)!;
async function create(
  s: CollectionState,
  r: LocalDeckRepository,
  name = "Meren deck",
  commander = meren.name,
) {
  return r.change(s, { type: "create", name, itemId: item(s, commander).id });
}
it("creates canonical commander references, reserves its printing and survives repository recreation", async () => {
  const { repo, decks, state } = await setup();
  const next = await create(state, decks);
  const deck = next.decks![0];
  expect(deck.name).toBe("Meren deck");
  expect(deck.commanders[0]).toMatchObject({
    name: meren.name,
    scryfallId: meren.scryfallId,
    colorIdentity: ["B", "G"],
  });
  expect(item(next, meren.name)).toMatchObject({
    quantityOwned: 3,
    quantityAssigned: 1,
    quantityUnassigned: 2,
  });
  expect(await new LocalDeckRepository(repo).load()).toEqual(next.decks);
  expect(state.decks).toBeUndefined();
});
it("commander eligibility is canonical, supports explicit permission and rejects ordinary creatures/tags", () => {
  expect(commanderEligible(meren)).toBe(true);
  expect(commanderEligible(sol)).toBe(false);
  expect(
    commanderEligible({
      ...sol,
      typeLine: "Legendary Planeswalker",
      oracleText: "This card can be your commander.",
    }),
  ).toBe(true);
  expect(
    commanderEligible({
      ...sol,
      typeLine: "Creature — Elf",
      tags: ["Commander"],
    }),
  ).toBe(false);
  expect(
    commanderEligible({
      ...meren,
      typeLine: "Instant",
      cardFaces: [
        { name: "Front", typeLine: "Instant" },
        { name: "Back", typeLine: "Legendary Creature" },
      ],
    }),
  ).toBe(false);
  expect(() => newDeck(initial(), " ", initial().items[0].id)).toThrow("name");
  expect(() => newDeck(initial(), "Deck", initial().items[2].id)).toThrow(
    "canonical",
  );
});
it("color subset legality includes colorless and excludes any outside color regardless of tags", () => {
  const d = newDeck(initial(), "Deck", initial().items[0].id);
  for (const colorIdentity of [[], ["B"], ["G"], ["B", "G"]] as const)
    expect(legalInDeck({ colorIdentity: [...colorIdentity] }, d)).toBe(true);
  for (const colorIdentity of [["W"], ["U", "B"], ["B", "G", "R"]] as const)
    expect(legalInDeck({ colorIdentity: [...colorIdentity] }, d)).toBe(false);
});
it("allocates same canonical card to multiple decks, rejects exhausted copies without transfer", async () => {
  const { decks, state, repo } = await setup();
  let s = await create(state, decks, "A");
  s = await create(s, decks, "B");
  const [a, b] = s.decks!;
  const id = item(s, sol.name).id;
  for (const deckId of [a.id, b.id, a.id])
    s = await decks.change(s, { type: "add", deckId, itemId: id });
  expect(item(s, sol.name)).toMatchObject({
    quantityOwned: 3,
    quantityAssigned: 3,
    quantityUnassigned: 0,
  });
  expect(deckUsage(s, id).map((u) => [u.deck.name, u.quantity])).toEqual([
    ["A", 2],
    ["B", 1],
  ]);
  await expect(
    decks.change(s, { type: "add", deckId: b.id, itemId: id }),
  ).rejects.toThrow("No unassigned");
  expect(await repo.load()).toEqual(s);
  await expect(
    decks.change(s, {
      type: "add",
      deckId: a.id,
      itemId: item(s, tatyova.name).id,
    }),
  ).rejects.toThrow("outside");
});
it("remove returns availability, deletion releases commander and cards without deleting inventory", async () => {
  const { decks, state } = await setup();
  let s = await create(state, decks);
  const deckId = s.decks![0].id;
  const id = item(s, sol.name).id;
  s = await decks.change(s, { type: "add", deckId, itemId: id });
  s = await decks.change(s, { type: "remove", deckId, itemId: id });
  expect(item(s, sol.name).quantityUnassigned).toBe(3);
  expect(s.decks![0].assignments).toEqual([]);
  s = await decks.change(s, { type: "add", deckId, itemId: id });
  s = await decks.change(s, { type: "delete", deckId });
  expect(s.items).toEqual(state.items);
  expect(s.metadata).toEqual(state.metadata);
  expect(s.decks).toEqual([]);
});
it("distinct finishes and printings allocate separately and preserve all physical fields", async () => {
  const { decks, state, repo } = await setup();
  const printing = {
    ...sol,
    scryfallId: crypto.randomUUID(),
    setCode: "xyz",
    collectorNumber: "99",
  };
  const variant = {
    ...state.items[2],
    id: "foil-printing",
    scryfallId: printing.scryfallId,
    setCode: "xyz",
    collectorNumber: "99",
    finish: "foil" as const,
    language: "ja",
    condition: "played",
    quantityOwned: 1,
    quantityUnassigned: 1,
  };
  let s = {
    ...state,
    revision: 2,
    metadata: { ...state.metadata, [printing.scryfallId]: printing },
    items: [...state.items, variant],
  };
  await repo.save(s, 1);
  s = await create(s, decks);
  s = await decks.change(s, {
    type: "add",
    deckId: s.decks![0].id,
    itemId: variant.id,
  });
  expect(s.items.find((i) => i.id === variant.id)).toMatchObject({
    ...variant,
    quantityAssigned: 1,
    quantityUnassigned: 0,
  });
  expect(item(s, sol.name).quantityAssigned).toBe(0);
  expect(s.items).toHaveLength(5);
});
function reimport(s: CollectionState, quantity: number) {
  const parsed = parseManaBox(exportCsv([fixtureRow(sol, quantity)]));
  return buildImportPlan(
    parsed,
    {
      results: new Map(
        parsed.rows.map((r) => [
          identifierKey(r),
          { card: metadata[sol.scryfallId] },
        ]),
      ),
      nameMatches: {},
    },
    s,
    "update.csv",
  );
}
it("normal and repeated ManaBox imports preserve deck references and allocation", async () => {
  const { decks, state, repo } = await setup();
  let s = await create(state, decks);
  s = await decks.change(s, {
    type: "add",
    deckId: s.decks![0].id,
    itemId: item(s, sol.name).id,
  });
  const plan = reimport(s, 4);
  expect(plan.next.decks).toEqual(s.decks);
  expect(item(plan.next, sol.name).quantityAssigned).toBe(1);
  await repo.save(plan.next, s.revision);
  const repeated = reimport(plan.next, 4);
  expect(repeated.summary.unchanged).toBe(1);
  expect(repeated.next.decks).toEqual(s.decks);
  validateState(repeated.next);
});
it("reduced and zero ownership retain assignments, expose conflict, and recover by explicit removal", async () => {
  const { decks, state, repo } = await setup();
  let s = await create(state, decks);
  const deckId = s.decks![0].id,
    id = item(s, sol.name).id;
  s = await decks.change(s, { type: "add", deckId, itemId: id });
  s = await decks.change(s, { type: "add", deckId, itemId: id });
  const plan = reimport(s, 1);
  expect(plan.warnings.join()).toContain("allocation conflict");
  expect(allocationConflicts(plan.next)).toHaveLength(1);
  expect(item(plan.next, sol.name)).toMatchObject({
    quantityOwned: 1,
    quantityAssigned: 2,
    quantityUnassigned: 0,
  });
  await repo.save(plan.next, s.revision);
  s = await decks.change(plan.next, { type: "remove", deckId, itemId: id });
  expect(allocationConflicts(s)).toEqual([]);
  const zero = reimport(s, 0);
  await repo.save(zero.next, s.revision);
  expect(allocationConflicts(zero.next)).toHaveLength(1);
  expect(zero.next.decks).toEqual(s.decks);
  s = await decks.change(zero.next, { type: "remove", deckId, itemId: id });
  expect(item(s, sol.name).quantityOwned).toBe(0);
  expect(allocationConflicts(s)).toEqual([]);
});
it("backup includes decks, commander and stable printing references; removal/clear guard allocated cards", async () => {
  const { decks, state, repo } = await setup();
  const s = await create(state, decks);
  const backup = JSON.parse(await collectionBackup(repo));
  expect(backup.applicationVersion).toBe("0.6.3");
  expect(backup.collection.decks).toEqual(s.decks);
  expect(backup.collection.items).toEqual(s.items);
  await expect(changeCollection(repo, s, { type: "clear" })).rejects.toThrow(
    "assigned",
  );
  await expect(
    changeCollection(repo, s, { type: "remove", ids: [s.items[0].id] }),
  ).rejects.toThrow("assigned");
  expect(await repo.load()).toEqual(s);
});
it("rename is durable, stale and failed writes leave deck ownership unchanged", async () => {
  const { decks, state, repo } = await setup();
  const s = await create(state, decks);
  const deckId = s.decks![0].id;
  const renamed = await decks.change(s, {
    type: "rename",
    deckId,
    name: "New name",
  });
  expect(renamed.decks![0].name).toBe("New name");
  await expect(decks.change(s, { type: "delete", deckId })).rejects.toThrow(
    "another tab",
  );
  expect(await repo.load()).toEqual(renamed);
  const failed = new LocalDeckRepository({
    load: repo.load.bind(repo),
    save: async () => {
      throw Error("Full");
    },
  });
  await expect(
    failed.change(renamed, { type: "delete", deckId }),
  ).rejects.toThrow("Full");
  expect(await repo.load()).toEqual(renamed);
});
it("validates deck references and derived counts without rejecting a legitimate allocation conflict", async () => {
  const { decks, state } = await setup();
  const s = await create(state, decks);
  expect(() =>
    validateState({
      ...s,
      items: s.items.map((i, n) =>
        n === 0 ? { ...i, quantityOwned: 0, quantityUnassigned: 0 } : i,
      ),
    }),
  ).not.toThrow();
  expect(() =>
    validateState({
      ...s,
      decks: [
        { ...s.decks![0], assignments: [{ itemId: "missing", quantity: 1 }] },
      ],
    }),
  ).toThrow("assignment");
  expect(() =>
    validateState({
      ...s,
      items: s.items.map((i) => ({ ...i, quantityAssigned: 0 })),
    }),
  ).toThrow();
});
it("basic stats and existing Collection/Commander/keyword/Oracle filters use the same imported cards", async () => {
  const { state, decks } = await setup();
  let s = await create(state, decks);
  s = await decks.change(s, {
    type: "add",
    deckId: s.decks![0].id,
    itemId: item(s, sol.name).id,
  });
  expect(deckCount(s.decks![0])).toBe(2);
  expect(deckStats(s, s.decks![0]).counts).toMatchObject({
    Creature: 1,
    Artifact: 1,
  });
  expect(
    filterCards(collectionCards(s), "", {
      ...emptyFilters,
      commanderColors: ["B", "G"],
    }),
  ).toHaveLength(3);
  expect(
    filterCards(collectionCards(s), "add", {
      ...emptyFilters,
      searchIn: "oracle",
    }).some((c) => c.name === sol.name),
  ).toBe(true);
});
