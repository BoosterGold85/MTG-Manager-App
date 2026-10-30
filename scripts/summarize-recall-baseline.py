"""Publish compact, reproducible offline evidence; never modifies engine or labels.

Usage: python3 scripts/summarize-recall-baseline.py BASELINE_JSON HOLDOUT_JSON
Generate inputs using the commands in docs/RECOMMENDATION-RECALL-BASELINE.md.
"""
import json
import hashlib
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
baseline = json.loads(Path(sys.argv[1]).read_text())
holdouts = json.loads(Path(sys.argv[2]).read_text())
precision = json.loads((ROOT / "tests/audit/recall/reviews/precision-review.json").read_text())
assert baseline["metricsValid"] and baseline["evaluated"] == 12
assert baseline["classification"]["reviewed"] == 29
assert len(holdouts["results"]) == 11
assert precision["canonicalSnapshotHash"] == baseline["snapshotHashes"]["cards.scryfall.json"]
expected_review_keys = {
    (d["deck"], row["name"], rank)
    for d in baseline["results"]
    for rank, row in enumerate(d["candidates"], 1)
}
actual_review_keys = {(r["deck"], r["candidate"], r["baselineRank"]) for r in precision["reviews"]}
assert len(precision["reviews"]) == 240 and actual_review_keys == expected_review_keys
rows = [row for deck in baseline["results"] for row in deck["expected"]]
summary = {
    "baseline": baseline["baseline"],
    "primaryOrdering": "Existing production Brew ordering, frozen before capture; no scoring changes",
    "secondaryOrdering": "Production Explore Synergy; diagnostic only, never substituted for primary",
    "snapshotHashes": baseline["snapshotHashes"],
    "expectationsHash": baseline["corpusHash"],
    "reviewHashes": {
        name: hashlib.sha256((ROOT / "tests/audit/recall/reviews" / name).read_bytes()).hexdigest()
        for name in ("failure-classification.json", "precision-review.json")
    },
    "candidatePool": baseline["candidatePool"],
    "canonicalSnapshots": baseline["canonicalSnapshots"],
    "rejectedSnapshots": baseline["rejectedSnapshots"],
    "metrics": {},
    "classification": baseline["classification"],
    "precisionMethod": precision["author"],
    "precisionLabels": dict(Counter(r["label"] for r in precision["reviews"])),
    "secondarySynergyMetrics": {
        key: sum(d["secondarySynergyMetrics"][key] for d in baseline["results"]) / 12
        for key in ("obviousRecall", "hiddenRecall", "trapRejection")
    },
    "families": [{"deck": d["deck"], **d["metrics"]} for d in baseline["results"]],
}
for kind, name in (("obvious", "obviousRecallAt20"), ("hidden", "hiddenRecallAt20"), ("trap", "trapRejection")):
    selected = [r for r in rows if r["kind"] == kind]
    successes = sum((not r["hit"]) if kind == "trap" else r["hit"] for r in selected)
    summary["metrics"][name] = {"successes": successes, "total": len(selected), "value": successes / len(selected)}
for n in (10, 20):
    selected = [r for r in precision["reviews"] if r["baselineRank"] <= n]
    # Explicit conservative definition: debatable is not a precision success.
    successes = sum(r["label"] in ("Excellent contextual fit", "Good obvious fit") for r in selected)
    summary["metrics"][f"deskPrecisionAt{n}"] = {"successes": successes, "total": len(selected), "value": successes / len(selected)}

# Only repeated verbose debug payloads are removed. Oracle text, facts, roles,
# conditions, ranks, connections, uncertainty and top-20 explanations remain.
def compact(value):
    if isinstance(value, list):
        return [compact(v) for v in value]
    if isinstance(value, dict):
        return {k: compact(v) for k, v in value.items() if k not in ("debug", "missed")}
    return value

out = ROOT / "docs/recall"
out.mkdir(exist_ok=True)
for name, data in (("frozen-baseline-summary.json", summary), ("frozen-baseline-results.json", compact(baseline)), ("frozen-real-decks.json", holdouts)):
    (out / name).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
print(json.dumps(summary["metrics"], indent=2))
