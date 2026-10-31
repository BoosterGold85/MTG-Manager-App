# v0.6.16 — Recommendation Ranking & Performance

Baseline: main `919407a` (v0.6.15). This is the requested ranking/performance pass, not a new Brew feature. Collection, deck entries, assignments, import synchronization, persistence, layout and interaction patterns are unchanged. Existing production Brew ordering remains the primary evaluation ordering; Explore Synergy remains secondary. No new score UI, global threshold changes, external popularity data or external tuning values were added.

## Frozen evidence and results

The 379 candidates, twelve constructed 100-card decks, 72 expected occurrences, 1,421 canonical snapshots, original holdout exports and preregistered plans are unchanged. Hashes are recorded in [results](ranking/results-v0.6.16.json). All evaluation is offline. Precision is assistant desk review against canonical text and full deck composition, **not independent human validation or win-rate evidence**. Existing pairwise labels and rationales are retained; new pairs have explicit separate judgments in `tests/audit/ranking/precision-review.json`. Debatable is not success. Labels never enter production scoring.

| Measure | v0.6.15 | v0.6.16 | Target |
|---|---:|---:|---:|
| Obvious Fit Recall@20 | 15/24, 62.5% | 18/24, **75.0%** | 75% |
| Hidden Gem Recall@20 | 14/24, 58.3% | 20/24, **83.3%** | 65%, stretch 70% |
| Trap Rejection | 24/24, 100% | 24/24, **100%** | 90% |
| Desk Precision@10 | 82/120, 68.3% | 95/120, **79.2%** | 75% |
| Desk Precision@20 | 156/240, 65.0% | 172/240, **71.7%** | 70% |

Twelve of the original nineteen misses recover; three former hits leave the top 20, yielding nine net additional expected hits. Frozen expectations were not edited. Constructed filler is heavily artifact weighted; these metrics do not establish quality across arbitrary real decks.

## Diagnosis before changing weights

Pre-change evidence for all nineteen cards, components, penalties and competing top twenty is in `tests/audit/ranking/baseline-classification.json`. Counts: scoring underweight 4; generic-card overweight 3; role value error 3; package value error 6; redundancy penalty error 2; missing bridge/multi-package value 1. These are primary desk diagnoses of overlapping causes, not proven causal attribution to a single component.

| Deck / candidate | Primary cause | Before → after |
|---|---|---:|
| Counters / Winding Constrictor | Dense counter amplification underweighted | 45 → 16 |
| Counters / Inspiring Call | Generic engines crowd finite protection/draw | 25 → 28 |
| Graveyard / Living Death | Relevant mass recursion/reset roles underweighted | 34 → 22 |
| Graveyard / Animate Dead | Actual scoped recursion underweighted | 24 → 15 |
| Graveyard / Tortured Existence | Repeatable graveyard package insufficiently valued | 29 → 17 |
| Aristocrats / Ashnod’s Altar | Strategic sacrifice redundancy treated as saturation | 29 → 14 |
| Blink / Peregrine Drake | Reusable entry mana resource underweighted | 70 → 14 |
| Blink / Archaeomancer | Real instant/sorcery recovery underweighted | 25 → 4 |
| Artifacts / Scrap Trawler | Recursion engine redundancy treated as generic coverage | 42 → 14 |
| Typal / Cursed Mirror | Temporary copy and target package underweighted | 25 → 21 |
| Lands / Ramunap Excavator | Land/graveyard bridge insufficiently valued | 25 → 12 |
| Lands / Retreat to Coralhelm | Repeated land-entry relationships crowded out | 27 → 7 |
| Copy / Sakashima | Actual copy targets/legend bypass underweighted | 51 → 34 |
| Copy / Mirror March | Reusable entry-copy payoff crowded out | 21 → 19 |
| Copy / Biovisionary | Actual named-copy package underweighted | 28 → 21 |
| Voltron / Brass Squire | Attachment package underweighted | 42 → 37 |
| Voltron / Ardenn | Attachment package underweighted | 38 → 32 |
| Hybrid / Doubling Season | Dense counter/token amplification underweighted | 23 → 13 |
| Hybrid / Corpsejack Menace | Dense creature-counter amplification underweighted | 22 → 16 |

## Systemic ranking rules

`deckSpecificValue` consumes approved canonical capabilities, conditioned functions, actual strong relationships and complete package membership. It does not award points for shared tags alone. A direct Commander anchor has importance 1; a secondary functional package needs seven distinct members and appropriate payoff support, importance 0.8; incidental three-card support has importance 0.25. It does not select only the largest themes. Generic ramp, draw and interaction are excluded from package membership.

Quality is the strongest compatible, supported causal relationship, rather than summed edge count. Independent family breadth has a four-point bound; duplicate relationships cannot inflate quality. Strong non-Commander edges require strength ≥0.8. Secondary artifacts receive reduced credit; token output without an actual token package receives reduced credit. Conditions still require actual suppliers. Off-plan token armies do not automatically count as tall-Commander upgrades.

The bounded internal value is `18 × quality + 6 × Commander strength + up to 4 family breadth + up to 2 needed-role support`, maximum 30. The normal recommendation converts it to a rounded 20-point component; inherited ranking converts it to a 25-point component. This is a contextual value budget, not a new feature or new global band.

The generic utility ceiling is 45 plus up to 15 for an actual role deficit, applied only without strong package or Commander support. Relevant recursion, sacrifice outlets, amplifiers, attachment/animation and reusable entry resources receive strategic redundancy protection. Ordinary saturated mana rocks do not. Existing role deficits, efficiency, curve density, high-cost adjustments and excellent-fit eligibility remain factual constraints. There is no universal cheap-card bonus or expensive-card exclusion. Normal role-only scores can be lower under the reduced generic budgets (the uncovered-removal fixture is 41, with its full role credit retained); relative need and evidence remain visible.

## Weight changes

Changes were defined after the nineteen-miss diagnosis and before public holdout evaluation. All numbers are budgets out of 100. Unchanged thresholds and bands are guarded by tests.

| Normal recommendation | Old | New | Reason / primary categories | Holdout risk |
|---|---:|---:|---|---|
| Commander | 20 | 15 | Rebalance overlapping Commander/theme evidence into causal value; underweight/package | Commander-only strategies |
| Theme | 20 | 15 | Reduce incidental overlap; generic overweight/package | Broad typal packages |
| Role need | 25 | 25 | Preserve genuine deficiencies | No budget change |
| Efficiency | 20 | 15 | Reduce generic flexible-effect advantage; role/generic overweight | Sparse decks relying on utility |
| Curve | 10 | 5 | Prevent cheap generic cards dominating; role/generic overweight | Very fast plans |
| Deck interactions | 5 | 5 | Preserve existing validated evidence | No budget change |
| Deck-specific | 0 | 20 | Value usable causal relationships, strategic engines and secondary packages | Sparse or poorly extracted plans |

| Inherited ranking lens | Old | New | Reason / primary categories | Holdout risk |
|---|---:|---:|---|---|
| Contextual synergy | 25 | 20 | Avoid duplicating the new bounded causal value | Commander-centric decks |
| Interaction quality | 20 | 20 | Preserve strong approved relationships | None from budget |
| Bridge | 20 | 10 | Reduce broad incidental connections | Genuine diffuse hybrid plans |
| Novelty | 15 | 5 | Novelty alone cannot outrank usable engines | Unusual sparse engines |
| Multiplicative | 10 | 10 | Preserve actual amplifiers | None from budget |
| Commander | 5 | 5 | Preserve Commander-specific evidence | None from budget |
| Role | 5 | 5 | Preserve actual need | None from budget |
| Deck-specific | 0 | 25 | Promote verified density and reusable resources | Poorly extracted plans |

Additional bounded policy changes (not global band changes):

| Constraint | Old | New | Reason / affected category | Regression risk |
|---|---|---|---|---|
| Generic utility ceiling | None | 45 + up to 15 actual deficit credit when no strong package/Commander support | Generic overweight | Useful standalone staples in sparse plans |
| Relevant strategic saturation | −5 when over role target | Exempt only verified strategic engines; ordinary rocks retain −5 | Redundancy error | Too many similar engines if extraction is wrong |
| Unavailable optional self-name portion | No explicit cost | −12 normal score; no tutor-role credit | Proven unavailable effect / role error | Legal multi-copy lists; sufficient-copy control included |
| Mandatory hand loss | No explicit cost | −15 normal score, reduced to −8 with ≥3 actual discard payoffs | Proven resource cost / generic overweight | Genuine hellbent/discard engines |
| Inherited-lens risk ceiling | None | 55 minus the above risk costs | Prevent generic points swallowing downside | Real downside-mitigation combinations not understood |

These costs are generalized heuristics, not optimized per-card values. The inherited lens records any applied ceiling adjustment in its signed ledger. No threshold was lowered to admit an expected card.

## Ablations

Each intervention removes only the indicated term/policy, without redistributing its points or changing frozen labels. These measure interventions in the final policy, not universal optimality of the weights.

| Removed | Obvious@20 | Hidden@20 | Trap rejection | Desk P@10 | Desk P@20 |
|---|---:|---:|---:|---:|---:|
| Nothing | 75.0% | 83.3% | 100% | 79.2% | 71.7% |
| Deck-specific value | 50.0% | 70.8% | 100% | 70.8% | 67.1% |
| Generic utility ceiling | 75.0% | 83.3% | 100% | 79.2% | 70.8% |
| Strategic redundancy protection | 75.0% | 79.2% | 100% | 80.0% | 71.7% |

Specificity supplies the largest measured gain. The utility ceiling improves two desk-reviewed top-20 slots without improving aggregate recall. Redundancy protection recovers one hidden expectation, at a one-slot Precision@10 cost. Retaining it favors legitimate strategic redundancy while preserving perfect measured trap rejection. Per-deck ordering, not just aggregate rates, is archived in the result artifact.

## False-positive review and semantic preservation

No approved canonical facts, capabilities or tags were rewritten. The original diagnosed semantic, interaction, condition-supply and role/profile checks remain at zero failures. All 72 frozen expectation occurrences compare those outputs to v0.6.15 in regression tests. Two proven scoring constraints sit outside those facts:

- An optional graveyard tutor requiring other actual cards with its own name receives no tutor role when the list cannot supply those copies. The independent damage effect remains usable. This addresses singleton Dragon’s Approach; copies of a spell do not fabricate the required cards. Renamed, sufficient-copy and unrelated-card controls pass.
- Mandatory end-step hand loss is a resource cost, not controlled discard or free net card advantage. This addresses Grafted Skullcap. A real discard-payoff package mitigates the cost but does not erase it. Renamed and ordinary-draw controls pass.

Grafted Skullcap and singleton Dragon’s Approach no longer appear in any constructed top twenty. Remaining reviewed examples include Primal Amulet in Voltron (rank 3, Weak), Hazoret’s Monument in Blink (15, Weak) and Aristocrats (17, Debatable), and Sigarda’s Aid in Aristocrats (19, Weak). These failures are preserved rather than relabeled.

Neither rule excludes a named card. Both retain technical facts and explain the scoring restriction. Weak Primal Amulet, Hazoret’s Monument, incidental attachment and alternate-attacker contexts remain honest review failures when present; the engine does not pretend every usable side plan is a main-plan upgrade. Constructed Voltron still includes several peripheral blink/copy/cast engines. Actual Commander-side attachment remains too low.

Remaining expected misses: Inspiring Call 28; Living Death 22; Jhoira 40; Herald’s Horn 39; Orb of Dragonkind 25; Cursed Mirror 21; Sakashima 34; Biovisionary 21; Brass Squire 37; Ardenn 32. Jhoira, Herald’s Horn and Orb are newly displaced hits. Complete per-deck results and preserved precision judgments identify remaining weak/debatable/false-positive suggestions.

## Real holdouts: validation after rules froze

All eleven offline 100-card lists evaluate, with four historical regressions and seven frozen public user decks. No Archidekt frequency/popularity data is consumed. The same synthetic owned-candidate pool is used for evaluation; it is not each author’s real inventory. [Per-deck top twenty and entered/left lists](ranking/holdouts-v0.6.16.json) preserve the preregistered plans. No numeric holdout precision is claimed because those lists do not have independently frozen pairwise relevance labels.

The results remain mixed: Wilhelt more clearly surfaces sacrifice bodies; Muldrotha surfaces graveyard/land recursion; Henzie surfaces expendable-body resources. Isshin still favors generic death/artifact value over attack triggers; Sythis still surfaces too many land/token engines; Kwain still favors generic reusable engines. Giada promotes Leveler, an unsafe entry effect for that plan. This is a concrete out-of-distribution warning, not a reason to edit expectations or tune on these holdouts. No scoring adjustment followed this holdout inspection.

## Performance and responsiveness

Same sequential Node 24.19 benchmark and 1,401 real Oracle templates as the baseline. Fresh names/IDs cycle templates at 1k/4k/6k candidate identities in a synthetic 100-card Kenrith list padded with basics. These are **not 6,000 different real Oracle cards, browser timings, or iPhone measurements**.

Performance optimizations reuse metadata-scoped facts, recipient views, conditioned functions, supply indexes, characteristics, inverse package membership and canonical profile arrays. A stable canonicalization callback enables profile reuse. Repeated subtype scans are reused on single-face analysis; an unanchored clause regex was replaced by equivalent clause scanning. No text-template cache collapses fresh synthetic identities.

| Candidates | v0.6.15 cold | v0.6.16 measured cold | Warm |
|---|---:|---:|---:|
| 1,000 | 2.91s | 2.31s | 0.055ms |
| 4,000 | 9.11s | 6.44s | 0.053ms |
| 6,000 | 13.19s | 9.45s | 0.057ms |

The recorded 6k run meets the ≤10s acceptable goal, not the preferred ≤8s goal. Earlier prototypes ranged about 11–13s; measurement variance exists. The table uses the final isolated rounded-score implementation; an earlier equivalent-policy run was 8.92s at 6k. Peak resident memory in this recorded synthetic run is about 570MB; lower-memory phones remain unverified.

Cold recommendation work still runs synchronously in `DeckUpgrades` memo calculations. Multi-second main-thread blocking remains a real risk despite faster computation. Moving the whole pure scorer off-thread is an architectural change, so this pass documents a safe next step: send immutable collection/deck metadata plus a content revision, semantic version and ranking version to a module worker; publish complete revision-stamped results; discard stale replies on deck changes; preserve last valid results; support cancellation/progress; never let the worker write ownership. Chunked yielding can be an intermediate implementation, with deterministic final sorting. This proposal is not implemented or silently counted as responsive UI.

Caches distinguish complete deck contents, quantities, Commander identity/metadata, semantic rules and ranking version. Upgrade cache keys include deck entries/assignments/Commander snapshots; collection-state identity isolates saved revisions. Sort/filter/expansion/scrolling operate on the existing cached results and do not enter those keys. The implementation assumes canonical metadata objects and saved state snapshots are immutable, as in the current data-access architecture.

## Golden review and validation

The v0.6.15 golden file is preserved. The v0.6.16 Build/Improve golden outputs are **identical in all twelve fixtures**; ranking diagnostics and the inherited lens are evaluated separately by the recall corpus. Fixed numeric score assertions were updated only for the explicitly changed budgets; semantic facts, global limits, exact arithmetic, score bounds and data-preservation assertions remain. The normal score retains integer component arithmetic.

See [validation](VALIDATION-v0.6.16.md) for commands, counts, dependency audit and deployment evidence. Reproduce reporting with `node scripts/summarize-ranking.mjs <recall-json> <ablation-json> <holdout-json> <performance-json>` after capturing the corresponding offline audit outputs.

## Recommendation

**B. ANOTHER RANKING/INTELLIGENCE PASS REQUIRED.** The constructed metric targets are met, and Node cold performance improves materially. Broader holdout false positives and synchronous mobile responsiveness prevent treating these numbers as evidence of universal recommendation readiness. Manually test the deployed ranking changes first. Stop before any Brew Score work.
