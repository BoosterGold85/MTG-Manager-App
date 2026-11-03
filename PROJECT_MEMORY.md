# MTG Manager — compact project memory

Last updated: 2026-11-03. Read `AGENTS.md` for standing rules. This file is a handoff, not autonomous permission to expand scope.

## Baseline and purpose

- Repository: `BoosterGold85/MTG-Manager-App`.
- Current verified base: v0.6.23, `6d0286bab411530943c01cfed7aa4191146d71bf`.
- Public site: https://mtg-manager-app.lhauswirth15.workers.dev — deployment/device verification remains separate; do not claim it is verified from a Git push.
- Product: mobile premium binder, ManaBox collection/deck import, local ownership/assignments, Commander/Standard/Legacy decks and inspectable deck-relative recommendations.
- Ownership is local to the browser/site origin. This workspace cannot directly read a user's saved browser deck.

## Active authorized work — Phase 1 ONLY

Branch: `phase1-relationship-explanations`, based on the baseline above.
Detailed report: `docs/PHASE1-RELATIONSHIP-EXPLANATIONS.md`.

User authorized improving existing verified interaction explanations, not scoring or semantics. Distinguish:
1. How this card interacts with your deck.
2. Why this swap improves your deck.

Show named causal partners only when verified by the existing engine and still present in the simulated post-cut deck. Preserve marginal gains, dependency/saturation warnings, lost coverage, scores, order, best cuts and confidence. No invented positive explanation when no link exists.

**STOP before merging or deploying. User review is required.** Publishing a review branch is distinct from merging main. Phases 2 and 3 are NOT approved.

Implementation:
- `src/synergy/recommendation.ts`: expose existing per-link evidence strings; no numerical evaluation change.
- `src/presentation/swapInteractions.ts`: disposable post-swap deck view; existing engine supplies relationships; no UI Oracle interpretation. Filter removed partners and sentences mentioning removed third partners. At most three links, Commander first.
- `src/components/SwapInteractions.tsx`: explanation section and lazy Why rendering.
- `DeckUpgrades.tsx` and `SwapReview.tsx`: display evidence for best/manual cuts; original improvement reasons remain.
- New unit/browser tests and `tests/data/phase1-reign-baseline.json`: pre-change two-candidate Reign parity capture. Existing golden expectations and protected hashes untouched.

## Validation checkpoint

- Relevant recommendation/workspace production browser suite: **55/55 passed**, all five sizes, 2.8 minutes. Final conservative filter is covered by the isolated unit run; focused final browser verification is recorded below.
- Final isolated full unit run: **722 passed / 1 failed**, 723 total, 13.94 seconds. Failure is the unchanged byte-for-byte Commander source protection guard, not a numerical test.
- Final focused production browser rerun: **5/5 passed**, all five sizes, 14.0 seconds.
- Five new focused interaction tests pass after the final filter: Wayfinder/Lathliss, token Dragon/nontoken restriction, absent/unsupported evidence, removed real partner, removed third partner.
- Reign exact UpgradeEvaluation and BuildEvaluation (including rank order, score, cuts, confidence, reasons/concerns) match the pre-change baseline; source deck/collection remains unchanged.
- Final lint, build and diff checks passed.
- **Known review blocker:** protection guard flags `src/components/DeckUpgrades.tsx` and `src/synergy/recommendation.ts`. Do not hide it by refreshing hashes. Reviewer must accept the narrow presentation changes before any protection-baseline update/merge decision.
- First browser attempt: five stale-heading failures (“Why this helps”); only the intended heading assertion changed, then all 55 passed.

## Next actions

1. Await user review of this branch and the explicit protection-guard exception. Do not merge main or deploy.
2. Before any approved follow-up, verify branch/status and refresh this handoff if facts change.
3. Do not proceed to land allowance/access/supply or basic-land-type semantics without separate approval.

## Deferred findings / constraints

- Courser/Oracle: library-top revelation and land-play access remain semantic gaps; extra land-play allowance is not guaranteed landfall supply.
- Dryad: basic-land-type grant must not imply Basic supertype, extra land count or land-entry events.
- Wayfinder correctly interacts with Lathliss via Changeling; a small upgrade must not be presented as a large improvement. The Reign regression candidate pool is not the user's entire collection.
- Frozen v0.6.17 blind holdouts must not be inspected/ranked for tuning. No expectation changes.
- OpenAI Semantic Auditor: manual copy/paste experiment only. No API integration approved, no paid calls. Prior environment inspection found no OpenAI credential and API host not allowed; recheck readiness if a future task authorizes integration. Never ask for keys in chat.
- Prior v0.6.22 real-file test: 4,497 ManaBox rows, 6,122 copies, 4,496 records, zero problem rows; repeat needed zero lookups. Private CSV was not committed.

## Short new-chat prompt

“Read AGENTS.md and PROJECT_MEMORY.md, verify the current branch/status, then continue only the active authorized Phase 1 task. Do not merge, deploy, change scoring, or inspect blind holdouts.”
