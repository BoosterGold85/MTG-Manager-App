import { it, expect, vi } from "vitest";
import { writeFileSync, readFileSync } from "node:fs";
import { runCorpus } from "./recall/harness";
it("records the fixed recall corpus without treating unavailable canonical text as engine misses", () => {
  const reviews = process.env.RECALL_REVIEWS
    ? JSON.parse(readFileSync(process.env.RECALL_REVIEWS, "utf8")).reviews
    : [];
  const fetch = vi.fn(() => {
    throw new Error("Frozen evaluation must not access the network");
  });
  vi.stubGlobal("fetch", fetch);
  let report: ReturnType<typeof runCorpus>;
  try {
    report = runCorpus(reviews);
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
  if (process.env.RECALL_OUT)
    writeFileSync(
      process.env.RECALL_OUT,
      JSON.stringify(report, null, 2) + "\n",
    );
  expect(report.total).toBe(12);
  expect(report.evaluated).toBe(12);
  expect(report.metricsValid).toBe(true);
  expect(report.rejectedSnapshots).toEqual([]);
  const expected = report.results.flatMap(r => r.status === "evaluated" ? r.expected : []);
  expect(expected.filter(r => r.kind !== "trap").every(r => r.generated)).toBe(true);
  expect(expected.filter(r => r.kind === "obvious" && r.hit).length).toBeGreaterThanOrEqual(15);
  expect(expected.filter(r => r.kind === "hidden" && r.hit).length).toBeGreaterThanOrEqual(13);
  expect(expected).toHaveLength(72);
  const traps = expected.filter(r => r.kind === "trap");
  expect(traps.filter(r => !r.hit).length / traps.length).toBeGreaterThanOrEqual(0.9);
  console.log(
    JSON.stringify(
      {
        evaluated: report.evaluated,
        total: report.total,
        candidatePool: report.candidatePool,
        metricsValid: report.metricsValid,
        coverage: report.results.map((r) => ({
          deck: r.deck,
          missing: r.missingOracle.length,
        })),
      },
      null,
      2,
    ),
  );
}, 300000);
