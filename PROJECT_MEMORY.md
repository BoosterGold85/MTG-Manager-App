# MTG Manager — compact handoff

Updated 2026-11-08 (America/Chicago). Start with AGENTS.md. Latest user instructions are authoritative.

## Current work

Repository: BoosterGold85/MTG-Manager-App.
Worktree: /workspace/mtg-universal-integration.
Branch: integration/experimental-synergy-analyzer.
Base production: v0.6.25, 65be471. The exact dormant module b2bbdeb has now been fast-forward pushed to main (no production behavior/version change in that first push).

User explicitly authorizes v0.6.26 experimental integration, main publication and deployment once checks pass. Do not ask again for routine release authorization. Preserve the user's existing collection/decks on the same origin. Do not stop at architectural planning because whole-deck reasoning remains incomplete: limited targeted testing with honest coverage/abstention is approved.

## Implemented, not yet released

- src/experimental/universal/: browser fork of frozen phase4-remediation.1 engine, synchronous SHA-256 identity parity, repaired additional-sacrifice-cost citations and permanent-entry CR citations, explicit depth-limit truncation.
- Separate worker, 8-second termination timeout, cancellation, stale-result guards, bounded inputs (500 cards / 1 MiB) and search (3 selected cards, depth 3, 200 states, 12 branches/proofs, 48 automatic steps).
- Deck Overview → Experimental Synergy Analyzer for Commander/Legacy. Explicit opt-in scan, targeted hypothetical zones/resources, supported/unsupported clauses, scoped proofs/checks, gross events vs terminal holdings. No persistence, APIs or production score integration. Sideboard excluded.
- Existing storage/models/scorers and wrangler deployment configuration are unchanged. Reviewed research implementation/manifest remain frozen and disabled; browser code is a separate fork.
- Version/package/public endpoint now 0.6.26. README/CHANGELOG/ROADMAP updated.

## Validation and publication checkpoint

- Dormant boundary: 1,051 tests, lint/build passed before its separate main push.
- Final integration: **1,149/1,149 unit/prototype tests passed**, 57 files, 17.54s. No storage/scoring/model/config changes across all 40 pinned files. Original research files and hash JSON remain unchanged.
- Full browser run: **575 passed / 5 failed**, 580 total, 24.3m; failures were one stale health-test version assertion per viewport (hardcoded .23). Corrected to package version with explicit Node JSON import attribute.
- Final hardened analyzer + lookup rerun: **35/35 passed**, all five sizes, 1.3m. Includes all corrected cases, real workers, same-origin old/new persisted-data tests, cancellation and timeout. All 580 distinct cases are covered across runs, not one final 580/580 execution.
- Final lint, TypeScript (`tsc -b`), production build and Worker dry-run packaging passed. Production audit zero; seven inherited moderate development lint-toolchain findings, no high/critical and no dependency changes.
- tests/prototype/productionBoundary.ts explicitly normalizes only the exact new DeckLibrary mount/import, package version strings and stale lookup-test version assertion before frozen-byte checks. No old scoring or corpus expectation was refreshed.
- All implementation is ready for authorized main publication. Next: commit/push after remote refresh, verify publication/deployment where permitted, and give the user the access path/remaining limits. Do not expand into production synergy scoring.

## Deployment access limitation

Site: https://mtg-manager-app.lhauswirth15.workers.dev.
Runtime policy currently blocks this host (fresh curl CONNECT 403); no Cloudflare credentials configured. Saved environment draft already includes the host, but the current runtime revision has not applied it. User was informed to review/save/publish environment settings. Do not bypass policy. Git-integrated Cloudflare build can deploy after a main push, but live success cannot be asserted without verification.

## Branch/work preservation

- feature/deck-intelligence is already included in v0.6.25 main.
- phase1-relationship-explanations (a7c5973) remains a separate prior review branch; do not silently merge its recommendation/UI changes.
- Other old recall/claude branches remain untouched.
- /workspace/MTG-Manager-App contains unrelated dirty basic-land/deck/storage edits; never reset or overwrite that checkout.
- The /workspace/mtg-accuracy-fix worktree has prior uncommitted semantic fixtures/docs; left intact.
- node_modules here is a temporary symlink, not a tracked change. Do not stage it.

## Known limits

Subset noncombat engine, not a universal Magic simulator. Broad continuous layers, combat, delayed/stack interactions and many clauses remain unsupported. Independent semantic correctness/precision is incomplete. “Verified within this hypothetical supported subset” is not a whole-deck certificate or real-game availability. No numerical Synergy Surplus / Transformative Fit / Marginal Deck Value is approved for production scoring.
