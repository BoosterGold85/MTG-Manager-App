# Recall pass — developer checkpoint, not a release

Baseline: current production `0f90fff` / v0.6.14. The next **completed** pass will be v0.6.15; this checkpoint is incomplete and does not assign a production version or change recommendation scoring/UI.

Read [checkpoint status](../../../docs/RECOMMENDATION-RECALL-CHECKPOINT.md) and [the executable](../../../docs/recommendation-recall-executable.md).

## Frozen inputs

- `fixed-expectations.json`: original 12-deck core/label manifest. Two obvious, two hidden and two trap labels per case, unchanged.
- `fixed-decks.json`: complete original constructed 100-card lists, unchanged.
- `fixed-candidates.json`: original 379-name pool, unchanged. This avoids measuring different rankings merely because a new, larger cache exists.
- `coverage-cases.json`: supplemental MDFC/Adventure lookups for real layout coverage. They are not inserted into the frozen ranking pool.
- `cards.scryfall.json`: available repository Scryfall-shaped snapshots; origins in `card-provenance.json`. Incomplete records are rejected by production normalization and reported. No guessed set/collector fields or mirrored Oracle text is injected to make normalization pass.
- `holdouts/manifest.json`: seven new public URLs with exact user-provided pre-evaluation sentences; raw capture/hashes pending. Four historical user decks are explicitly marked previously evaluated, with byte-for-byte source snapshots under `legacy/`. The original fixture TypeScript is preserved as `.ts.txt` data, not executable code.

Do not rewrite expected labels, candidate pool, snapshots or hashes to improve results. Any legitimate bad expectation needs a separate explicit H review, retaining the original denominator and a documented sensitivity analysis.

## Capture after network activation

The environment draft includes the required destinations. Saving a draft does not enable runtime access: review/save it in environment settings, then publish, and verify access before capture.

```sh
python3 scripts/fetch-recall-data.py --holdouts --cards
python3 -m unittest scripts/test_recall_capture.py
```

No fetch occurs by default. Saved public exports are immutable after capture; repeated runs verify their hash and skip them. Successful Scryfall batches persist. Captures include retrieval timestamps, source URL and raw SHA-256. No live browsing calls, popularity/price scoring, account connection, or production state writes occur.

`archidekt.ts` validates boards, quantity, explicit commander, expected Commander and 100-card total. It is an offline adapter, **not** a new app importer. Its live integration still needs verification against the fetched exports.

## Evaluate without disguising missing input

```sh
RECALL_OUT=/workspace/recall-results.json npx vitest run tests/audit/recall.audit.test.ts
RECALL_PERF_OUT=/workspace/recall-performance.json npx vitest run tests/audit/recall.performance.test.ts
npm run test:unit
npm run lint
npx tsc -b
```

The audit uses production normalization, candidate grouping, Brew evaluator, extracted facts, role analysis and uncertainty architecture. A complete pool and deck snapshot are required before ranks are comparable. Unavailable canonical data yields `metrics: null`, not a card error or a miss. A partially covered corpus yields `classification: null`; do not proceed to score changes.

Once all inputs are complete, manually assign each missed expected card exactly one A–H primary category with a rationale and evidence. `classificationCounts` rejects duplicates, out-of-corpus reviews and empty rationales. Then investigate typed-family matching and condition supply before any scoring changes.

Precision review uses Excellent contextual fit / Good obvious fit / Interesting-debatable / Weak / False positive. Unknown labels stay null and produce intervals plus review coverage. Only the first two count as successes. Author-curated expectations do not establish independent human precision.

Condition diagnostics distinguish engine-weighted supply from main-deck copy count, Commander feeders and candidate self-setup. No effective-supply exception or global threshold relaxation has been implemented. The repeatable-single-enabler study and full real-holdout evaluator remain work after the canonical-data gate.

The performance study measures a 100-card synthetic Kenrith deck against 1,000/4,000/6,000 fresh identities cycling repository Oracle templates. It is not 6,000 different Oracle cards or physical-device performance. Profile caches/JIT may be warm; result-cache cold/warm times and process memory snapshots are disclosed. No timing threshold is relaxed and no performance improvement is claimed.
