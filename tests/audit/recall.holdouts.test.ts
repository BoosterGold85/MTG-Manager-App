import { it, expect, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { runRealHoldouts } from "./recall/realHoldouts";
it("evaluates four historical user decks and seven frozen unseen public decks offline", () => {
  const fetch = vi.fn(() => {
    throw new Error("Frozen holdouts must not access the network");
  });
  vi.stubGlobal("fetch", fetch);
  let results: ReturnType<typeof runRealHoldouts>;
  try {
    results = runRealHoldouts();
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
  expect(results).toHaveLength(11);
  for (const r of results) {
    expect(r.deckCards).toBe(100);
    expect(r.top20).toHaveLength(20);
  }
  if (process.env.RECALL_HOLDOUT_OUT)
    writeFileSync(
      process.env.RECALL_HOLDOUT_OUT,
      JSON.stringify({ baseline: "0f90fff", results }, null, 2) + "\n",
    );
}, 300000);
