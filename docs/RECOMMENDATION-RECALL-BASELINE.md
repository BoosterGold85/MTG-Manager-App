# Recommendation Recall & Interaction Coverage — frozen baseline

> Historical before-state at 00c6be9. See [the completed same pass](RECOMMENDATION-RECALL-COMPLETE.md) for measured corrections, remaining losses and the final recommendation.

Resumed from **b4a17ab**, on `research-recall-0.6.15`. Production baseline remains **0f90fff / v0.6.14**. This is the baseline evidence stage of the same pass, not a release or a new intelligence pass. No production engine, score, weight, threshold, UI or Brew feature changed. Main has not been updated. The previous checkpoint's provisional B recommendation is superseded by measured evidence below; a final A/B/C decision remains pending targeted corrections and review within this pass.

## Data blocker resolved

Published network settings were verified with an HTTP 200 response from Scryfall before capture. Network collection was limited to canonical Scryfall records and the seven already-selected public Archidekt exports. No popularity, price, deck frequency or external recommendation values are used as scoring inputs.

All **151 previously missing canonical names** now resolve. The frozen store has **1,421 normalized canonical records**, with **zero rejected snapshots** in evaluation. Original 379-name candidate pool, twelve constructed 100-card decks and 72 expectation occurrences remain unchanged. Canonical file SHA-256: `8e332eac914015d6b649d29ecc3f08081ac118a05106dba240137aae0eaf0fa3`. See [capture completion](../tests/audit/recall/capture-completion.json), [card provenance](../tests/audit/recall/card-provenance.json) and raw Scryfall batch files beside them.

Seven byte-exact public deck exports are frozen with retrieval timestamps and SHA-256 hashes in the [holdout manifest](../tests/audit/recall/holdouts/manifest.json). All seven validate as exactly 100 cards using the actual export's explicit board inclusion metadata; no list was trimmed to fit. User-supplied strategy sentences were preserved before evaluation. Four older user decks remain regression cases, not unseen holdouts. Together all eleven real decks now evaluate offline, with no off-color deck entries detected. Their strategy sentences are qualitative expectations, not additional numeric recall labels or independent precision judgments.

Capture/adapter repairs were necessary to make this evidence valid:

- Explicitly excluded boards override included type categories. A category named “Tokens” explicitly included by its author remains included; it can be a strategy label.
- Exact canonical names take precedence over face aliases. Standalone **Reanimate** must not resolve to **Grave Researcher // Reanimate**. Likewise, a prepared spell face cannot replace standalone Rampant Growth.
- Split/double-faced lookups use an exact front name only when the returned canonical card verifies that identity. Incomplete cached snapshots are refreshed. Historical identifier not-found responses are retained as lookup history, not interpreted as invalid cards after successful canonical resolution.

These are research fixture/capture fixes, not changes to production matching or recommendation logic. Hash checks and deterministic regressions cover these cases.

## Baseline metrics

Primary ordering is the existing production **Brew ordering**, as established at the checkpoint before data collection. The existing Explore Synergy ordering is recorded separately for diagnosis; it is not substituted to improve headline metrics. This does not implement a new Brew Score.

| Measure | Baseline | Numerator / denominator |
|---|---:|---:|
| Obvious Fit Recall@20 | **29.2%** | 7 / 24 |
| Hidden Gem Recall@20 | **50.0%** | 12 / 24 |
| Trap Rejection | **95.8%** | 23 / 24 |
| Precision@10 — semantic desk review | **58.3%** | 70 / 120 |
| Precision@20 — semantic desk review | **55.0%** | 132 / 240 |

Recall/traps use frozen original labels. Precision uses 240 explicit candidate/deck judgments, with written rationales, in the [precision sheet](../tests/audit/recall/reviews/precision-review.json). Only “Excellent contextual fit” and “Good obvious fit” count as precision successes. “Interesting / debatable”, “Weak” and “False positive” do not. Review totals: 53 excellent, 79 good, 67 debatable, 36 weak, 5 false positives. These are **assistant-authored semantic desk-review estimates**, not independent human validation, measured win-rate or tournament evidence. The engine's explanation is not accepted as ground truth. The harness's separate provisional precision intervals use only original expectations and are not these point estimates.

Recall and precision targets are not met on this baseline. Trap rejection meets its 90% target. No accuracy improvement is claimed because scoring and extraction have not changed. Historical prototype figures are not substituted for current measurements.

## Failure classification

All **29 missed expected candidates were generated**. Each has exactly one primary classification, evidence and rationale in the [failure sheet](../tests/audit/recall/reviews/failure-classification.json).

| Primary category | Count | Share of misses |
|---|---:|---:|
| A — Candidate generation | 0 | 0% |
| B — Semantic extraction | 16 | 55.2% |
| C — Interaction matching | 8 | 27.6% |
| D — Condition supply | 2 | 6.9% |
| E — Role / profile | 1 | 3.4% |
| F — Scoring | 0 | 0% |
| G — Ranking | 2 | 6.9% |
| H — Expectation | 0 | 0% |

These are evidence-based primary-cause triage judgments, not ablation-proven causal assignments. F=0 does not establish that scoring is correct; upstream missing semantics dominate the current diagnosis. No frozen expectation was changed to improve metrics. Relaxing candidate filters globally is not supported by these misses.

Concrete systemic findings:

- **Counters:** Winding Constrictor and Corpsejack Menace lack a usable replacement/doubling role. Inspiring Call's “Those creatures” protection is lost even though draw is extracted.
- **Graveyard / sacrifice:** Living Death's linked reset/reanimation, Animate Dead's Aura-linked reanimation and Marionette Master's variable artifact-death loss are incompletely represented. Tortured Existence is Synergy rank 19 but Brew rank 26; Ashnod's Altar is Brew rank 21 despite real death interactions.
- **Blink:** Teleportation Circle and Thassa have blink tags but weak ETB interaction matching. Peregrine Drake's land untap is not represented as mana; Archaeomancer's repeated ETB value is suppressed by recursion saturation.
- **Artifacts / typal:** Scrap Trawler's return wording is missed. Jhoira's historic draw condition is recognized but produces no conditional contribution. Shimmer Dragon's artifact-tap cost and Herald's Horn's chosen type lack the corresponding causal bindings. Cursed Mirror's prospective copied Dragon identity is not connected.
- **Lands / copy:** Ramunap Excavator's permission to play lands is missed. Primal Amulet's front-to-back setup, Sakashima's clone/legend exception and Temur Sabertooth's friendly bounce/reuse are poorly represented. Biovisionary's named four-copy condition is not mapped to clone supply.
- **Equipment / Vehicles:** Attach, mass attach, crew rewriting and Vehicle animation are not fully typed for Brass Squire, Ardenn, Kotori, Mech Hangar, Peacewalker Colossus and Mobilizer Mech. The Voltron trap admitted is **Grafted Skullcap**, whose mandatory hand loss is a real tradeoff; not Colossus Hammer.
- **Condition supply:** Doubling Season has several token makers but still receives a missing-enabler penalty, suggesting inconsistent supply definitions. Supply evidence now distinguishes engine weights, main-deck copy counts, commander sources and candidate self-setup.

Confident output can still be wrong: Hazoret's Monument is frequently promoted in non-red contexts where its red discount is unusable and looting is not the relevant event. Dragon's Approach needs actual named cards in the graveyard; spell copies do not meet that condition. Vehicle Aura/attachment analysis must account for the Vehicle ceasing to be a creature. These are recorded review concerns, not silently corrected labels or engine fixes.

## Public holdout observations

These are qualitative checks against the preregistered user strategy sentences, not new labels for tuning. Surface theme recognition does not establish recommendation quality.

| Holdout | Baseline observation |
|---|---|
| Isshin | Combat (32%) and tokens (15%) match the stated attack-trigger plan, but the top five are led by Pawn of Ulamog and Bastion of Remembrance rather than explicit doubled-attack interactions. |
| Prosper | Ramp and pings appear, but the commander’s explicit “play a card from exile” event is itself reported unclassified. Spells is the leading theme; exile/Treasure causality remains uncertain. |
| Henzie | Sacrifice and graveyard are visible behind ramp; generic recommendations still lead. Recognizing those themes does not prove blitz cost/death sequencing is modeled. |
| Muldrotha | Graveyard leads at 42%, consistent with the stated plan. Hazoret’s Monument is nevertheless rank 2 in this non-red deck. |
| Sythis | Voltron (26%) leads enchantments (14%); the top three are Rampaging Baloths, Scute Swarm and Hazoret’s Monument. This illustrates a gap between enchantress recognition and recommendation ranking. |
| Giada | Angel typal and lifegain lead, matching the stated plan. Hazoret’s Monument ranks first despite having no usable red-creature discount in this mono-white deck. |
| Wilhelt | Zombie typal, tokens and graveyard lead, matching the stated plan. Carrion Feeder and Viscera Seer appear in the top five, alongside less specific recommendations. |

The four historical decks also retain recognizable Dragon, Vehicle, pings and group-draw themes. Their raw rankings are preserved rather than represented as unseen generalization evidence. Full results expose which concerns the engine acknowledges and which high-confidence outputs still warrant review. None of these public lists was used to adjust values.

## Frozen evidence and reproducibility

- [Aggregate metrics, hashes and per-family results](recall/frozen-baseline-summary.json)
- [Twelve-case rankings and diagnostics](recall/frozen-baseline-results.json): Oracle text, generated/excluded status, both ranks, facts/tags/roles, conditional supply and feeders, confidence and uncertainty; only repeated verbose debug payloads and duplicate missed-row arrays are omitted.
- [Eleven real-deck results](recall/frozen-real-decks.json): top 20 with reasons/negatives, themes, expected plan, unknown conditions, roleless nonlands, low confidence, missing Oracle data and color-identity checks. Roleless does not necessarily mean unknown, and known uncertainty is different from a confident misread.

The real-deck candidate pool assumes one owned copy of each eligible frozen candidate; it makes no claim about the public authors' actual collections. Neither the public lists nor precision labels tune production values. Evaluation tests replace `fetch` with a throwing stub, so accidental live-network dependency fails.

Run from the repository root:

```sh
RECALL_REVIEWS=tests/audit/recall/reviews/failure-classification.json RECALL_OUT=/tmp/recall-baseline.json npx vitest run tests/audit/recall.audit.test.ts
RECALL_HOLDOUT_OUT=/tmp/recall-holdouts.json npx vitest run tests/audit/recall.holdouts.test.ts
python3 scripts/summarize-recall-baseline.py /tmp/recall-baseline.json /tmp/recall-holdouts.json
```

No capture command or network is needed for these evaluations. To audit original retrieval, successful raw responses and provenance remain committed alongside normalized records. The capture script is a separate explicit network operation and is not invoked by validation.

## Validation and limits

- `npm run lint`, `npx tsc -b` and `npm run build` passed; existing Vite chunk-size advisory remains.
- `npm run test:unit`: **569 passed**, including canonical/hash integrity, all 151 names, board inclusion, prepared-face collision and complete review sheets.
- `python3 -m unittest scripts/test_recall_capture.py`: **7 passed**, including cache refresh and preserving the standalone/ prepared-face identities.
- Both complete offline recall and eleven-deck evaluation tests passed.
- `CI=1 TEST_PRODUCTION=1 npm test`: **390 passed** in 16.1 minutes at 360×800, 390×844, 430×932, 768×1024 and 1440×1000. This is Chromium viewport emulation, not physical iPhone/Android or Safari validation.
- Dependencies and lockfile are unchanged. The preceding checkpoint recorded zero audit vulnerabilities; a new registry audit was not requested during this data-only capture phase.

No new phone performance claim is made. The checkpoint's synthetic 1k/4k/6k timings remain historical baseline evidence, not distinct-card or iPhone measurements. The corpus is finite and constructed-case precision is not representative population precision. No independent human precision review has occurred. Candidate recall is conditional on the frozen 379-name pool, not all Magic cards. The existing playability predicate does not model the Commander banlist; a color-identity check is not complete format-legality validation.

The next authorized stage is targeted semantic/interaction corrections supported by these failures, followed by rerunning this exact frozen corpus after each systemic fix. **This checkpoint stops before engine edits**, as requested. A final readiness verdict, version assignment, main merge and deployment remain pending completion and review of the same pass.
