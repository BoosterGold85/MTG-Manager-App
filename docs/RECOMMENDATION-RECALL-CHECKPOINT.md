# Recommendation recall & interaction coverage — draft checkpoint

**Canonical baseline: `0f90fff`**, production package v0.6.14. Intended completed-pass version: **v0.6.15**, not assigned or released yet. This checkpoint changes developer audit infrastructure only; no production thresholds, weights, recommendation functions, tags or UI were modified.

## Blocking prerequisite and status

The saved network draft includes `api.scryfall.com`, `cards.scryfall.io`, `data.scryfall.io` and `archidekt.com`, preserving the package-manager preset. It is saved but not active: current runtime policy excludes the three required API/data hosts. Environment settings must be reviewed/saved and the environment published before capture can run. No blocked destination was tunneled through another service.

The frozen candidate pool has **379 names**. Of the repository snapshots, **633** normalize successfully and **7** have incomplete metadata. **151 names** needed by the historical corpus lack usable canonical snapshots. Therefore **0/12 complete fixed cases are evaluated**, all aggregate recall/precision metrics are **unavailable**, and missing fixture data is **not** labeled an engine miss.

The older 42% hidden-gem / 17% obvious / 96% trap figures came from an unpublished prototype with different semantic extraction and mirror data. They are historical research observations, not current-main measurements. This pass must run the current production evaluator over a complete, frozen canonical snapshot before comparing results.

## Frozen expectations

- Twelve original 100-card constructed lists, 24 obvious expectations, 24 hidden expectations and 24 trap occurrences are preserved unchanged. The original 379-name candidate pool is frozen too. Hashes are recorded in the holdout manifest and each audit output.
- Seven new public user-authored deck URLs and the user’s exact strategy sentences were recorded before evaluation. Raw snapshots, retrieval timestamps and SHA-256 hashes are still pending permitted access. Live URLs will never be treated as immutable fixtures.
- Four user-supplied legacy lists are preserved as hashed repository snapshots. They were already used during development, so they are **regression decks, not unseen blind holdouts**. The seven new lists provide the unseen component of the proposed 11-deck real-world set.

| ID | Commander | Status |
|---|---|---|
| H01 | Lathliss, Dragon Queen | Legacy user-supplied regression; source snapshots hashed |
| H02 | Miles "Tails" Prower | Legacy user-supplied regression; source snapshots hashed |
| H03 | Valgavoth, Harrower of Souls | Legacy user-supplied regression; source snapshots hashed |
| H04 | Kwain, Itinerant Meddler | Legacy user-supplied regression; source snapshots hashed |
| H05 | Isshin, Two Heavens as One | Expectation frozen; raw export capture blocked |
| H06 | Prosper, Tome-Bound | Expectation frozen; raw export capture blocked |
| H07 | Henzie “Toolbox” Torre | Expectation frozen; raw export capture blocked |
| H08 | Muldrotha, the Gravetide | Expectation frozen; raw export capture blocked |
| H09 | Sythis, Harvest’s Hand | Expectation frozen; raw export capture blocked |
| H10 | Giada, Font of Hope | Expectation frozen; raw export capture blocked |
| H11 | Wilhelt, the Rotcleaver | Expectation frozen; raw export capture blocked |

## Version audit

| Location / history | Verified state |
|---|---|
| package.json / package-lock.json | 0.6.14 |
| README / ROADMAP | 0.6.14 production baseline |
| CHANGELOG | Existing 0.6.14 release and Unreleased causality patch; unchanged by this research checkpoint |
| Earlier local v0.6.9 research prototype | Unpublished research branch, not a production research release; distinct from the historical v0.6.9 punisher fix |
| Completed recall pass | Next intended version 0.6.15; **not assigned or released while incomplete** |

No Git history was rewritten. The expectation preregistration is a separate commit before fixture capture and evaluator changes. This draft checkpoint is not being pushed to main or represented as a completed release.

## Failure classification — not yet available

A–H primary categories are defined and validated. Each missed expected card must receive exactly one primary category, a rationale and evidence; duplicate and unrelated reviews are rejected. Classification counts remain **null**, rather than misleading zeroes, until the complete fixed corpus can be evaluated. No scoring change may proceed before this classification is recorded.

| Category | Meaning | Count / percentage |
|---|---|---|
| A | Candidate generation | Unavailable: canonical input incomplete |
| B | Semantic extraction | Unavailable: canonical input incomplete |
| C | Interaction matching | Unavailable: canonical input incomplete |
| D | Condition supply | Unavailable: canonical input incomplete |
| E | Role / strategy | Unavailable: canonical input incomplete |
| F | Scoring | Unavailable: canonical input incomplete |
| G | Ranking | Unavailable: canonical input incomplete |
| H | Expectation | Unavailable: canonical input incomplete |

## Metrics and family findings

| Required measure | Current pass |
|---|---|
| Obvious Fit Recall@20 ≥80% | Not measurable yet |
| Hidden Gem Recall@20 ≥70% | Not measurable yet |
| Trap Rejection ≥90% | Not measurable yet |
| Precision@10 ≥80% / Precision@20 | Not measurable yet; unreviewed labels remain unknown |

Blink, Equipment, Vehicles, Lands, Clone/Copy and Counters require full canonical input before family-specific misses can be classified. There are no claimed newly recovered cards, worst-case rankings or accuracy improvements in this checkpoint. Existing production Brew UI is preserved because it predates this brief; nothing new was added or enabled.

## Infrastructure verified

- Actual production candidate grouping is tested for owned/zero-owned cards, alternate printings, in-deck exclusion, color identity, colorless cards, lands, Vehicles, Equipment, Auras, split and transform cards. MDFC/Adventure tests currently exercise the structural layout gate; semantic coverage on real examples remains pending canonical data. Commander format bans are not modeled by the existing playability predicate; this is distinct from color-identity and layout filtering.
- A strict public-export adapter validates category/board metadata, quantity, exactly one explicit commander, expected Commander identity, and 100 main-deck cards. Unknown boards and multi-Commander ambiguity fail closed. Live integration with the supplied Archidekt exports is not yet verified.
- Capture uses sequential, conservatively paced Scryfall batches, bounded transient retries and Retry-After handling. Successful snapshots persist between runs; confirmed 403 denials are not retried. Captured holdouts cannot silently change without a hash failure.
- Every evaluated expected card will include generated/exclusion status, rank, canonical text, extracted facts/tags/roles, condition supply, named feeders, uncertainty and confidence. Missing fixture data never becomes a card-level error or a false recall miss.
- Precision uses the requested five labels. Unknown reviews do not count as successes; intervals and review coverage are reported until labels are adjudicated.

## Performance baseline

This is the **existing production engine**, measured before recall improvements. A synthetic 100-card Kenrith fixture is padded with basics; 1,000/4,000/6,000 fresh candidate identities cycle 633 stored real Oracle templates. It is not a distinct real 6,000-card collection or a phone measurement. Candidate IDs/names differ across sizes to avoid warming candidate facts from the preceding sweep. Deck-profile facts/JIT may still be warm. Memory is process heap/RSS snapshots, not isolated retained-size.

| Candidates | Profile build ms | Cold analysis ms | Warm result-cache ms |
|---:|---:|---:|---:|
| 1000 | 256.12 | 2106.28 | 0.0225 |
| 4000 | 10.96 | 7149.99 | 0.0165 |
| 6000 | 20.89 | 10524.26 | 0.0472 |

The 6,000-candidate cold sweep takes roughly 10 seconds here. **Cold local latency is a concern**, despite near-zero cached lookup time; practical phone responsiveness is not established. No performance improvement is claimed. Full measurements and method are in [baseline-performance.json](recall/baseline-performance.json).

## Validation at this checkpoint

- 564 unit tests passed, including 20 audit-integrity/filter/public-export adapter cases.
- Five offline Python capture tests passed.
- Lint, explicit TypeScript check and production build passed. Existing Vite chunk-size advisory remains.
- Dependency audit: zero vulnerabilities.
- Fixed corpus audit ran and correctly reported incomplete canonical coverage (not an accuracy pass).
- 1,000/4,000/6,000-candidate performance study ran.
- `CI=1 TEST_PRODUCTION=1 npm test`: **390 passed** across 360×800, 390×844, 430×932, 768×1024 and 1440×1000. This validates the unchanged production baseline, not unavailable recall metrics.
- No new release, deploy, main push or scoring change has been performed.

## Resume steps

1. Review/save the network draft in environment settings, then publish the environment. Verify actual API access before capture.
2. `python3 scripts/fetch-recall-data.py --holdouts --cards` captures exports and missing canonical metadata, retaining prior successes. Validate the actual public export schema, Commander/count and raw hashes. Any unavailable/invalid deck or confirmed not-found card needs explicit handling, not fabricated data.
3. Run `RECALL_OUT=... npx vitest run tests/audit/recall.audit.test.ts`; classify every missed expected card A–H with evidence **before scoring edits**.
4. Complete the real holdout evaluator and review sheets, Obvious Fit set, typed-family matching fixes and repeatable-single-enabler study. Preserve the fixed labels, traps and conservative condition requirements. Do not tune on the seven unseen decks.
5. Re-measure recall, traps, review precision, unknown abilities and cold/warm performance; run all required validation after production changes; only then assign the completed next version consistently and consider a release.

**B. ANOTHER INTELLIGENCE PASS REQUIRED.** Readiness is not established. The requested pass remains incomplete because canonical input and unseen holdout capture are blocked; production scoring has deliberately not been changed before valid failure classification.
