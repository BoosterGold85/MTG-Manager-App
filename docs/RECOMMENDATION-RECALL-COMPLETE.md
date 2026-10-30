# Recommendation Recall & Interaction Coverage — completed pass, v0.6.15

Continued the same pass from **00c6be9**, against production anchor **0f90fff**. This is not a new intelligence pass. Canonical snapshots, the original 379-candidate pool, twelve constructed 100-card decks, 72 expectation occurrences and seven preregistered public holdout plans are unchanged. The current production code now includes the targeted semantic/relationship corrections below. No popularity, external deck frequency, price or recommendation values were used.

## Results

Primary ordering remains the existing production Brew ordering established before capture. Existing Explore Synergy ordering is recorded as secondary diagnostics, never substituted to improve the reported metrics. No new Brew Score, scoring component, band, threshold or UI was implemented. Existing weights and limits have explicit regression guards. The inherited lens remains in the application.

| Measure | Before (00c6be9) | After |
|---|---:|---:|
| Obvious Fit Recall@20 | 7/24 — 29.2% | **15/24 — 62.5%** |
| Hidden Gem Recall@20 | 12/24 — 50.0% | **14/24 — 58.3%** |
| Trap Rejection | 23/24 — 95.8% | **24/24 — 100%** |
| Precision@10 — semantic desk review | 70/120 — 58.3% | **82/120 — 68.3%** |
| Precision@20 — semantic desk review | 132/240 — 55.0% | **156/240 — 65.0%** |

Twelve of the original 29 missed candidates entered the top 20. Two previous hits were displaced: **Mirror March in Copy (rank 21)** and **Retreat to Coralhelm in Lands (rank 27)**. Net gain is ten hits, from 19/48 to 29/48. These regressions remain visible; their expectations were not changed.

Precision is an **assistant-authored semantic desk review**, not independent human validation or win-rate evidence. All 177 candidate/deck judgments that remain from the original review retain exactly the original label and rationale. Sixty-three new top-20 rows have explicit separate judgments. Only “Excellent contextual fit” and “Good obvious fit” count as successes; debatable candidates do not. Labels never enter production scoring. The artifact-heavy constructed filler makes some generic artifact engines legitimately usable; these numbers should not be generalized to all users’ collections.

## Original defect checks versus ranking recovery

| Original diagnostic category | Before | Original checks still failing |
|---|---:|---:|
| Semantic extraction | 16 | **0** |
| Interaction matching | 8 | **0** |
| Condition supply | 2 | **0** |
| Role/profile | 1 | **0** |
| Original ranking cases still outside top 20 | 2 | **2** |

The zeroes refer narrowly to the **original missing capability/relationship predicates**, verified by canonical-card regressions and negative controls. They do not mean that every card is understood, every expected card ranks highly, or all Magic semantics are exhausted. Every original case has a rule, regression location and before/after rank in [the resolution sheet](../tests/audit/recall/reviews/resolutions.json).

All 19 remaining expected misses are generated. Post-fix primary triage is **A 0 / B 0 / C 0 / D 0 / E 0 / F 7 / G 12 / H 0**. This is assistant triage from diagnostics, not ablation-proven causal attribution. Recognized direct engines can still receive little value from the fixed component model; near-cutoff candidates can be displaced by generic engines. No manually expected card was removed or reclassified as an invalid expectation.

## Systemic rules fixed

1. **Scoped capabilities from Oracle text.** Counter replacement observes compatible initial placements rather than originating counters. Land untaps are mana utility. Graveyard land-play permission is recursion, not extra land drops. Anaphoric protection (“those creatures”) is resolved only when it refers back to creatures you control; opponent-only and missing antecedents do not qualify. Fabricate has its real modal artifact-creature output; variable opponent life loss is not mislabeled as damage.
2. **Recursion grammar and linked zones.** Return-to-hand/from-graveyard word order and graveyard-Aura reanimation are recognized. Linked exile-then-return is a staging sequence, not permanent graveyard hate; a shared “each player” subject propagates to the sacrifice reset. Actual artifact sacrifice costs and sacrificial artifact tokens feed artifact-to-graveyard payoffs; arbitrary artifacts alone do not.
3. **ETB reuse with costs and scope.** Blink, friendly bounce and copy relationships name real compatible self-entry effects. Creature-only effects cannot borrow noncreature artifacts. Death, cast, activated and cast-from-hand-only entry effects are not silently reused. One-shot copies do not inherit an entire reusable engine. Dependent reuse outputs are not counted again as independent owned role inventory, and protected cuts use intrinsic roles.
4. **Attachment and Vehicles.** Equipment/Aura attachment respects real target classes. Crew rewrites and another-Vehicle animation are distinct from a Vehicle’s own crew ability. Crew-triggered animation retains its prerequisite. Artifact-tap draw costs are not artifact sacrifices.
5. **Copy and transformation causality.** Actual copy targets can supply an entry predicate; copying is not casting. Ordinary clones do not get a legend exception. Explicit nonlegendary/legend-rule text does. Transform-to-copy mana is conditional on the actual instant/sorcery setup; the front and reverse face are not treated as immediately interchangeable.
6. **Conditional line identity.** Reminder text, apostrophes and surrounding whitespace normalize consistently before removing a gated ability. Role deltas now reflect the actual conditional line. Colored discounts require the corresponding spells, and a generic “instant and sorcery spells” discount is interpreted as the two permitted spell classes.
7. **Supply precision.** A chosen creature type binds to one actual tribe instead of combining unrelated types. A named-copy win condition retains its exact required count. Global token multipliers see all real token sources rather than only a tribal-relevance subset. The minimum-two-suppliers rule was not loosened globally; no new single-source exception was justified or added.
8. **Role and ranking inputs.** Looting still emits a draw event but is not net card gain; variable/additional draw and genuinely positive draw-after-discard remain supported. Recursion redundancy compares covered target domains, so artifact-return cards do not make instant/sorcery recovery look redundant. This changes the evidence count, not the score weight or redundancy threshold. The two original ranking losses remain unresolved.
9. **Cache reuse.** Conditions, own-entry recognition and profile prerequisites reuse metadata-scoped caches. Cards with no relevant capability take a fast path. These optimizations do not alter evidence or ranking.

No named-card exception table was added to the engine. Card names appear only as self-reference/identity data and in the test/review corpus. Renamed variants and unrelated/opponent-only negative controls guard the general rules.

## Remaining false negatives

| Family | Expected candidate | Rank | Post-fix primary |
|---|---|---:|---|
| Counters | Winding Constrictor | 45 | F — scoring |
| Counters | Inspiring Call | 25 | G — ranking |
| Graveyard | Living Death | 34 | F |
| Graveyard | Animate Dead | 24 | G |
| Graveyard | Tortured Existence | 29 | G |
| Aristocrats | Ashnod’s Altar | 29 | G |
| Blink | Peregrine Drake | 70 | F |
| Blink | Archaeomancer | 25 | G |
| Artifacts | Scrap Trawler | 42 | F |
| Typal | Cursed Mirror | 25 | G |
| Lands | Ramunap Excavator | 25 | G |
| Lands | Retreat to Coralhelm | 27 | G — displaced hit |
| Copy | Sakashima of a Thousand Faces | 51 | F |
| Copy | Mirror March | 21 | G — displaced hit |
| Copy | Biovisionary | 28 | G |
| Voltron | Brass Squire | 42 | F |
| Voltron | Ardenn, Intrepid Archaeologist | 38 | F |
| Hybrid | Doubling Season | 23 | G |
| Hybrid | Corpsejack Menace | 22 | G |

Each has canonical text, facts/capabilities, conditional supply, named feeders, roles, both ranks, confidence and explanations in [completed results](recall/completed-results.json). [Post-fix classifications](../tests/audit/recall/reviews/failure-after.json) retain per-row evidence. A confirmed upstream fix does not justify forcing a card above the cutoff.

## Remaining false positives and uncertainty

The desk review still labels four returned rows **False positive**: **Grafted Skullcap in Aristocrats, Lands and Vehicles**, and singleton **Dragon’s Approach in Spells**. Its forced hand loss and the named-card graveyard requirement remain significant interpretation/evaluation limits. They are outside the exact 24 fixed trap occurrences; therefore 100% fixed Trap Rejection is not a claim of zero false positives.

There are also **18 Weak** and **62 Interesting/debatable** rows in the reviewed top 20s. Examples include Primal Amulet outside a sufficiently strong spell plan, incidental attachment cards in Aristocrats, Hazoret’s Monument in weak contexts, and alternate attackers in Voltron. Complete labels and rationales are in [the post-fix precision sheet](../tests/audit/recall/reviews/precision-after.json). These limitations are reasons to withhold readiness rather than loosen the evaluator.

All eleven real user-deck cases evaluate offline: four historical regressions and seven frozen new public exports. The latter were not used to tune values. Their source strategy sentences are unchanged, and the results preserve low-confidence cards, unclassified abilities, missing-data checks, roleless cards, themes and complete top-20 explanations. A roleless card is not necessarily unknown; a confident misread is different from acknowledged uncertainty. See [real-deck results](recall/completed-real-decks.json).

## Performance

Before and after use the **same 1,401 playable Oracle templates**, the same Node runtime, and sequential fresh synthetic identities over a 100-card Kenrith deck. This is a local synthetic benchmark, not 6,000 distinct real cards or an iPhone measurement. Deck/JIT caches may be warm between sizes; memory is process snapshots rather than isolated retained size.

| Candidates | Before cold | After cold | After warm result cache |
|---:|---:|---:|---:|
| 1,000 | 2.387 s | 2.908 s | 0.017 ms |
| 4,000 | 7.408 s | 9.109 s | 0.043 ms |
| 6,000 | 10.619 s | 13.191 s | 0.027 ms |

The extra relationship work adds roughly **2.57 s / 24.2%** at 6,000 in this run. Cold analysis remains a material limitation; no phone-responsiveness improvement is claimed. Metadata-scoped caching reduced the earlier unoptimized cost, while cached result retrieval remains negligible. Full profile-build times, heap/RSS snapshots and method are in [the same-data comparison](recall/completed-performance.json). Performance work that changes UI scheduling is outside this pass.

## Validation and evidence

- `npm run lint`, `npx tsc -b`, `npm run build`: passed; existing Vite chunk-size advisory remains.
- `npm run test:unit`: **620 passed** across 37 files. Forty-nine new semantic/contract cases and two report-integrity checks supplement the unchanged import/storage/re-import suites.
- Frozen twelve-case audit and eleven-real-deck audit: passed offline; tests replace `fetch` with a throwing stub. Every expected positive is generated, recall gains are guarded, and Trap Rejection must remain at least 90%.
- `python3 -m unittest scripts/test_recall_capture.py`: seven passed.
- `npm audit --audit-level=low --json`: zero vulnerabilities; dependencies unchanged apart from release version metadata.
- **390 unique production-browser cases validated** across all five viewports. The final four-worker run passed 387 and hit three 30-second timeouts in the same accessibility check; all three passed when rechecked at the repository’s configured two workers (26.4 s total). No timeout or assertion was relaxed. The earlier complete two-worker run passed all 390 before the final anaphoric-scope guard; the final guard also passed all units, frozen evaluation and build. See [the exact run/recheck record](recall/completed-browser-validation.json). This is Chromium viewport emulation, not physical iPhone/Android or Safari validation.
- The old derived v0.6.6 engine snapshot is retained. A separate v0.6.15 output snapshot reflects intentional semantic changes; [the exact before/after output review](recall/completed-golden-review.json) is distinct from immutable human recall expectations.
- [Aggregate metrics and development-stage evaluations](recall/completed-summary.json) show intermediate results, including temporary recall decreases. Every recorded stage kept fixed Trap Rejection at or above 95.8%; no expectations were edited to improve metrics.

Reproduce reporting after the offline evaluations:

```sh
RECALL_REVIEWS=tests/audit/recall/reviews/failure-after.json RECALL_OUT=/tmp/recall-after.json npx vitest run tests/audit/recall.audit.test.ts
RECALL_HOLDOUT_OUT=/tmp/recall-real.json npx vitest run tests/audit/recall.holdouts.test.ts
RECALL_PERF_OUT=/tmp/recall-perf.json npx vitest run tests/audit/recall.performance.test.ts
python3 scripts/publish-recall-pass.py /tmp/recall-after.json /tmp/recall-real.json /path/to/same-data-before-perf.json /tmp/recall-perf.json
```

The comparison includes the frozen before-performance input in its `before` member; extract it to the last path above. Raw Scryfall responses, public exports and their original provenance/hashes remain in the corpus. No live network access is needed for evaluation. No collection, assignment or saved-deck migration is introduced.

## Final recommendation

**B. ANOTHER INTELLIGENCE PASS REQUIRED.** The architecture produces measurable gains without sacrificing fixed-trap rejection, but recall and precision remain below their targets, nineteen expected cards remain outside the top 20, false positives persist, and cold analysis is still slow. The new evidence supports further focused work rather than globally more generous scoring. This completes the same pass; no subsequent pass or new Brew Score implementation has begun.

Publication: the completed, validated patch is authorized for `main`. The final Git SHA is supplied with the completion report. Cloudflare deployment status has not been independently verified.
