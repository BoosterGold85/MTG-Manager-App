import { describe, it, expect } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { IndexedDbCollectionRepository } from "../../src/storage/collectionRepository";
import { LocalDeckRepository } from "../../src/storage/deckRepository";
import { emptyCollection } from "../../src/models/collection";
import type { CardMetadata, CollectionItem, CollectionState } from "../../src/models/collection";
import { inventoryKey } from "../../src/import/plan";
import { parseDeckText } from "../../src/decks/deckText";
import { buildDeckImportPreview, finalizeDeckImport, initialChoices, resolveDeckLines } from "../../src/decks/deckImport";
import { deckCount } from "../../src/decks/decks";
import { cardIdentity } from "../../src/intelligence/tagger";
import data from "../../src/data/sampleCards.json" with { type: "json" };

const sample = data as unknown as CardMetadata[];
const card = (name: string) => sample.find((c) => c.name === name)!;
const forest = card("Forest"), sol = card("Sol Ring"), tower = card("Command Tower");
const plains: CardMetadata = { ...forest, scryfallId: "plains-aaa-1", name: "Plains", setCode: "aaa", collectorNumber: "1", typeLine: "Basic Land — Plains", colorIdentity: ["W"], oracleId: "plains-oracle" };
const golos: CardMetadata = { ...sol, scryfallId: "golos", oracleId: "golos-oracle", name: "Golos Test Commander", setCode: "tst", collectorNumber: "1", typeLine: "Legendary Artifact Creature — Golem", colorIdentity: ["W", "U", "B", "R", "G"], manaValue: 7 };
const all = [plains, golos, sol, tower];
function item(c: CardMetadata, quantity: number, finish: "nonfoil" | "foil" = "nonfoil"): CollectionItem {
  const i: CollectionItem = { id: "", scryfallId: c.scryfallId, setCode: c.setCode, collectorNumber: c.collectorNumber!, finish, language: "en", condition: "nm", binderName: "Main", binderType: "binder", quantityOwned: quantity, quantityAssigned: 0, quantityUnassigned: quantity, sourceRows: [] };
  i.id = inventoryKey(i);
  return i;
}
async function setup(towers = 1) {
  const state: CollectionState = {
    ...emptyCollection(),
    revision: 1,
    metadata: Object.fromEntries(all.map((c) => [c.scryfallId, c])),
    items: [item(golos, 2), item(plains, 20), item(sol, 1), item(tower, towers)],
  };
  const repo = new IndexedDbCollectionRepository(crypto.randomUUID(), new IDBFactory());
  await repo.save(state, 0);
  return { repo, decks: new LocalDeckRepository(repo), state: (await repo.load())! };
}
const noLookup = { lookupDeckCards: async () => { throw new Error("no network expected"); } };
async function importDeck(state: CollectionState, decks: LocalDeckRepository, body: string, name = "Imported") {
  const parsed = parseDeckText(`Commander\n1 Golos Test Commander\nDeck\n${body}`);
  const p = buildDeckImportPreview(parsed, await resolveDeckLines(parsed, state.metadata, noLookup, new AbortController().signal), state, { name });
  const { deck, metadata } = finalizeDeckImport(p, state, initialChoices(p), name.toLowerCase().replace(/\s+/g, "-"));
  return decks.change(state, { type: "import", deck, metadata, allowDuplicateName: false });
}
const itemOf = (s: CollectionState, c: CardMetadata) => s.items.find((i) => i.scryfallId === c.scryfallId)!;
const deckOf = (s: CollectionState, id = "imported") => s.decks!.find((d) => d.id === id)!;
const qty = (s: CollectionState, name: string, id = "imported") => deckOf(s, id).entries!.filter((e) => e.name === name).reduce((n, e) => n + e.quantity, 0);

describe("atomic one-for-one swap", () => {
  it("imported deck: outgoing leaves once, incoming copy is assigned, count and ownership unchanged, one revision", async () => {
    const { repo, decks, state } = await setup();
    const imported = await importDeck(state, decks, "1 Sol Ring\n10 Plains");
    const before = deckCount(deckOf(imported));
    const next = await decks.change(imported, { type: "swap", deckId: "imported", incomingItemId: itemOf(imported, tower).id, outgoingCardIdentity: cardIdentity(sol) });
    expect(next.revision).toBe(imported.revision + 1);
    expect((await repo.load())!.revision).toBe(imported.revision + 1);
    expect(deckCount(deckOf(next))).toBe(before);
    expect(qty(next, "Sol Ring")).toBe(0);
    expect(qty(next, "Command Tower")).toBe(1);
    expect(itemOf(next, sol)).toMatchObject({ quantityOwned: 1, quantityAssigned: 0, quantityUnassigned: 1 });
    expect(itemOf(next, tower)).toMatchObject({ quantityOwned: 1, quantityAssigned: 1, quantityUnassigned: 0 });
    const towerEntry = deckOf(next).entries!.find((e) => e.name === "Command Tower")!;
    expect(deckOf(next).assignments.filter((a) => a.entryId === towerEntry.id)).toEqual([{ itemId: itemOf(next, tower).id, quantity: 1, entryId: towerEntry.id }]);
  });
  it("a missing outgoing copy is removed from the decklist without releasing any physical copy", async () => {
    const { decks, state } = await setup();
    const imported = await importDeck(state, decks, "2 Sol Ring\n10 Plains");
    const next = await decks.change(imported, { type: "swap", deckId: "imported", incomingItemId: itemOf(imported, tower).id, outgoingCardIdentity: cardIdentity(sol) });
    expect(qty(next, "Sol Ring")).toBe(1);
    expect(itemOf(next, sol).quantityAssigned).toBe(1);
    expect(deckCount(deckOf(next))).toBe(deckCount(deckOf(imported)));
  });
  it("basic lands stay fungible: swapping one out lowers the decklist quantity and reserves nothing", async () => {
    const { decks, state } = await setup();
    const imported = await importDeck(state, decks, "1 Sol Ring\n10 Plains");
    const out = await decks.change(imported, { type: "swap", deckId: "imported", incomingItemId: itemOf(imported, tower).id, outgoingCardIdentity: cardIdentity(plains) });
    expect(qty(out, "Plains")).toBe(9);
    expect(itemOf(out, plains)).toMatchObject({ quantityAssigned: 0, quantityUnassigned: 20 });
    // Incoming basic: one more decklist Plains, still no reservation.
    const back = await decks.change(out, { type: "swap", deckId: "imported", incomingItemId: itemOf(out, plains).id, outgoingCardIdentity: cardIdentity(tower) });
    expect(qty(back, "Plains")).toBe(10);
    expect(itemOf(back, plains).quantityAssigned).toBe(0);
    expect(itemOf(back, tower).quantityUnassigned).toBe(1);
  });
  it("never takes a copy assigned to another deck; a rejected swap writes nothing", async () => {
    const { repo, decks, state } = await setup();
    let s = await importDeck(state, decks, "1 Sol Ring\n10 Plains");
    s = await importDeck(s, decks, "1 Command Tower", "Deck B");
    expect(itemOf(s, tower).quantityUnassigned).toBe(0);
    await expect(decks.change(s, { type: "swap", deckId: "imported", incomingItemId: itemOf(s, tower).id, outgoingCardIdentity: cardIdentity(sol) })).rejects.toThrow(/No unassigned copy/);
    const stored = (await repo.load())!;
    expect(stored.revision).toBe(s.revision);
    expect(stored.decks).toEqual(s.decks);
  });
  it("a stale base revision is rejected with no partial write", async () => {
    const { repo, decks, state } = await setup(2);
    const imported = await importDeck(state, decks, "1 Sol Ring\n10 Plains");
    const elsewhere = await decks.change(imported, { type: "rename", deckId: "imported", name: "Renamed" });
    await expect(decks.change(imported, { type: "swap", deckId: "imported", incomingItemId: itemOf(imported, tower).id, outgoingCardIdentity: cardIdentity(sol) })).rejects.toThrow();
    expect((await repo.load())!).toEqual(elsewhere);
  });
  it("rejects missing outgoing cards, self-swaps and Commander removal", async () => {
    const { decks, state } = await setup(2);
    const imported = await importDeck(state, decks, "1 Sol Ring\n10 Plains");
    const towerId = itemOf(imported, tower).id;
    await expect(decks.change(imported, { type: "swap", deckId: "imported", incomingItemId: towerId, outgoingCardIdentity: "not-in-deck" })).rejects.toThrow(/no longer in this deck/);
    await expect(decks.change(imported, { type: "swap", deckId: "imported", incomingItemId: towerId, outgoingCardIdentity: cardIdentity(tower) })).rejects.toThrow(/cannot replace itself/);
    await expect(decks.change(imported, { type: "swap", deckId: "imported", incomingItemId: towerId, outgoingCardIdentity: cardIdentity(golos) })).rejects.toThrow(/Commander/);
  });
  it("legacy assignment-only decks swap one assignment for another", async () => {
    const { decks, state } = await setup();
    let s = await decks.change(state, { type: "create", name: "Legacy", itemId: itemOf(state, golos).id });
    const id = s.decks![0].id;
    s = await decks.change(s, { type: "add", deckId: id, itemId: itemOf(s, sol).id });
    const next = await decks.change(s, { type: "swap", deckId: id, incomingItemId: itemOf(s, tower).id, outgoingCardIdentity: cardIdentity(sol) });
    const deck = next.decks![0];
    expect(deck.entries).toBeUndefined();
    expect(deck.assignments).toEqual([{ itemId: itemOf(next, tower).id, quantity: 1 }]);
    expect(deckCount(deck)).toBe(deckCount(s.decks![0]));
    expect(itemOf(next, sol).quantityUnassigned).toBe(1);
  });
});

describe("saved candidates", () => {
  it("persist only identity and intent, de-duplicate per goal, and are removed by a swap that adds them", async () => {
    const { repo, decks, state } = await setup();
    let s = await importDeck(state, decks, "1 Sol Ring\n10 Plains");
    expect(deckOf(s).savedCandidates).toBeUndefined();
    const candidate = { intent: "improve" as const, candidateIdentity: cardIdentity(tower), candidateName: "Command Tower", preferredItemId: itemOf(s, tower).id, suggestedCutIdentity: cardIdentity(sol), suggestedCutName: "Sol Ring" };
    s = await decks.change(s, { type: "save-candidate", deckId: "imported", candidate });
    s = await decks.change(s, { type: "save-candidate", deckId: "imported", candidate });
    s = await decks.change(s, { type: "save-candidate", deckId: "imported", candidate: { ...candidate, intent: "build" } });
    const saved = (await repo.load())!.decks!.find((d) => d.id === "imported")!.savedCandidates!;
    expect(saved.map((c) => c.intent).sort()).toEqual(["build", "improve"]);
    expect(Object.keys(saved[0]).sort()).toEqual(["candidateIdentity", "candidateName", "createdAt", "id", "intent", "preferredItemId", "suggestedCutIdentity", "suggestedCutName"]);
    s = await decks.change(s, { type: "remove-saved", deckId: "imported", savedId: saved.find((c) => c.intent === "build")!.id });
    expect(deckOf(s).savedCandidates!.map((c) => c.intent)).toEqual(["improve"]);
    s = await decks.change(s, { type: "swap", deckId: "imported", incomingItemId: itemOf(s, tower).id, outgoingCardIdentity: cardIdentity(sol) });
    expect(deckOf(s).savedCandidates).toEqual([]);
  });
});
