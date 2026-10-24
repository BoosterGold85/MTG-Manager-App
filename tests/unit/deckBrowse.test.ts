import { describe, it, expect, vi } from "vitest";
import { emptyCollection } from "../../src/models/collection";
import type { CardMetadata, CollectionItem, CollectionState } from "../../src/models/collection";
import type { Deck } from "../../src/models/deck";
import { inventoryKey } from "../../src/import/plan";
import { reconcileAllocations } from "../../src/decks/decks";
import {
  colorRank,
  deckCardAnalysis,
  deckRows,
  emptyDeckFilters,
  filterDeckRows,
  sortDeckRows,
  typeGroup,
  visibleDeckRows,
} from "../../src/decks/deckBrowse";
import type { DeckRow, DeckSort } from "../../src/decks/deckBrowse";
import * as tagger from "../../src/intelligence/tagger";
import { metadata } from "../importFixtures";
import data from "../../src/data/sampleCards.json" with { type: "json" };

const sample = data as unknown as CardMetadata[];
const card = (name: string) => sample.find((c) => c.name === name)!;
const meren = card("Meren of Clan Nel Toth");
const names = ["Sol Ring", "Forest", "Birds of Paradise", "Cultivate", "Reanimate", "Blood Artist", "Skullclamp", "Command Tower", "Avenger of Zendikar", "Victimize"];
const solFoil: CardMetadata = { ...card("Sol Ring"), scryfallId: "sol-ltc", setCode: "ltc", collectorNumber: "001" };
const witness: CardMetadata = { ...card("Sol Ring"), scryfallId: "witness-id", name: "Eternal Witness", setCode: "c21", collectorNumber: "185", colorIdentity: ["G"], typeLine: "Creature — Human Shaman", manaValue: 3, oracleText: "When Eternal Witness enters, return target card from your graveyard to your hand." };
function item(c: CardMetadata, quantity: number): CollectionItem {
  const i: CollectionItem = { id: "", scryfallId: c.scryfallId, setCode: c.setCode, collectorNumber: c.collectorNumber!, finish: "nonfoil", language: "en", condition: "nm", binderName: "Main", binderType: "binder", quantityOwned: quantity, quantityAssigned: 0, quantityUnassigned: quantity, sourceRows: [] };
  i.id = inventoryKey(i);
  return i;
}
// Meren deck: 9 assigned cards, Eternal Witness missing, Sol Ring owned in another printing but unassigned.
function fixture() {
  const items = [item(meren, 1), ...names.filter((n) => n !== "Sol Ring").map((n) => item(card(n), 2)), item(solFoil, 1)];
  const ids = (n: string) => items.find((i) => metadata[i.scryfallId]?.name === n)!.id;
  const entries = [
    { id: "d:cmd", board: "commander" as const, quantity: 1, name: meren.name, cardIdentity: "x", scryfallId: meren.scryfallId },
    ...names.map((n, i) => ({ id: `d:${i}`, board: "main" as const, quantity: n === "Forest" ? 2 : 1, name: n, cardIdentity: n, scryfallId: card(n).scryfallId })),
    { id: "d:w", board: "main" as const, quantity: 1, name: witness.name, cardIdentity: "w", scryfallId: witness.scryfallId },
  ];
  const deck: Deck = {
    id: "d", name: "Meren", createdAt: "2026-01-01T00:00:00.000Z", modifiedAt: "2026-01-01T00:00:00.000Z",
    commanders: [{ itemId: items[0].id, entryId: "d:cmd", cardIdentity: "x", scryfallId: meren.scryfallId, name: meren.name, colorIdentity: ["B", "G"] }],
    entries,
    assignments: names.filter((n) => n !== "Sol Ring").map((n) => ({ itemId: ids(n), quantity: n === "Forest" ? 2 : 1, entryId: `d:${names.indexOf(n)}` })),
  };
  const state: CollectionState = reconcileAllocations({ ...emptyCollection(), revision: 1, metadata: { ...structuredClone(metadata), [solFoil.scryfallId]: solFoil, [witness.scryfallId]: witness }, items, decks: [deck] });
  return { state, deck: state.decks![0] };
}
const order = (rows: DeckRow[]) => rows.map((r) => r.name);

describe("deck rows", () => {
  it("lists assigned printings and unassigned entries separately without fabricating ownership", () => {
    const { state, deck } = fixture();
    const rows = deckRows(state, deck);
    expect(rows).toHaveLength(11);
    const forest = rows.find((r) => r.name === "Forest")!;
    expect(forest).toMatchObject({ assigned: true, quantity: 2 });
    expect(forest.card.ownership!.setCode).toBe(card("Forest").setCode);
    const witnessRow = rows.find((r) => r.name === "Eternal Witness")!;
    expect(witnessRow).toMatchObject({ assigned: false, quantity: 1, ownedElsewhere: 0 });
    expect(witnessRow.card.ownership).toBeUndefined();
    expect(witnessRow.card.analysis!.assignments.map((a) => a.tagId)).toContain("recursion");
    const sol = rows.find((r) => r.name === "Sol Ring")!;
    expect(sol).toMatchObject({ assigned: false, ownedElsewhere: 1, availableElsewhere: 1 });
    expect(sol.card.ownership).toBeUndefined();
    expect(sol.card.setCode).toBe(card("Sol Ring").setCode);
    expect(rows.some((r) => r.name === meren.name)).toBe(false);
  });
  it("analyzes an unowned canonical card once and reuses it while browsing", () => {
    const { state } = fixture();
    const spy = vi.spyOn(tagger, "analyze");
    const fresh = { ...witness, scryfallId: "fresh", name: "Fresh Unowned Card" };
    const first = deckCardAnalysis(state, fresh);
    for (let i = 0; i < 5; i++) expect(deckCardAnalysis(state, fresh)).toBe(first);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe("deck sorting", () => {
  const rows = () => deckRows(fixture().state, fixture().deck);
  it("Name A–Z and Z–A", () => {
    const az = order(sortDeckRows(rows(), "name-asc"));
    expect(az).toEqual([...az].sort((a, b) => a.localeCompare(b)));
    expect(order(sortDeckRows(rows(), "name-desc"))).toEqual([...az].reverse());
  });
  it("Mana Value both directions with Name tie-break", () => {
    const low = sortDeckRows(rows(), "mv-asc");
    expect(low.map((r) => r.card.manaValue)).toEqual([...low.map((r) => r.card.manaValue)].sort((a, b) => a - b));
    expect(order(low).slice(0, 3)).toEqual(["Command Tower", "Forest", "Birds of Paradise"]);
    const high = sortDeckRows(rows(), "mv-desc");
    expect(high[0].name).toBe("Avenger of Zendikar");
    expect(order(high.filter((r) => r.card.manaValue === 1))).toEqual(["Birds of Paradise", "Reanimate", "Skullclamp", "Sol Ring"]);
  });
  it("Card Type groups creatures, instants, sorceries, artifacts, enchantments, planeswalkers, battles, lands", () => {
    const sorted = sortDeckRows(rows(), "type");
    expect(sorted.map((r) => typeGroup(r.card))).toEqual(["Creature", "Creature", "Creature", "Creature", "Sorcery", "Sorcery", "Sorcery", "Artifact", "Artifact", "Land", "Land"]);
    expect(order(sorted).slice(0, 4)).toEqual(["Birds of Paradise", "Blood Artist", "Eternal Witness", "Avenger of Zendikar"]);
    expect(typeGroup({ ...card("Sol Ring"), id: "x", quantity: 1, typeLine: "Artifact Creature — Golem" })).toBe("Creature");
  });
  it("Color orders mono WUBRG, then multicolor, then colorless", () => {
    const sorted = sortDeckRows(rows(), "color");
    expect(sorted.map((r) => r.card.colorIdentity.join("") || "C")).toEqual(["B", "B", "B", "G", "G", "G", "G", "G", "C", "C", "C"]);
    expect(colorRank({ ...meren, id: "m", quantity: 1 })).toEqual([2, "24"]);
  });
  it("set sort and deterministic ordering regardless of input order", () => {
    const sorts: DeckSort[] = ["type", "name-asc", "name-desc", "mv-asc", "mv-desc", "color", "set"];
    for (const sort of sorts) expect(order(sortDeckRows([...rows()].reverse(), sort))).toEqual(order(sortDeckRows(rows(), sort)));
    const set = sortDeckRows(rows(), "set").map((r) => r.card.setCode);
    expect(set).toEqual([...set].sort());
  });
});

describe("deck filters", () => {
  it("filter by type, ownership and name produce the browsable sequence", () => {
    const { state, deck } = fixture();
    const rows = deckRows(state, deck);
    expect(order(filterDeckRows(rows, { ...emptyDeckFilters(), type: "Sorcery" })).sort()).toEqual(["Cultivate", "Reanimate", "Victimize"]);
    expect(order(filterDeckRows(rows, { ...emptyDeckFilters(), ownership: "missing" })).sort()).toEqual(["Eternal Witness", "Sol Ring"]);
    expect(filterDeckRows(rows, { ...emptyDeckFilters(), ownership: "assigned" })).toHaveLength(9);
    expect(order(visibleDeckRows(rows, "mv-desc", { ...emptyDeckFilters(), query: "re" }))).toEqual(["Reanimate", "Forest"]);
    expect(order(visibleDeckRows(rows, "name-asc", { ...emptyDeckFilters(), type: "Creature", ownership: "assigned" }))).toEqual(["Avenger of Zendikar", "Birds of Paradise", "Blood Artist"]);
  });
});
