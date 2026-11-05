import { describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { deckCoverage } from "../../src/deckIntelligence/coverage";
import { deckIntelligence, explainCandidate } from "../../src/deckIntelligence/analysis";
import { ScryfallClient, normalizeCard } from "../../src/import/scryfall";
import { LocalDeckRepository } from "../../src/storage/deckRepository";
import { IndexedDbCollectionRepository, validateState } from "../../src/storage/collectionRepository";
import { parseDeckText } from "../../src/decks/deckText";
import { buildDeckImportPreview, resolveDeckLines, finalizeDeckImport, initialChoices } from "../../src/decks/deckImport";
import { intelligenceFixture } from "../deckIntelligenceFixture";
import { legacyFixture } from "../legacyFixture";
import { legacyCandidates } from "../../src/standard/engine";
import { formatWarnings } from "../../src/decks/formats";
import { apiCard } from "../importFixtures";

describe("printing, Oracle, mechanics, legality and inventory remain separate", () => {
  it("independently audits both boards without requiring ownership or fresh legality", () => {
    const f = intelligenceFixture(); f.deck.entries![1].board = "sideboard";
    f.cards[0].legalities = { legacy: "banned" }; f.cards[1].legalities = undefined;
    const before = structuredClone(f.state), report = deckCoverage(f.state, f.deck);
    expect(report.entries).toHaveLength(3); expect(report.total).toBe(3);
    expect(report.entries[0]).toMatchObject({ printing: "exact", oracle: "available", owned: 0, allocated: 0, legality: { status: "banned" } });
    expect(report.entries[1]).toMatchObject({ oracle: "available", legality: { status: "unverified", freshness: "unverified" } });
    expect(f.state).toEqual(before);
  });
  it("retains unresolved requested printing and finish while using canonical mechanics", () => {
    const f = intelligenceFixture(); f.deck.entries![0].requestedPrinting = { setCode: "bad", collectorNumber: "999", finish: "foil" };
    const r = deckCoverage(f.state, f.deck).entries[0];
    expect(r).toMatchObject({ printing: "canonical-fallback", oracle: "available", finish: "unverified" });
    expect(r.explanations.join(" ")).toContain("Requested printing is unresolved");
    expect(f.deck.entries![0].requestedPrinting.setCode).toBe("bad");
  });
  it("does not promote mismatched names or ambiguous names to exact resolution", () => {
    const f = intelligenceFixture(); f.deck.entries![0].name = "Unknown name";
    expect(deckCoverage(f.state, f.deck).entries[0]).toMatchObject({ printing: "unresolved", status: "unresolved" });
    const duplicate = { ...f.cards[1], scryfallId: "different-card", oracleId: "different-oracle" };
    f.state.metadata = { ...f.state.metadata, [duplicate.scryfallId]: duplicate };
    f.deck.entries![1].scryfallId = "absent"; f.deck.entries![1].requestedPrinting = undefined;
    expect(deckCoverage(f.state, f.deck).entries[1].status).toBe("unresolved");
  });
  it("distinguishes missing Oracle data, valid vanilla, and unsupported abilities", () => {
    const f = intelligenceFixture();
    f.state.metadata = Object.fromEntries(f.cards.map((c, i) => [c.scryfallId, { ...c, cardFaces: undefined, oracleText: i === 0 ? undefined : i === 1 ? "" : "Each player secretly chooses a number, then reveals it.", typeLine: "Creature — Human", keywords: [] }]));
    const r = deckCoverage(f.state, f.deck);
    expect(r.entries[0]).toMatchObject({ status: "unverified", oracle: "missing" });
    expect(r.entries[1]).toMatchObject({ status: "full", mechanical: { state: "vanilla" } });
    expect(r.entries[2]).toMatchObject({ status: "partial", mechanical: { state: "unsupported" } });
    expect(r.counts).toMatchObject({ full: { entries: 1 }, partial: { entries: 1 }, unverified: { entries: 1 } });
  });
  it("does not manufacture complete Oracle text from incomplete card faces", () => {
    const f = intelligenceFixture(), raw = { ...apiCard(f.cards[0]), object: "card" as const, card_faces: [{ name: "Front", type_line: "Creature", oracle_text: "Vigilance" }, { name: "Back", type_line: "Creature" }] };
    delete (raw as { oracle_text?: string }).oracle_text;
    const card = normalizeCard(raw as unknown as Parameters<typeof normalizeCard>[0]); expect(card.oracleText).toBeUndefined();
    f.state.metadata = { ...f.state.metadata, [card.scryfallId]: card };
    expect(deckCoverage(f.state, f.deck).entries[0].oracle).toBe("missing");
  });
  it("aggregates foil/nonfoil canonical copies but preserves each printing entry", () => {
    const f = intelligenceFixture(), entry = f.deck.entries![0]; entry.quantity = 2;
    f.deck.entries!.push({ ...entry, id: "foil", board: "sideboard", quantity: 2, requestedPrinting: { ...entry.requestedPrinting!, finish: "foil" } });
    const r = deckCoverage(f.state, f.deck), group = r.groups.find(g => g.name === entry.name)!;
    expect(r.entries).toHaveLength(4); expect(group).toMatchObject({ main: 2, sideboard: 2, entries: [entry.id, "foil"] });
    expect(r.entries[3].entry.requestedPrinting?.finish).toBe("foil");
    expect(r.entries[3].finish).toBe("verified");
  });
  it("flags impossible finish separately from valid Oracle text", () => {
    const f = intelligenceFixture(); f.cards[0].supportedFinishes = ["nonfoil"]; f.deck.entries![0].requestedPrinting!.finish = "etched";
    expect(deckCoverage(f.state, f.deck).entries[0]).toMatchObject({ finish: "unavailable", oracle: "available" });
  });
  it("legality failures remain unverified and Legacy warnings never mention rotation", () => {
    const f = intelligenceFixture(); f.cards[0].legalityCheckedAt = "2000-01-01";
    f.deck.entries![1].scryfallId = "unknown-printing";
    const warnings = formatWarnings(f.state, f.deck).join(" ");
    expect(warnings).toContain("unresolved metadata"); expect(warnings).toContain("ban/eligibility"); expect(warnings).not.toContain("rotation");
    expect(deckCoverage(f.state, f.deck).entries[0].legality.freshness).toBe("stale");
  });
  it("aggregates alternate printing IDs with one Oracle identity", () => {
    const f = intelligenceFixture(), alternate = { ...f.cards[0], scryfallId: "alternate", collectorNumber: "999" };
    f.state.metadata = { ...f.state.metadata, alternate };
    f.deck.entries!.push({ ...f.deck.entries![0], id: "alternate-entry", scryfallId: alternate.scryfallId, quantity: 3, requestedPrinting: { setCode: alternate.setCode, collectorNumber: "999", finish: "foil" } });
    const r = deckCoverage(f.state, f.deck);
    expect(r.groups).toHaveLength(3); expect(r.groups.find(g => g.name === alternate.name)?.main).toBe(4);
    expect(r.entries[3]).toMatchObject({ printing: "exact", entry: { scryfallId: "alternate" } });
  });
  it("does not label unallocated basic lands as missing rules", () => {
    const f = legacyFixture(), r = deckCoverage(f.state, f.deck).entries.find(r => r.entry.id === "land")!;
    expect(r).toMatchObject({ basic: true, allocated: 0, status: "full" });
    expect(r.entry.quantity).toBe(24);
  });
  it("retains foil/nonfoil source rows separately through deck import", async () => {
    const f = intelligenceFixture(), card = f.cards[0];
    const parsed = parseDeckText(`1 ${card.name} (${card.setCode}) ${card.collectorNumber} *NF*\n1 ${card.name} (${card.setCode}) ${card.collectorNumber} *F*`, true);
    const resolved = await resolveDeckLines(parsed, f.state.metadata, { lookupDeckCards: vi.fn() }, new AbortController().signal);
    const preview = buildDeckImportPreview(parsed, resolved, f.state, { format: "legacy" });
    expect(preview.entries).toHaveLength(2); expect(preview.entries[1].requested?.finish).toBe("foil");
    expect(preview.entries[0].requested?.finish).toBe("nonfoil");
    const choices = initialChoices(preview); choices.name = "Printing audit";
    const result = finalizeDeckImport(preview, f.state, choices);
    expect(result.deck.entries).toHaveLength(2);
    expect(result.deck.entries?.[1].requestedPrinting?.finish).toBe("foil");
  });
  it("retains finish-only variants when an export has no set or collector number", async () => {
    const f = intelligenceFixture(), card = f.cards[0], parsed = parseDeckText(`1 ${card.name} *NF*\n1 ${card.name} *F*`, true);
    const resolved = await resolveDeckLines(parsed, f.state.metadata, { lookupDeckCards: vi.fn() }, new AbortController().signal);
    const preview = buildDeckImportPreview(parsed, resolved, f.state, { format: "legacy", name: "Finish-only import" });
    const result = finalizeDeckImport(preview, f.state, initialChoices(preview));
    expect(result.deck.entries?.map(e => e.requestedFinish)).toEqual(["nonfoil", "foil"]);
    expect(deckCoverage({ ...f.state, metadata: { ...f.state.metadata, ...result.metadata } }, result.deck).entries.map(e => e.finish)).toEqual(["verified", "verified"]);
  });
});

describe("evidence-backed goals and interactions", () => {
  it("Vision of Love can discard Carnage for Mayhem, with costs, option and timing restrictions", () => {
    const f = intelligenceFixture(), report = deckIntelligence(f.state, f.deck);
    const link = report.chains.find(c => c.mechanism === "Discard → Mayhem" && c.evidence.some(e => e.name === "Vision of Love"))!;
    expect(link).toBeDefined(); expect(link.status).toBe("conditional");
    expect(link.explanation).toContain("Carnage, Crimson Chaos");
    expect(link.restrictions.join(" ")).toMatch(/\{B\}\{R\}/); expect(link.restrictions.join(" ")).toMatch(/Normal timing|main phase/);
    expect(link.restrictions.join(" ")).toContain("Choose the discard option");
    expect(link.evidence[0].text).toBe(f.cards[0].oracleText);
    expect(report.goals.some(g => g.label === "Discard / Mayhem")).toBe(true);
  });
  it("Diresight surveilling Carnage does not enable Mayhem", () => {
    const f = intelligenceFixture(), report = deckIntelligence(f.state, f.deck);
    expect(report.chains.some(c => c.mechanism === "Discard → Mayhem" && c.evidence.some(e => e.name === "Diresight"))).toBe(false);
    expect(report.chains.find(c => c.status === "rule-conflict")?.explanation).toContain("is not discarding it from hand");
  });
  it("an active graveyard-casting prohibition genuinely conflicts with Mayhem permission", () => {
    const f = intelligenceFixture(), cage = { ...f.cards[0], name: "Casting prohibition", scryfallId: "prohibition", oracleId: "prohibition", typeLine: "Artifact", oracleText: "Players can't cast spells from graveyards or libraries." };
    const g = intelligenceFixture([...f.cards, cage]);
    const conflict = deckIntelligence(g.state, g.deck).chains.find(c => c.mechanism === "Graveyard casting prohibited");
    expect(conflict?.status).toBe("rule-conflict"); expect(conflict?.explanation).toContain("permission cannot override a prohibition");
  });
  it("opponent discard and discard observers cannot enable your Mayhem", () => {
    const f = intelligenceFixture(); f.state.metadata = Object.fromEntries(f.cards.map((c, i) => [c.scryfallId, i === 0 ? { ...c, oracleText: "Target opponent discards a card." } : i === 1 ? { ...c, oracleText: "Whenever you discard a card, draw a card." } : c]));
    expect(deckIntelligence(f.state, f.deck).chains.some(c => c.mechanism === "Discard → Mayhem")).toBe(false);
  });
  it("restricted discard and unknown data are not confidently interpreted", () => {
    const f = intelligenceFixture(); f.state.metadata = Object.fromEntries(f.cards.map((c, i) => [c.scryfallId, i === 0 ? { ...c, oracleText: "Discard a land card, then draw a card." } : c]));
    const r = deckIntelligence(f.state, f.deck);
    expect(r.chains.some(c => c.mechanism === "Discard → Mayhem")).toBe(false);
    expect(r.chains.some(c => c.status === "unresolved")).toBe(true);
    f.state.metadata = Object.fromEntries(f.cards.map(c => [c.scryfallId, { ...c, oracleText: undefined }]));
    expect(deckIntelligence(f.state, f.deck)).toMatchObject({ adequate: false, goals: [], chains: [] });
  });
  it("main-deck inference excludes sideboard-only enablers", () => {
    const f = intelligenceFixture(); f.deck.entries![0].board = "sideboard";
    expect(deckIntelligence(f.state, f.deck).goals.some(g => g.label === "Discard / Mayhem")).toBe(false);
  });
  it("three-mana recursion targets exclude four-mana creatures and require the graveyard", () => {
    const f = intelligenceFixture(), carnage = f.cards[2], small = { ...carnage, name: "Small target", scryfallId: "small", oracleId: "small", manaValue: 2, oracleText: "Vigilance", keywords: ["Vigilance"] }, large = { ...small, name: "Large target", scryfallId: "large", oracleId: "large", manaValue: 4 };
    const g = intelligenceFixture([...f.cards, small, large]), chains = deckIntelligence(g.state, g.deck).chains.filter(c => c.mechanism === "Graveyard creature target");
    expect(chains.some(c => c.evidence[0].name === small.name)).toBe(true); expect(chains.some(c => c.evidence[0].name === large.name)).toBe(false);
    expect(chains[0].restrictions.join(" ")).toContain("target must remain legal");
  });
  it("upgrade previews show deterministic coverage and relationship losses without mutation", () => {
    const f = intelligenceFixture(), candidate = { ...f.cards[0], name: "Unrelated card", scryfallId: "candidate", oracleId: "candidate", oracleText: "Scry 1." }, before = structuredClone(f.state);
    const result = explainCandidate(f.state, f.deck, candidate, "entry:0", 1);
    expect(result.lost.some(c => c.mechanism === "Discard → Mayhem")).toBe(true); expect(result.after).toBeDefined(); expect(f.state).toEqual(before);
  });
  it("refreshing one metadata object invalidates its proofs without keeping stale Mayhem links", () => {
    const f = intelligenceFixture(); expect(deckIntelligence(f.state, f.deck).chains.some(c => c.mechanism === "Discard → Mayhem")).toBe(true);
    f.state.metadata = { ...f.state.metadata, [f.cards[0].scryfallId]: { ...f.cards[0], oracleText: "Draw a card." } };
    expect(deckIntelligence(f.state, f.deck).chains.some(c => c.mechanism === "Discard → Mayhem")).toBe(false);
  });
});

describe("targeted refresh and persistence", () => {
  it("keeps successful answers and reports per-card partial failures; retries use fresh responses", async () => {
    const f = intelligenceFixture(), raw = apiCard(f.cards[0]);
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [raw], not_found: [{ id: f.cards[1].scryfallId }] }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: [], not_found: [{ name: f.cards[1].name }] }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: [apiCard(f.cards[1])] })));
    const client = new ScryfallClient(fetcher, 0), ids = f.deck.entries!.slice(0, 2).map(e => ({ key: e.id, name: e.name, scryfallId: e.scryfallId }));
    const result = await client.refreshDeckMetadata(ids, new AbortController().signal);
    expect(result.resolved).toEqual({ "entry:0": f.cards[0].scryfallId }); expect(result.issues["entry:1"]).toBeTruthy();
    const retry = await client.refreshDeckMetadata([ids[1]], new AbortController().signal);
    expect(retry.resolved["entry:1"]).toBe(f.cards[1].scryfallId); expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("preserves a valid first answer when later response data is incomplete", async () => {
    const f = intelligenceFixture(), fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [apiCard(f.cards[0])] }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })));
    const result = await new ScryfallClient(fetcher, 0).refreshDeckMetadata(f.deck.entries!.map(e => ({ key: e.id, name: e.name, scryfallId: e.scryfallId })), new AbortController().signal);
    expect(Object.keys(result.resolved)).toEqual(["entry:0"]); expect(Object.keys(result.issues)).toEqual(["entry:1", "entry:2"]);
  });
  it("saves intent across metadata refresh without changing quantities, ownership or assignments", async () => {
    const f = legacyFixture(), repo = new IndexedDbCollectionRepository(crypto.randomUUID(), new IDBFactory()); await repo.save(f.state, 0);
    const decks = new LocalDeckRepository(repo), intent = await decks.change(f.state, { type: "deck-intent", deckId: f.deck.id, plan: "My custom value plan", target: "competitive" });
    const next = await decks.change(intent, { type: "deck-metadata", deckId: f.deck.id, metadata: { [f.weak.scryfallId]: { ...f.weak, oracleText: "Draw two cards." } }, resolved: { weak: f.weak.scryfallId } });
    validateState(next); expect(next.decks![0].intelligenceIntent).toEqual({ plan: "My custom value plan", target: "competitive" });
    expect(next.decks![0].entries).toEqual(f.deck.entries); expect(next.decks![0].assignments).toEqual(f.deck.assignments); expect(next.items).toEqual(f.state.items);
    expect((await repo.load())?.decks?.[0].intelligenceIntent).toEqual(next.decks![0].intelligenceIntent);
  });
  it("incomplete refreshes retain good Oracle text and finish metadata, and reject mismatched cards atomically", async () => {
    const f = intelligenceFixture(), repo = new IndexedDbCollectionRepository(crypto.randomUUID(), new IDBFactory()); await repo.save(f.state, 0);
    const decks = new LocalDeckRepository(repo), card = { ...f.cards[0], oracleText: undefined, supportedFinishes: undefined };
    const next = await decks.change(f.state, { type: "deck-metadata", deckId: f.deck.id, metadata: { [card.scryfallId]: card }, resolved: { "entry:0": card.scryfallId } });
    expect(next.metadata[card.scryfallId].oracleText).toBe(f.cards[0].oracleText); expect(next.metadata[card.scryfallId].supportedFinishes).toEqual(f.cards[0].supportedFinishes);
    await expect(decks.change(next, { type: "deck-metadata", deckId: f.deck.id, metadata: { [f.cards[1].scryfallId]: f.cards[1] }, resolved: { "entry:0": f.cards[1].scryfallId } })).rejects.toThrow("Deck changed");
    expect(await repo.load()).toEqual(next);
  });
  it("canonical refresh does not silently substitute a different printing reference", async () => {
    const f = intelligenceFixture(), repo = new IndexedDbCollectionRepository(crypto.randomUUID(), new IDBFactory()); await repo.save(f.state, 0);
    const card = { ...f.cards[0], scryfallId: "fallback", collectorNumber: "999" };
    const next = await new LocalDeckRepository(repo).change(f.state, { type: "deck-metadata", deckId: f.deck.id, metadata: { fallback: card }, resolved: { "entry:0": "fallback" } });
    expect(next.decks![0].entries).toEqual(f.deck.entries); expect(next.metadata.fallback).toEqual(card);
  });
  it("manual goals and optimization target leave existing Plan Fit and Brew Score unchanged", () => {
    const f = legacyFixture(), before = legacyCandidates(f.state, f.deck).candidates.map(c => ({ id: c.itemId, fit: c.score, brew: c.brew }));
    const deck = { ...f.deck, intelligenceIntent: { plan: "My chosen competitive plan", target: "competitive" as const } };
    expect(legacyCandidates(f.state, deck).candidates.map(c => ({ id: c.itemId, fit: c.score, brew: c.brew }))).toEqual(before);
  });
});
