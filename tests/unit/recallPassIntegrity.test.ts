import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { classificationCounts } from "../audit/recall/model";
import type { FailureReview } from "../audit/recall/model";
type Judgment = { deck: string; candidate: string; baselineRank: number; label: string; rationale: string };
const read = <T>(path: string): T => JSON.parse(readFileSync(new URL(path,import.meta.url),"utf8"));
it("preserves every original precision judgment when a pair remains in the post-fix rankings", () => {
  const before = read<{reviews:Judgment[]}>("../audit/recall/reviews/precision-review.json");
  const after = read<{reviews:Judgment[]}>("../audit/recall/reviews/precision-after.json");
  expect(after.reviews).toHaveLength(240);
  const prior = new Map(before.reviews.map(r=>[JSON.stringify([r.deck,r.candidate]),r]));
  for (const row of after.reviews) {
    const original=prior.get(JSON.stringify([row.deck,row.candidate]));
    if (original) {
      expect(row.label).toBe(original.label);
      expect(row.rationale).toBe(original.rationale);
    }
    expect(row.rationale.length).toBeGreaterThan(20);
  }
});
it("covers each remaining expected miss exactly once and reviews the actual post-fix top twenty", () => {
  const report=read<{results:{deck:string;expected:{deck:string;candidate:string;kind:string;hit:boolean}[];candidates:{name:string}[]}[]}>("../../docs/recall/completed-results.json");
  const reviews=read<{reviews:FailureReview[]}>("../audit/recall/reviews/failure-after.json").reviews;
  const missed=report.results.flatMap(d=>d.expected.filter(e=>e.kind!=="trap"&&!e.hit));
  const result=classificationCounts(missed,reviews);
  expect(result.pending).toEqual([]);
  expect(result.reviewed).toBe(missed.length);
  const precision=read<{reviews:Judgment[]}>("../audit/recall/reviews/precision-after.json").reviews;
  const actual=report.results.flatMap(d=>d.candidates.map((c,i)=>JSON.stringify([d.deck,c.name,i+1]))).sort();
  expect(precision.map(r=>JSON.stringify([r.deck,r.candidate,r.baselineRank])).sort()).toEqual(actual);
});
