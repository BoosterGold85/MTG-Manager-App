# MTG Manager — compact handoff

Updated 2026-11-19 (UTC). Start with AGENTS.md. Latest user instructions are authoritative.

## Checkpoint 2026-11-19: Recommended from your collection (not merged, not deployed)

Branch: claude/sweet-tesla-vvlj2b (base: origin/main 2a665f0). Evidence: docs/UPGRADES-DISCOVERY-v1.1.0.md.

- Upgrades now opens to owned-card recommendations for the deck. Each shows strength (Strongly supported / Plausible / Speculative), Works with, What happens, What it needs, Availability, Potential change and Confidence. Build Around My Commander and Improve My Current Deck remain under "Explore by goal".
- Selection lives in src/upgrades/discovery.ts. It reuses the existing Brew links, conditions, bridges and Upgrade swaps. No new numeric score. Storage, schema, keys and deck IDs are unchanged.
- Generic-rule guards: category effects shared by 3+ candidates are dropped (Commander links exempt); stated "if it has flying"-style conditions must hold for the card; crew is not an interaction; Anti-synergy cards are excluded; at most 2 identical rules.
- Corrected: Subterranean Schooner / Tangle Tumbler are valid Miles interactions (the Otherwise branch gives a flying counter). Earlier "false positive" claims were wrong.
- Scoring changes (intended, reviewed): draw-step triggers no longer match card draw (4 Kwain scores change). Validator now enforces trigger types and stated keyword conditions; no other fixture score changed.
- Audit (docs/UPGRADES-DISCOVERY-AUDIT.md): top-ten lists are NOT yet worth considering on most decks. Dominant gap: broad-type triggers (e.g., "whenever you cast a creature spell") accept any creature. Next validator pass needs its own review.
- Blockers: four byte-identical guards fail (commanderProtection, experimentalAnalyzer, two universal prototype tests). Not refreshed. See docs/PROTECTION-REVIEW.md; a refresh proposal is in docs/audit/protection-refresh-proposal.json.
- Human usefulness review (7 of top 10) has not been done; the report lists the fixture results for review.

---

## Previous checkpoint (v0.6.26)

## Current work

Repository: BoosterGold85/MTG-Manager-App.
Worktree: /workspace/mtg-universal-integration.
Branch: integration/experimental-synergy-analyzer.
Base production: v0.6.25, 65be471. The exact dormant module b2bbdeb has now been fast-forward pushed to main (no production behavior/version change in that first push).

User explicitly authorizes v0.6.26 experimental integration, main publication and deployment once checks pass. Do not ask again for routine release authorization. Preserve the user's existing collection/decks on the same origin. Do not stop at architectural planning because whole-deck reasoning remains incomplete: limited targeted testing with honest coverage/abstention is approved.

## Implemented and published to main

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
- Feature commit **a7bf02cc20050e685a1588281adc6d08c8876749** was fast-forward pushed to main; public GitHub commit and exact-commit version metadata identify .26. Main now contains the feature. Live-origin deployment verification remains blocked below; do not describe it as verified. Do not expand into production synergy scoring.

## Deployment access limitation

Site: https://mtg-manager-app.lhauswirth15.workers.dev.
Runtime policy currently blocks this host (fresh curl CONNECT 403); no Cloudflare credentials configured. Saved environment draft already includes the host, but the current runtime revision has not applied it. User was informed to review/save/publish environment settings. Do not bypass policy. Git-integrated Cloudflare build can deploy after a main push, but live success cannot be asserted without verification.

## Branch/work preservation

- feature/deck-intelligence is already included in v0.6.25 main.
- phase1-relationship-explanations (a7c5973) remains a separate prior review branch; do not silently merge its recommendation/UI changes.
- Other old recall/claude branches remain untouched.
- /workspace/MTG-Manager-App contains unrelated dirty basic-land/deck/storage edits; never reset or overwrite that checkout.
- The /workspace/mtg-accuracy-fix worktree has prior uncommitted semantic fixtures/docs; left intact.
- node_modules was a temporary dependency symlink during validation; it is not tracked and can be recreated or replaced with npm ci when needed.

## Known limits

Subset noncombat engine, not a universal Magic simulator. Broad continuous layers, combat, delayed/stack interactions and many clauses remain unsupported. Independent semantic correctness/precision is incomplete. “Verified within this hypothetical supported subset” is not a whole-deck certificate or real-game availability. No numerical Synergy Surplus / Transformative Fit / Marginal Deck Value is approved for production scoring.

## Upgrade Selector checkpoint (2026-11-26, unreleased)

- Read-only Commander "Find Upgrades" panel on the deck Overview. Code: src/upgradeSelector/ (scoring, metadata cache, AI validator), src/components/UpgradeSelector.tsx. Report: docs/UPGRADE-SELECTOR.md.
- Separate IndexedDB `mtg-upgrade-selector` v1 caches Scryfall released_at and edhrec_rank (7-day TTL) through the same-origin lookup proxy. Existing stores untouched. Weekly bulk oracle_cards pipeline NOT built (needs Worker route + scheduler).
- Spec test: Fertilid (bounce/counters) = 12, passes. Skirge Familiar (mayhem/discard) = 11, does not reach 12 under the written rules (Obscurity gated by 2015 date; Loop 2/3). Recorded as it.fails; rule decision is the user's. No axis tuned.
- AI layer: validator and prompt only, no provider configured, no paid API calls.
- Validation: lint/tsc/build pass; unit 59 files 1,028 passed + 1 expected fail; prototype 188 passed; new browser spec 5/5 viewports.
- Pre-existing, reproduced on base 2a665f0: decks.spec.ts:94 axe color-contrast in Add Card dialog fails on mobile-360/390/tablet (flaky). Not fixed (design tokens frozen).
- productionBoundary.ts whitelists the exact new DeckLibrary import/mount lines only; no hash refreshed; app.css untouched (selector CSS in its own file).
- Not deployed or device-tested.
