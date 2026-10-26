import { describe, it, expect } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { IndexedDbCollectionRepository } from "../../src/storage/collectionRepository";
import { LocalDeckRepository } from "../../src/storage/deckRepository";
import { emptyCollection } from "../../src/models/collection";
import type { CardMetadata, CollectionItem, CollectionState } from "../../src/models/collection";
import { inventoryKey } from "../../src/import/plan";
import { parseDeckText } from "../../src/decks/deckText";
import { blockingIssues, buildDeckImportPreview, deckImportSummary, finalizeDeckImport, initialChoices, resolveDeckLines } from "../../src/decks/deckImport";
import { deckOwnership, deckStats, isBasicLand, missingEntries } from "../../src/decks/decks";
import { deckRows, emptyDeckFilters, filterDeckRows } from "../../src/decks/deckBrowse";
import data from "../../src/data/sampleCards.json" with { type: "json" };

const sample = data as unknown as CardMetadata[];
const card = (name: string) => sample.find((c) => c.name === name)!;
const forest = card("Forest");
const sol = card("Sol Ring");
const tower = card("Command Tower");
const basic = (name: string, set: string, number: string, typeLine: string, colorIdentity: CardMetadata["colorIdentity"]): CardMetadata => ({
  ...forest, scryfallId: `${name}-${set}-${number}`.toLowerCase().replace(/\s+/g, "-"), name, setCode: set, collectorNumber: number, typeLine, colorIdentity,
});
const plainsA = basic("Plains", "aaa", "1", "Basic Land — Plains", ["W"]);
const mountainA = basic("Mountain", "aaa", "2", "Basic Land — Mountain", ["R"]);
const mountainB = basic("Mountain", "bbb", "9", "Basic Land — Mountain", ["R"]);
const island = basic("Island", "aaa", "3", "Basic Land — Island", ["U"]);
const snowMountain = basic("Snow-Covered Mountain", "khm", "283", "Basic Snow Land — Mountain", ["R"]);
const wastes = basic("Wastes", "ogw", "183", "Basic Land", []);
const golos: CardMetadata = { ...sol, scryfallId: "golos", name: "Golos Test Commander", setCode: "tst", collectorNumber: "1", typeLine: "Legendary Artifact Creature — Golem", colorIdentity: ["W", "U", "B", "R", "G"], manaValue: 7 };
const all = [plainsA, mountainA, mountainB, island, snowMountain, wastes, golos, sol, tower];

function item(c: CardMetadata, quantity: number): CollectionItem {
  const i: CollectionItem = { id: "", scryfallId: c.scryfallId, setCode: c.setCode, collectorNumber: c.collectorNumber!, finish: "nonfoil", language: "en", condition: "nm", binderName: "Main", binderType: "binder", quantityOwned: quantity, quantityAssigned: 0, quantityUnassigned: quantity, sourceRows: [] };
  i.id = inventoryKey(i);
  return i;
}
// Owned: 2 commanders, 20 Plains A, 20 Mountain A, 3 Islands, 1 Sol Ring, 1 Command Tower.
async function setup() {
  const state: CollectionState = {
    ...emptyCollection(),
    revision: 1,
    metadata: Object.fromEntries(all.map((c) => [c.scryfallId, c])),
    items: [item(golos, 2), item(plainsA, 20), item(mountainA, 20), item(island, 3), item(sol, 1), item(tower, 1)],
  };
  const repo = new IndexedDbCollectionRepository(crypto.randomUUID(), new IDBFactory());
  await repo.save(state, 0);
  return { repo, decks: new LocalDeckRepository(repo), state: (await repo.load())! };
}
const noLookup = { lookupDeckCards: async () => { throw new Error("no network expected"); } };
async function preview(state: CollectionState, body: string, name = "Imported") {
  const parsed = parseDeckText(`Commander\n1 Golos Test Commander\nDeck\n${body}`);
  return buildDeckImportPreview(parsed, await resolveDeckLines(parsed, state.metadata, noLookup, new AbortController().signal), state, { name });
}
async function importDeck(state: CollectionState, decks: LocalDeckRepository, body: string, name = "Imported") {
  const p = await preview(state, body, name);
  const choices = initialChoices(p);
  expect(blockingIssues(p, state, choices)).toEqual([]);
  const { deck, metadata } = finalizeDeckImport(p, state, choices, name.toLowerCase().replace(/\s+/g, "-"));
  return { p, next: await decks.change(state, { type: "import", deck, metadata, allowDuplicateName: false }) };
}
const entry = (p: Awaited<ReturnType<typeof preview>>, name: string) => p.entries.find((e) => e.name === name)!;
const itemFor = (s: CollectionState, c: CardMetadata) => s.items.find((i) => i.scryfallId === c.scryfallId)!;

describe("basic land detection", () => {
  it("uses the Basic supertype from card data, not names", () => {
    expect(isBasicLand(plainsA)).toBe(true);
    expect(isBasicLand(snowMountain)).toBe(true);
    expect(isBasicLand(wastes)).toBe(true);
    expect(isBasicLand(tower)).toBe(false);
    expect(isBasicLand({ ...forest, typeLine: "Land Creature — Forest Dryad" })).toBe(false);
    expect(isBasicLand({ ...plainsA, typeLine: "Land" })).toBe(false);
    expect(isBasicLand({ ...sol, typeLine: "Sorcery" })).toBe(false);
  });
});

describe("basic lands never block a deck import", () => {
  it("A — the same basic printing fully used by another deck imports without conflict and consumes nothing", async () => {
    const { decks, state } = await setup();
    // Deck A (a v0.4.0-style deck) holds all 20 Plains as real assignments.
    let current = await decks.change(state, { type: "create", name: "Deck A", itemId: itemFor(state, golos).id });
    for (let i = 0; i < 20; i++) current = await decks.change(current, { type: "add", deckId: current.decks![0].id, itemId: itemFor(current, plainsA).id });
    expect(itemFor(current, plainsA).quantityUnassigned).toBe(0);
    const { p, next } = await importDeck(current, decks, "15 Plains (AAA) 1", "Deck B");
    expect(entry(p, "Plains")).toMatchObject({ status: "basic", suggested: {} });
    const deckB = next.decks!.find((d) => d.name === "Deck B")!;
    expect(deckB.entries!.find((e) => e.name === "Plains")).toMatchObject({ quantity: 15, basicLand: true, requestedPrinting: { setCode: "aaa", collectorNumber: "1" } });
    expect(deckB.assignments).toEqual([]);
    expect(itemFor(next, plainsA)).toMatchObject({ quantityOwned: 20, quantityAssigned: 20, quantityUnassigned: 0 });
    expect(next.decks![0].assignments).toEqual(current.decks![0].assignments);
  });
  it("B — a different printing is kept on the entry; no choice is required", async () => {
    const { decks, state } = await setup();
    const p = await preview(state, "15 Mountain (BBB) 9");
    expect(entry(p, "Mountain")).toMatchObject({ status: "basic", requested: { setCode: "bbb", collectorNumber: "9" } });
    expect(entry(p, "Mountain").card.scryfallId).toBe(mountainB.scryfallId);
    expect(initialChoices(p).reviewed).toContain(entry(p, "Mountain").key);
    const { next } = await importDeck(state, decks, "15 Mountain (BBB) 9");
    expect(next.decks![0].entries!.find((e) => e.name === "Mountain")!.scryfallId).toBe(mountainB.scryfallId);
    expect(itemFor(next, mountainA).quantityAssigned).toBe(0);
  });
  it("C — quantity beyond inventory is accepted without a shortage", async () => {
    const { decks, state } = await setup();
    const p = await preview(state, "12 Island");
    expect(deckImportSummary(p, initialChoices(p))).toMatchObject({ total: 13, basic: 12, missing: 0, allocated: 0, review: 0 });
    const { next } = await importDeck(state, decks, "12 Island");
    const deck = next.decks![0];
    expect(deckOwnership(deck, next)).toEqual({ total: 13, assigned: 1, basic: 12, missing: 0 });
    expect(missingEntries(next, deck)).toEqual([]);
    expect(deckStats(next, deck).counts.Land).toBe(12);
    expect(itemFor(next, island)).toMatchObject({ quantityOwned: 3, quantityAssigned: 0 });
  });
  it("D/E — Snow-Covered basics and Wastes are recognized as Basic", async () => {
    const { decks, state } = await setup();
    const p = await preview(state, "10 Snow-Covered Mountain\n8 Wastes");
    expect(entry(p, "Snow-Covered Mountain").status).toBe("basic");
    expect(entry(p, "Wastes").status).toBe("basic");
    const { next } = await importDeck(state, decks, "10 Snow-Covered Mountain\n8 Wastes");
    expect(deckOwnership(next.decks![0], next)).toMatchObject({ basic: 18, missing: 0 });
  });
  it("F/G — Command Tower and Sol Ring keep strict allocation when used elsewhere", async () => {
    const { decks, state } = await setup();
    let current = await decks.change(state, { type: "create", name: "Deck A", itemId: itemFor(state, golos).id });
    current = await decks.change(current, { type: "add", deckId: current.decks![0].id, itemId: itemFor(current, tower).id });
    current = await decks.change(current, { type: "add", deckId: current.decks![0].id, itemId: itemFor(current, sol).id });
    const p = await preview(current, "1 Command Tower\n1 Sol Ring");
    expect(entry(p, "Command Tower").status).toBe("allocated");
    expect(entry(p, "Sol Ring").status).toBe("allocated");
    const choices = initialChoices(p);
    choices.picks[entry(p, "Command Tower").key] = { [itemFor(current, tower).id]: 1 };
    expect(blockingIssues(p, current, choices).join(" ")).toMatch(/Command Tower: not enough available copies/);
    expect(deckImportSummary(p, initialChoices(p))).toMatchObject({ allocated: 2, basic: 0 });
  });
});

describe("basic lands in the deck editor and browser", () => {
  it("adding a basic to an imported deck grows the list without consuming inventory; rows say not tracked", async () => {
    const { decks, state } = await setup();
    const { next } = await importDeck(state, decks, "2 Island\n1 Sol Ring");
    const deckId = next.decks![0].id;
    let current = next;
    for (let i = 0; i < 5; i++) current = await decks.change(current, { type: "add", deckId, itemId: itemFor(current, island).id });
    const deck = current.decks![0];
    expect(deck.entries!.find((e) => e.name === "Island")!.quantity).toBe(7);
    expect(itemFor(current, island)).toMatchObject({ quantityOwned: 3, quantityAssigned: 0, quantityUnassigned: 3 });
    const rows = deckRows(current, deck);
    const islands = rows.find((r) => r.name === "Island")!;
    expect(islands).toMatchObject({ assigned: false, basicLand: true, quantity: 7 });
    expect(filterDeckRows(rows, { ...emptyDeckFilters(), ownership: "missing" })).toEqual([]);
    expect(filterDeckRows(rows, { ...emptyDeckFilters(), ownership: "assigned" }).map((r) => r.name).sort()).toEqual(["Island", "Sol Ring"]);
    // A non-basic add to the same deck still consumes a real copy.
    expect(itemFor(current, sol).quantityAssigned).toBe(1);
  });
});
