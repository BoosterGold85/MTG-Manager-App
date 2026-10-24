import { describe, it, expect, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { IndexedDbCollectionRepository, validateState } from "../../src/storage/collectionRepository";
import { LocalDeckRepository } from "../../src/storage/deckRepository";
import { emptyCollection } from "../../src/models/collection";
import type { CardMetadata, CollectionItem, CollectionState } from "../../src/models/collection";
import { inventoryKey, buildImportPlan } from "../../src/import/plan";
import { parseManaBox } from "../../src/import/csv";
import { LookupInterrupted, ScryfallClient } from "../../src/import/scryfall";
import type { DeckCardLookup, DeckIdentifier } from "../../src/import/scryfall";
import { parseDeckText } from "../../src/decks/deckText";
import {
  blockingIssues,
  buildDeckImportPreview,
  colorConflicts,
  deckImportSummary,
  finalizeDeckImport,
  initialChoices,
  resolveDeckLines,
} from "../../src/decks/deckImport";
import type { DeckImportChoices, DeckImportPreview } from "../../src/decks/deckImport";
import { deckCount, deckOwnership, deckStats, missingEntries } from "../../src/decks/decks";
import { changeCollection } from "../../src/storage/collectionManagement";
import { metadata, meren, tatyova, sol, forest, fixtureRow, exportCsv, apiCard } from "../importFixtures";
import data from "../../src/data/sampleCards.json" with { type: "json" };

const sample = data as unknown as CardMetadata[];
const card = (name: string) => sample.find((c) => c.name === name)!;
const skullclamp = card("Skullclamp");
const signet = card("Arcane Signet");
const atraxa = card("Atraxa, Praetors' Voice");
const solPip: CardMetadata = { ...sol, scryfallId: "sol-pip-239", setCode: "pip", collectorNumber: "239" };
const forestZnr: CardMetadata = { ...forest, scryfallId: "forest-znr-280", setCode: "znr", collectorNumber: "280" };
const witness: CardMetadata = { ...sol, scryfallId: "witness-id", name: "Eternal Witness", setCode: "c21", collectorNumber: "185", colorIdentity: ["G"], typeLine: "Creature — Human Shaman", manaValue: 3 };
const guardianship: CardMetadata = { ...sol, scryfallId: "fierce-id", name: "Fierce Guardianship", setCode: "c20", collectorNumber: "35", colorIdentity: ["U"], typeLine: "Instant", manaValue: 3 };
const delver: CardMetadata = { ...sol, scryfallId: "delver-id", name: "Delver of Secrets // Insectile Aberration", setCode: "mid", collectorNumber: "47", colorIdentity: ["U"], typeLine: "Creature — Human Wizard // Creature — Human Insect", cardFaces: [{ name: "Delver of Secrets" }, { name: "Insectile Aberration" }] };

function makeItem(c: CardMetadata, quantity: number, finish: CollectionItem["finish"] = "nonfoil"): CollectionItem {
  const i: CollectionItem = {
    id: "",
    scryfallId: c.scryfallId,
    setCode: c.setCode,
    collectorNumber: c.collectorNumber!,
    finish,
    language: "en",
    condition: "nm",
    binderName: "Main binder",
    binderType: "binder",
    quantityOwned: quantity,
    quantityAssigned: 0,
    quantityUnassigned: quantity,
    sourceRows: [{ Name: c.name, Quantity: String(quantity), "Purchase price": "1.00" }],
  };
  i.id = inventoryKey(i);
  return i;
}
// Owned: Meren, Atraxa, Sol Ring (PIP only), Skullclamp C14 #268, Arcane Signet ×1, Forest in two printings, Tatyova.
function initial(): CollectionState {
  return {
    ...emptyCollection(),
    revision: 1,
    metadata: { ...structuredClone(metadata), [solPip.scryfallId]: solPip, [forestZnr.scryfallId]: forestZnr },
    items: [
      makeItem(meren, 1),
      makeItem(atraxa, 1),
      makeItem(solPip, 1),
      makeItem(skullclamp, 1),
      makeItem(signet, 1),
      makeItem(forest, 2),
      makeItem(forestZnr, 2),
      makeItem(tatyova, 1),
    ],
  };
}
class FakeLookup implements DeckCardLookup {
  calls: DeckIdentifier[][] = [];
  constructor(private cards: CardMetadata[]) {}
  async lookupDeckCards(ids: DeckIdentifier[]) {
    this.calls.push(ids);
    return new Map(
      ids.map((id) => [
        id.key,
        this.cards.find((c) =>
          id.set ? c.setCode === id.set && c.collectorNumber === id.collector_number : c.name === id.name || c.name.split(" // ")[0] === id.name,
        ) || null,
      ]),
    );
  }
}
const signal = new AbortController().signal;
async function preview(text: string, state = initial(), lookup = new FakeLookup([witness, guardianship, delver]), name?: string) {
  const parsed = parseDeckText(text);
  const known = { ...Object.fromEntries(sample.map((c) => [c.scryfallId, c])), ...state.metadata };
  return { p: buildDeckImportPreview(parsed, await resolveDeckLines(parsed, known, lookup, signal), state, { filename: "Meren.txt", name }), state, lookup };
}
const entry = (p: DeckImportPreview, name: string) => p.entries.find((e) => e.name === name)!;
async function setup(state = initial()) {
  const repo = new IndexedDbCollectionRepository(crypto.randomUUID(), new IDBFactory());
  await repo.save(state, 0);
  return { repo, decks: new LocalDeckRepository(repo) };
}
const MEREN_DECK = `Commander
1 Meren of Clan Nel Toth (CMM) 346

Deck
1 Sol Ring (CMM) 410
1 Skullclamp (C14) 268
1 Arcane Signet
1 Eternal Witness
4 Forest
1 Tatyova, Benthic Druid
1 Not A Real Card
x Sol Ring

Sideboard
1 Counterspell`;

describe("ManaBox deck text parsing", () => {
  it("parses quantity, name, set, collector number, sections, blank lines, markers and split/DFC names", () => {
    const parsed = parseDeckText(
      "About\nName Graveyard Stories\n\nCommander\n1 Meren of Clan Nel Toth (CMM) 346\n\nDeck\n1 Sol Ring\n1 Arcane Signet (CMM) 380\n1x Skullclamp (C15) 267\n2 Fire / Ice\n1 Delver of Secrets/// Insectile Aberration (MID) 47\n1 Lightning Bolt *F*\nCreatures (1)\n1 Solemn Simulacrum\nSB: 1 Counterspell\n0 Ponder\n-1 Ponder\nPonder\n",
    );
    expect(parsed.name).toBe("Graveyard Stories");
    expect(parsed.hasCommanderSection).toBe(true);
    expect(parsed.lines.map((l) => [l.quantity, l.name, l.setCode, l.collectorNumber, l.section])).toEqual([
      [1, "Meren of Clan Nel Toth", "cmm", "346", "commander"],
      [1, "Sol Ring", undefined, undefined, "main"],
      [1, "Arcane Signet", "cmm", "380", "main"],
      [1, "Skullclamp", "c15", "267", "main"],
      [2, "Fire // Ice", undefined, undefined, "main"],
      [1, "Delver of Secrets // Insectile Aberration", "mid", "47", "main"],
      [1, "Lightning Bolt", undefined, undefined, "main"],
      [1, "Solemn Simulacrum", undefined, undefined, "main"],
    ]);
    expect(parsed.issues.map((i) => i.line)).toEqual([16, 17, 18, 19]);
    expect(parsed.issues[0].reason).toMatch(/Sideboard row retained/);
    expect(parsed.issues[1].reason).toMatch(/Malformed quantity/);
    expect(parsed.issues[3].reason).toMatch(/Missing quantity/);
    const marker = parseDeckText("1 Atraxa, Praetors' Voice *CMDR*\n1 Sol Ring\n1 Meren of Clan Nel Toth [Commander{top}]");
    expect(marker.lines.filter((l) => l.explicitCommander).map((l) => l.name)).toEqual(["Atraxa, Praetors' Voice", "Meren of Clan Nel Toth"]);
    expect(() => parseDeckText("\n\n")).toThrow(/empty/);
    expect(() => parseDeckText("1 Sol\u0000Ring")).toThrow(/not a text decklist/);
  });
  it("name-only rows resolve from saved canonical metadata without network; unknown names use the lookup", async () => {
    const { p, lookup } = await preview("1 Sol Ring\n1 Arcane Signet\n1 Eternal Witness\n1 Delver of Secrets");
    expect(entry(p, "Sol Ring").requested).toBeUndefined();
    expect(lookup.calls).toEqual([[{ key: "name:eternal witness", name: "Eternal Witness" }, { key: "name:delver of secrets", name: "Delver of Secrets" }]]);
    expect(entry(p, "Delver of Secrets // Insectile Aberration").card.scryfallId).toBe("delver-id");
  });
  it("set + collector-number rows prefer the exact printing and fall back to the name with a visible note", async () => {
    const { p } = await preview("1 Skullclamp (C14) 268\n1 Sol Ring (CMM) 999\n1 Arcane Signet (CMM) 410");
    expect(entry(p, "Skullclamp")).toMatchObject({ requested: { setCode: "c14", collectorNumber: "268" }, status: "exact" });
    expect(entry(p, "Sol Ring").notes[0]).toMatch(/CMM #999 was not found\. Matched by card name/);
    // CMM 410 is Sol Ring, not Arcane Signet: never silently trust the conflicting printing.
    expect(entry(p, "Arcane Signet").notes[0]).toMatch(/is Sol Ring, not Arcane Signet/);
    expect(entry(p, "Arcane Signet").card.name).toBe("Arcane Signet");
  });
});

describe("Commander detection", () => {
  it("uses an explicit Commander section; otherwise lists canonical candidates and requires a choice", async () => {
    const explicit = (await preview(MEREN_DECK)).p;
    expect(initialChoices(explicit).commanders).toEqual([entry(explicit, meren.name).key]);
    const { p, state } = await preview("1 Meren of Clan Nel Toth\n1 Atraxa, Praetors' Voice\n1 Sol Ring\n1 Skullclamp");
    expect(p.defaultCommanders).toEqual([]);
    expect(p.candidates.map((k) => p.entries.find((e) => e.key === k)!.name).sort()).toEqual([atraxa.name, meren.name].sort());
    const choices = initialChoices(p);
    expect(blockingIssues(p, state, choices)).toContain("Select the commander before importing.");
    choices.commanders = [entry(p, meren.name).key];
    expect(blockingIssues(p, state, choices)).toEqual([]);
    expect(() => finalizeDeckImport(p, state, { ...choices, commanders: [] })).toThrow(/Select the commander/);
  });
  it("refuses ineligible explicit commanders and more than two, preserving Partner-style arrays", async () => {
    const bad = (await preview("Commander\n1 Sol Ring\nDeck\n1 Meren of Clan Nel Toth")).p;
    expect(bad.defaultCommanders).toEqual([]);
    expect(bad.warnings[0]).toMatch(/does not allow as a commander/);
    const three = await preview("Commander\n1 Meren of Clan Nel Toth\n1 Atraxa, Praetors' Voice\n1 Tatyova, Benthic Druid\nDeck\n1 Sol Ring");
    expect(three.p.defaultCommanders).toEqual([]);
    expect(three.p.warnings[0]).toMatch(/at most two/);
    const choices = { ...initialChoices(three.p), commanders: three.p.candidates };
    expect(blockingIssues(three.p, three.state, choices).join(" ")).toMatch(/More than two commanders/);
    const pair = await preview("Commander\n1 Meren of Clan Nel Toth\n1 Atraxa, Praetors' Voice\nDeck\n1 Sol Ring");
    const { deck } = finalizeDeckImport(pair.p, pair.state, initialChoices(pair.p), "pair", "2026-01-01T00:00:00.000Z");
    expect(deck.commanders.map((c) => c.name)).toEqual([meren.name, atraxa.name]);
    expect(new Set(deck.commanders.flatMap((c) => c.colorIdentity))).toEqual(new Set(["B", "G", "U", "W"]));
  });
});

describe("Ownership reconciliation", () => {
  it("classifies exact, alternate, allocated, missing and ambiguous rows and summarizes copies", async () => {
    const base = initial();
    // Arcane Signet's only copy belongs to another deck.
    base.decks = [{ id: "other", name: "Other deck", createdAt: "2026-01-01T00:00:00.000Z", modifiedAt: "2026-01-01T00:00:00.000Z", commanders: [{ itemId: base.items[1].id, cardIdentity: "x", scryfallId: atraxa.scryfallId, name: atraxa.name, colorIdentity: [...atraxa.colorIdentity] }], assignments: [{ itemId: base.items[4].id, quantity: 1 }] }];
    base.items[1].quantityAssigned = 1; base.items[1].quantityUnassigned = 0;
    base.items[4].quantityAssigned = 1; base.items[4].quantityUnassigned = 0;
    const { p, state } = await preview(MEREN_DECK, base);
    expect(entry(p, "Skullclamp")).toMatchObject({ status: "exact", available: 1 });
    expect(entry(p, "Sol Ring")).toMatchObject({ status: "alternate", requested: { setCode: "cmm", collectorNumber: "410" } });
    expect(entry(p, "Sol Ring").options[0]).toMatchObject({ setCode: "pip", collectorNumber: "239", exact: false });
    expect(entry(p, "Arcane Signet")).toMatchObject({ status: "allocated", owned: 1, available: 0, usedBy: [{ deckName: "Other deck", quantity: 1 }] });
    expect(entry(p, "Eternal Witness")).toMatchObject({ status: "missing", owned: 0 });
    expect(entry(p, "Forest")).toMatchObject({ status: "ambiguous", suggested: {} });
    const choices = initialChoices(p);
    expect(deckImportSummary(p, choices)).toMatchObject({ total: 10, exact: 2, alternate: 1, allocated: 2, missing: 1, review: 4, colorConflicts: 1, problems: 3 });
    expect(blockingIssues(p, state, choices).join(" ")).toMatch(/1 card need a printing choice/);
    // Choose one Forest of each printing, leaving two unassigned.
    const forestEntry = entry(p, "Forest");
    choices.picks[forestEntry.key] = { [forestEntry.options[0].itemId]: 1, [forestEntry.options[1].itemId]: 1 };
    choices.reviewed.push(forestEntry.key);
    expect(blockingIssues(p, state, choices)).toEqual([]);
    expect(deckImportSummary(p, choices)).toMatchObject({ exact: 4, review: 0, allocated: 4 });
  });
  it("rejects picks beyond availability and never takes copies another deck uses", async () => {
    const { p, state } = await preview("Commander\n1 Meren of Clan Nel Toth\nDeck\n4 Forest");
    const choices = initialChoices(p);
    const f = entry(p, "Forest");
    choices.picks[f.key] = { [f.options[0].itemId]: 3 };
    choices.reviewed.push(f.key);
    expect(blockingIssues(p, state, choices).join(" ")).toMatch(/not enough available copies/);
  });
});

async function importDeck(text: string, mutate: (c: DeckImportChoices, p: DeckImportPreview) => void = () => {}, base = initial()) {
  const { repo, decks } = await setup(base);
  const state = (await repo.load())!;
  const { p } = await preview(text, state);
  const choices = initialChoices(p);
  for (const e of p.entries) if (!choices.reviewed.includes(e.key)) choices.reviewed.push(e.key);
  mutate(choices, p);
  const { deck, metadata: added } = finalizeDeckImport(p, state, choices, "imported", "2026-02-01T00:00:00.000Z");
  const next = await decks.change(state, { type: "import", deck, metadata: added, allowDuplicateName: choices.allowDuplicateName });
  return { repo, decks, before: state, next, deck: next.decks!.find((d) => d.id === "imported")!, p };
}

describe("Confirmed deck import", () => {
  it("assigns exact and suggested copies, imports missing cards without fake ownership and survives reload", async () => {
    const { repo, before, next, deck } = await importDeck(MEREN_DECK);
    expect(deck.entries!.map((e) => [e.name, e.board, e.quantity])).toEqual([
      [meren.name, "commander", 1],
      ["Sol Ring", "main", 1],
      ["Skullclamp", "main", 1],
      ["Arcane Signet", "main", 1],
      ["Eternal Witness", "main", 1],
      ["Forest", "main", 4],
      [tatyova.name, "main", 1],
    ]);
    expect(deck.commanders[0]).toMatchObject({ name: meren.name, itemId: before.items[0].id });
    expect(deckCount(deck)).toBe(10);
    // Meren + Sol Ring (PIP) + Skullclamp + Arcane Signet. Forests left unassigned by review; Tatyova is outside identity.
    expect(deckOwnership(deck)).toEqual({ total: 10, assigned: 4, missing: 6 });
    const missing = missingEntries(next, deck);
    expect(missing.find((m) => m.entry.name === "Eternal Witness")).toMatchObject({ missing: 1, owned: 0, reason: "Missing — not owned" });
    expect(missing.find((m) => m.entry.name === tatyova.name)!.outsideIdentity).toBe(true);
    expect(next.items.some((i) => i.scryfallId === witness.scryfallId)).toBe(false);
    expect(next.metadata[witness.scryfallId].name).toBe("Eternal Witness");
    expect(deck.importIssues!.map((i) => i.text)).toEqual(["1 Not A Real Card", "x Sol Ring", "1 Counterspell"]);
    expect(deckStats(next, deck).counts.Land).toBe(4);
    const reloaded = await new LocalDeckRepository(new IndexedDbCollectionRepository((repo as unknown as { name: string }).name, (repo as unknown as { factory: IDBFactory }).factory)).load();
    expect(reloaded.find((d) => d.id === "imported")).toEqual(deck);
  });
  it("leaves owned quantities, source rows and existing metadata unchanged", async () => {
    const { before, next } = await importDeck(MEREN_DECK);
    expect(next.items.map((i) => [i.id, i.quantityOwned, i.sourceRows])).toEqual(before.items.map((i) => [i.id, i.quantityOwned, i.sourceRows]));
    for (const [id, c] of Object.entries(before.metadata)) expect(next.metadata[id]).toEqual(c);
    expect(next.items.reduce((n, i) => n + i.quantityAssigned, 0)).toBe(4);
    expect(next.lastImport).toEqual(before.lastImport);
  });
  it("does not move a fully allocated copy from another deck", async () => {
    const { repo, decks } = await setup();
    let state = (await repo.load())!;
    state = await decks.change(state, { type: "create", name: "Atraxa", itemId: state.items[1].id });
    state = await decks.change(state, { type: "add", deckId: state.decks![0].id, itemId: state.items[4].id });
    const { p } = await preview("Commander\n1 Meren of Clan Nel Toth\nDeck\n1 Arcane Signet", state);
    expect(entry(p, "Arcane Signet").status).toBe("allocated");
    const choices = initialChoices(p);
    // A forged pick of the allocated copy is refused before and at the repository boundary.
    choices.picks[entry(p, "Arcane Signet").key] = { [state.items[4].id]: 1 };
    expect(blockingIssues(p, state, choices).join(" ")).toMatch(/not enough available copies/);
    const forged = finalizeDeckImport(p, state, initialChoices(p), "forged");
    forged.deck.assignments.push({ itemId: state.items[4].id, quantity: 1, entryId: forged.deck.entries![1].id });
    await expect(decks.change(state, { type: "import", deck: forged.deck, metadata: {}, allowDuplicateName: false })).rejects.toThrow(/No copies are taken from other decks/);
    const ok = finalizeDeckImport(p, state, initialChoices(p), "ok");
    const next = await decks.change(state, { type: "import", deck: ok.deck, metadata: ok.metadata, allowDuplicateName: false });
    expect(next.decks![0].assignments).toEqual(state.decks![0].assignments);
    expect(next.items[4]).toMatchObject({ quantityAssigned: 1, quantityUnassigned: 0 });
    expect(missingEntries(next, next.decks![1])[0].reason).toMatch(/all owned copies are assigned/);
  });
  it("never overwrites a deck with the same name; Import as new deck creates a separate deck", async () => {
    const { repo, decks } = await setup();
    let state = (await repo.load())!;
    state = await decks.change(state, { type: "create", name: "Graveyard Stories", itemId: state.items[1].id });
    const { p } = await preview("Commander\n1 Meren of Clan Nel Toth\nDeck\n1 Skullclamp", state, undefined, "graveyard stories");
    const choices = initialChoices(p);
    expect(blockingIssues(p, state, choices).join(" ")).toMatch(/already exists/);
    const { deck } = finalizeDeckImport(p, state, { ...choices, allowDuplicateName: true }, "second");
    await expect(decks.change(state, { type: "import", deck, metadata: {}, allowDuplicateName: false })).rejects.toThrow(/never overwritten/);
    const next = await decks.change(state, { type: "import", deck, metadata: {}, allowDuplicateName: true });
    expect(next.decks!.map((d) => [d.id === "second", d.name, deckCount(d)])).toEqual([
      [false, "Graveyard Stories", 1],
      [true, "graveyard stories", 2],
    ]);
    expect(next.decks![0]).toEqual(state.decks![0]);
  });
  it("surfaces color identity conflicts and assigns no copy to them", async () => {
    const { p, state } = await preview("Commander\n1 Meren of Clan Nel Toth\nDeck\n1 Tatyova, Benthic Druid\n1 Fierce Guardianship\n1 Sol Ring");
    const choices = initialChoices(p);
    expect(colorConflicts(p, choices).map((e) => e.name)).toEqual([tatyova.name, "Fierce Guardianship"]);
    const { deck } = finalizeDeckImport(p, state, choices, "c");
    expect(deck.assignments.map((a) => state.items.find((i) => i.id === a.itemId)!.scryfallId)).toEqual([solPip.scryfallId]);
  });
  it("editor additions fill missing entries; missing entries can be removed; collection clear keeps decklist metadata", async () => {
    const { repo, decks, next, deck } = await importDeck(MEREN_DECK);
    const forestItem = next.items.find((i) => i.scryfallId === forest.scryfallId)!;
    const filled = await decks.change(next, { type: "add", deckId: deck.id, itemId: forestItem.id });
    const after = filled.decks!.find((d) => d.id === deck.id)!;
    expect(deckCount(after)).toBe(10);
    expect(deckOwnership(after).assigned).toBe(5);
    expect(after.assignments.at(-1)).toMatchObject({ itemId: forestItem.id, entryId: deck.entries![5].id });
    const removed = await decks.change(filled, { type: "remove-missing", deckId: deck.id, entryId: deck.entries![4].id });
    expect(removed.decks!.find((d) => d.id === deck.id)!.entries!.some((e) => e.name === "Eternal Witness")).toBe(false);
    const released = await decks.change(removed, { type: "remove", deckId: deck.id, itemId: forestItem.id });
    expect(released.decks!.find((d) => d.id === deck.id)!.entries!.find((e) => e.name === "Forest")!.quantity).toBe(3);
    expect(released.items.find((i) => i.id === forestItem.id)!.quantityOwned).toBe(2);
    await expect(changeCollection(repo, released, { type: "clear" })).rejects.toThrow(/assigned to decks/);
  });
  it("an unowned commander is a decklist entry without an assigned copy and blocks no clear", async () => {
    const base = initial();
    base.items = base.items.filter((i) => i.scryfallId !== meren.scryfallId);
    const { repo, deck, next } = await importDeck("Commander\n1 Meren of Clan Nel Toth\nDeck\n1 Eternal Witness", () => {}, base);
    expect(deck.commanders[0].itemId).toBeUndefined();
    expect(deckOwnership(deck)).toEqual({ total: 2, assigned: 0, missing: 2 });
    const cleared = await changeCollection(repo, next, { type: "clear" });
    expect(cleared.items).toEqual([]);
    expect(cleared.decks![0].entries!.length).toBe(2);
    expect(validateState(await repo.load())).toBeTruthy();
  });
  it("collection re-import keeps imported deck entries and assignments", async () => {
    const { next, deck } = await importDeck("Commander\n1 Meren of Clan Nel Toth (CMM) 346\nDeck\n1 Eternal Witness");
    const parsed = parseManaBox(exportCsv([fixtureRow(meren, 1)]));
    const results = new Map(parsed.rows.map((r) => [`id:${r.scryfallId}`, { card: metadata[r.scryfallId] }]));
    const plan = buildImportPlan(parsed, { results, nameMatches: {} }, next, "again.csv");
    expect(plan.next.decks).toEqual(next.decks);
    expect(validateState(plan.next).decks![0]).toEqual(deck);
  });
  it("validation rejects entries with more assigned copies than listed and dangling entry links", async () => {
    const { next } = await importDeck(MEREN_DECK);
    const over = structuredClone(next);
    over.decks![0].entries![2].quantity = 0;
    expect(() => validateState(over)).toThrow(/decklist entry/);
    const dangling = structuredClone(next);
    dangling.decks![0].assignments[0].entryId = "nope";
    expect(() => validateState(dangling)).toThrow(/assignment is inconsistent/);
    const exceed = structuredClone(next);
    exceed.decks![0].entries![1].quantity = 1;
    exceed.decks![0].assignments.find((a) => a.entryId === exceed.decks![0].entries![1].id)!.quantity = 2;
    expect(() => validateState(exceed)).toThrow();
  });
});

describe("Scryfall deck lookup", () => {
  const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  it("batches printings and names, honours not_found and caches successes", async () => {
    const fetcher = vi.fn(async (_: RequestInfo | URL, init?: RequestInit) => {
      const ids = JSON.parse(String(init!.body)).identifiers as { name?: string; set?: string }[];
      return response({ data: ids.filter((i) => i.name === "Eternal Witness").map(() => apiCard(witness)), not_found: ids.filter((i) => i.name !== "Eternal Witness") });
    });
    const client = new ScryfallClient(fetcher as typeof fetch, 0, { sleep: async () => {} });
    const ids = [{ key: "name:eternal witness", name: "Eternal Witness" }, { key: "name:nope", name: "Nope" }];
    const found = await client.lookupDeckCards(ids, signal, () => {});
    expect(found.get("name:eternal witness")!.name).toBe("Eternal Witness");
    expect(found.get("name:nope")).toBeNull();
    await client.lookupDeckCards(ids, signal, () => {});
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("service failure is an interruption, not a problem row", async () => {
    const client = new ScryfallClient(vi.fn(async () => response({}, 503)) as unknown as typeof fetch, 0, { attempts: 2, sleep: async () => {} });
    const parsed = parseDeckText("1 Eternal Witness");
    await expect(resolveDeckLines(parsed, {}, client, signal)).rejects.toBeInstanceOf(LookupInterrupted);
  });
});
