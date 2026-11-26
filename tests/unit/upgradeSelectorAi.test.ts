import { describe, expect, it, vi } from "vitest";
import fixture from "../fixtures/upgradeSelector.json";
import { buildAiPrompt, parseAiReview, runAiReview } from "../../src/upgradeSelector/aiReview";
import { findUpgradeSelections, type DeckCardInput, type SelectorCard } from "../../src/upgradeSelector/scoring";

const all = Object.values(fixture.decks).flat() as unknown as SelectorCard[];
const card = (name: string) => all.find((c) => c.name === name)!;
const deckCards: SelectorCard[] = ["Hardened Scales", "Unsummon", "Forest", "Mistmeadow Witch"].map(card);
const deckInput: DeckCardInput[] = deckCards.map((c) => ({ card: c, quantity: 1, commander: false }));
const result = findUpgradeSelections({ deckCards: deckInput, candidates: [card("Fertilid")], commanderIdentity: ["G"] });
const allowed = { deckNames: new Set(deckCards.map((c) => c.name)), candidateNames: new Set(["Fertilid"]) };
const valid = {
  theme: "Counters and bounce.",
  swaps: [{ out: "Unsummon", in: "Fertilid", reason: "Adds a counter-fed ability." }],
  nicheGem: { name: "Fertilid", steps: ["Enter with two counters.", "Remove one to search for a land."] },
  howItPlays: "Grow the board and ramp.",
};

describe("AI review layer", () => {
  it("makes no request when no provider is configured", async () => {
    const prompt = buildAiPrompt({ deckName: "Test", deckCards, result });
    expect(await runAiReview(null, prompt)).toEqual({ status: "not-configured" });
  });

  it("builds a prompt from oracle text and scores only", () => {
    const { messages } = buildAiPrompt({ deckName: "Test", deckCards, result });
    expect(messages.user).toContain("Remove a +1/+1 counter");
    expect(messages.user).toContain("Fertilid: total");
    expect(messages.system).toMatch(/Use only the oracle text/);
  });

  it("accepts a response that names only deck and candidate cards", () => {
    expect(parseAiReview(valid, allowed)).toEqual(valid);
  });

  it("rejects a swap that cuts a card not in the deck", () => {
    const reply = { ...valid, swaps: [{ out: "Black Lotus", in: "Fertilid", reason: "x" }] };
    expect(parseAiReview(reply, allowed)).toMatch(/not in the deck/);
  });

  it("rejects a swap or niche gem outside the candidate list", () => {
    expect(parseAiReview({ ...valid, swaps: [{ out: "Unsummon", in: "Skirge Familiar", reason: "x" }] }, allowed)).toMatch(/not in the candidates/);
    expect(parseAiReview({ ...valid, nicheGem: { name: "Skirge Familiar", steps: ["a"] } }, allowed)).toMatch(/not a candidate/);
  });

  it("rejects malformed steps and oversized text", () => {
    expect(parseAiReview({ ...valid, nicheGem: { name: "Fertilid", steps: [] } }, allowed)).toMatch(/no valid steps/);
    expect(parseAiReview({ ...valid, howItPlays: "x".repeat(601) }, allowed)).toMatch(/no play summary/);
    expect(parseAiReview("not json object", allowed)).toMatch(/not an object/);
  });

  it("turns a provider failure into a rejection without touching computed results", async () => {
    const provider = { complete: vi.fn(async () => { throw new Error("network"); }) };
    const outcome = await runAiReview(provider, buildAiPrompt({ deckName: "Test", deckCards, result }));
    expect(outcome.status).toBe("rejected");
    expect(provider.complete).toHaveBeenCalledTimes(1);
  });
});
