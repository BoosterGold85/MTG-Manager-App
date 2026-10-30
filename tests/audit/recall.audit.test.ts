import { it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { runCorpus } from "./recall/harness";
it("records the fixed recall corpus without treating unavailable canonical text as engine misses", () => {
  const report = runCorpus();
  if (process.env.RECALL_OUT)
    writeFileSync(
      process.env.RECALL_OUT,
      JSON.stringify(report, null, 2) + "\n",
    );
  expect(report.total).toBe(12);
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
