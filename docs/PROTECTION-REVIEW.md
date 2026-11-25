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

## G3/G4: resolved as a v0.6.27 production boundary (reviewed)

- Manifest: `tests/data/production-boundary-v0.6.27.json`, 335 entries, raw current bytes. Replaces the frozen v0.6.26 research manifest for G3 and G4. That file (`research/universal/data/protected-sha256.json`) is unchanged.
- Entry scope: the 336 entries of the research manifest, minus `tests/commander-protected.sha256.json`. That file is the commander guard's own manifest, not product code. Hashing it here would make every reviewed refresh cascade into this guard.
- Exception list removed. `productionBoundaryBytes` is now a plain byte read. The v0.6.26 stripping (version strings, the DeckLibrary analyzer mounts, a test version constant) is no longer applied. Those bytes are on `main` and are recorded in the new manifest.
- Files that differ from `main` (`2a665f0`), the full reviewed set: eight source files (`DeckUpgrades.tsx`, `dna/strategy.ts`, `useRecommendationAnalysis.ts`, `styles/app.css`, `synergy/recommendation.ts`, `upgrades/brew.ts`, `upgrades/index.ts`, `workers/recommendationProtocol.ts`) and two browser specs (`recommendation.spec.ts`, `synergy.spec.ts`). Nothing else differs.
- Verified the guard still bites: a one-space change to `src/upgrades/brew.ts` made `universalRemediated` fail, and the file was restored exactly.
- Result: prototype suite 188 of 188 pass.

## Reviewed change: Scryfall relay redirect fix (merged from `claude/fix-scryfall-redirect`)

- Cause: the Cloudflare runtime (workerd) rejects `redirect: "error"` with "Invalid redirect value". Every card lookup through the relay failed, which is why ManaBox imports stopped in the deployed app.
- `worker/scryfall.ts`: `redirect` is `"manual"`. Upstream 3xx responses are rejected explicitly with a bounded message. Error text now names the upstream HTTP status and content type.
- `src/import/scryfall.ts`: the browser client includes the relay's bounded `details` message in the thrown error. No logic change to retries or pacing.
- `tests/unit/lookupTransport.test.ts`: asserts `manual` instead of `error`, and adds tests for upstream 503 details and rejected redirects.
- Manifest: only these three entries in `tests/data/production-boundary-v0.6.27.json` were updated, to the reviewed bytes.
- Runtime evidence: `node scripts/check-lookup-runtime.mjs` runs the real workerd runtime. It reproduces the original `Invalid redirect value` and confirms the fixed relay succeeds while redirects stay rejected.
