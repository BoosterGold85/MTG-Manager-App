# Protection guard review (Discovery branch, pending owner approval)

Scope: the four guard tests that failed on PR #5. Each is reviewed separately below. **No baseline was refreshed by this review.**
The commander refresh is prepared as a proposal (`docs/audit/protection-refresh-proposal.json`) and needs your approval.

Baseline commit for every comparison: `2a665f0` (v0.6.25/0.6.26 merge on `main`). Discovery commit: `a646b33`. Current head
includes the Vehicle/validator and label changes described in `docs/UPGRADES-DISCOVERY-AUDIT.md`.

## What the guards protect

| Guard | Test | Compares against | Protects against |
| --- | --- | --- | --- |
| G1 | `tests/unit/commanderProtection.test.ts` | `tests/commander-protected.sha256.json` (32 files) | Unreviewed edits to the Commander scorer and recommendation source |
| G2 | `tests/unit/experimentalAnalyzer.test.ts` | `tests/data/analyzer-protected-baseline.json` (40 files) | Changes to the v0.6.26 production release boundary |
| G3 | `tests/prototype/universalRemediated.test.ts` | `research/universal/data/protected-sha256.json` (336 files, normalized by `productionBoundary.ts`) | Changes to scoring, storage and frozen research files |
| G4 | `tests/prototype/browserUniversalRemediated.test.ts` | same manifest as G3 | Same as G3, in the browser prototype |

A byte-level guard cannot tell an intended, reviewed change from an unintended one. So this review checks behavior too: the
Commander scores of every fixture card were compared before and after (see the audit document, section 1).

## Behavioral evidence (the part that matters for scoring)

Scores for all 497 fixture cards (seven fixture decks; the baseline is commit `2a665f0`):

- **Scores changed: 4 cards, all in the Kwain fixture.** Dictate of Kruphix 55→9, Howling Mine 55→9, Kami of the Crescent Moon
  55→29, Well of Ideas 56→31. Cause: "beginning of each player's draw step" is a turn-structure trigger, not a card-draw
  event. The validator no longer treats it as one (intended correction; see the audit).
- **Synergy and link sets changed for 36 Kwain cards** (same cause), with unchanged totals on the rest of the fixtures.
- **No storage, model, import, deck, intelligence or app-shell file changed** (`git diff 2a665f0 -- src/storage src/models
  src/import src/decks src/intelligence src/app` is empty).
- All golden and frozen-expectation unit tests pass, including Reign Wayfinder, Miles key cards, the death-engine strategy test
  and the Upgrades golden snapshot.

## G1: commander manifest, 7 mismatched files

| File | Baseline hash | Current hash | Diff vs `2a665f0` | Intended change |
| --- | --- | --- | --- | --- |
| `src/synergy/recommendation.ts` | 9edd406373c3 | cd2c8a5cdc75 | +16 −3 | Validator gate for stated conditions and object types (with Changeling and token-creation subjects); branch-aware link evidence; grants; draw-step correction; link evidence exposed |
| `src/dna/strategy.ts` | 20c0acd76dd6 | 847f59082430 | +6 −3 | Branch note appended to relationship evidence (text only); grants computed for the note |
| `src/upgrades/brew.ts` | db5ebb9b033e | c37708147daf | +13 | Explanation fields `verified` and `needs` only. Score code untouched |
| `src/upgrades/index.ts` | a94ef66e7a23 | ecc62cbf49dd | +21 | `discoveries()` for the Upgrades landing; swap evaluation for shortlisted cards only |
| `src/components/DeckUpgrades.tsx` | a10ee822f2e1 | 76709575ad05 | +98 −24 | Landing renders recommendations; goal views unchanged in behavior |
| `src/hooks/useRecommendationAnalysis.ts` | 1385af98275e | ed13c8ed1669 | +1 −1 | Mode type adds `discover` |
| `src/workers/recommendationProtocol.ts` | a47b9e6cd253 | 446c6312baa3 | +5 −3 | `discover` mode returns discoveries; goal modes unchanged |

Decision requested: approve refreshing these seven hashes **as a separate commit** (proposal file, not applied), after accepting
the four Kwain score changes above as the intended correction. If you reject the draw-step correction, the fix must be reverted
first, which will also revert the four scores.

## G2 and G3/G4: v0.6.26 release boundary, four production files in common

The analyzer baseline (G2) lists `src/upgrades/index.ts`, `src/upgrades/brew.ts`, `src/synergy/recommendation.ts` and
`src/dna/strategy.ts`. These files changed in the intended ways above. G3/G4 read a larger manifest through
`productionBoundary.ts`, which already normalizes known differences from `main` (package versions, the DeckLibrary mount and
import, one stale test assertion). That manifest also lists `src/components/DeckUpgrades.tsx`, the hook, the protocol file,
`src/styles/app.css`, and the two browser specs I edited (`recommendation.spec.ts`, `synergy.spec.ts`).

Decision requested: these baselines describe the **v0.6.26 analyzer release boundary**. Refreshing them, or adding normalizations
to `productionBoundary.ts`, would redefine that boundary. I did not do either. The right owner decision is one of:

1. Create a new v0.6.27 boundary for this release, with its own reviewed baseline and the scope above. Recommended.
2. Keep the v0.6.26 boundary, and revert the validator and evidence changes in the four shared files.

Until one is chosen, G2, G3 and G4 fail, and that is the honest state of the PR.

## Preserved protections (not weakened)

- No guard was deleted, skipped, or given a broader allowlist.
- No frozen expectation was edited. Every test that changed was one that encoded an assumption later shown to be wrong
  (`discovery.test.ts`: the non-flying Vehicle expectation), and was corrected to test the validity it actually means.
- The analyzer and research files, and `tests/data/holdout-cards.json` (frozen blind holdout), were not read for tuning. The
  audit harness uses the other decklists only.
