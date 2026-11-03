# MTG Manager development instructions

## Start here

1. Read `PROJECT_MEMORY.md` (short handoff/state), then `git status --short` and the current branch/commit.
2. Read only the executable/report relevant to the requested task. Do not load the whole chat history, roadmap, large JSON corpora or unrelated fixtures.
3. Verify the current remote baseline before publishing; local tracking refs can be stale. This repository may track origin/HEAD rather than origin/main.
4. Treat the latest explicit user instructions as authoritative. Memory records context, not permission. Do not infer deployment/merge authorization from an earlier release.

## Product directive

MTG Manager is a premium, mobile-first Magic digital binder and deck workspace. Artwork stays dominant; preserve the approved dark olive/parchment/gold visual language and existing interaction patterns. Intelligence must explain actual, deck-relative causal relationships rather than popularity, shared tags or generic card strength.

Collection ownership and conceptual decklists are distinct. Missing deck entries are allowed. Never fabricate ownership, silently transfer assigned copies, clear IndexedDB as a workaround, or mutate collection quantities to make a deck work. Preserve atomic revision/concurrency checks and safe idempotent ManaBox re-imports.

Commander Colors is separate from normal Color: use Scryfall `color_identity` subset matching, including colorless cards. Scryfall is canonical metadata; cache successful lookups. Transient service failures are recoverable interruptions, not thousands of invalid CSV rows.

## Change discipline

- Implement only the authorized phase. No speculative roadmap work, accounts, new AI integration or Brew redesign.
- Preserve Brew's evidence-led philosophy. Keep scoring weights, thresholds, classifications, confidence and rankings unchanged when the task is presentation-only.
- Never add named-card production rules. Named cards are regression fixtures; rules must generalize and include negative controls.
- Never inspect/evaluate the frozen blind holdouts for tuning. Do not change frozen expectations, golden files or protection hashes merely to make checks pass.
- Read-only audit output must distinguish recognized facts, preserved-but-unmodeled text, unavailable deck context, and hypotheses. A collection CSV is not a saved deck. Do not invent browser-local state.
- Never expose credentials or private collection exports in commits/logs/chat. No paid API calls without explicit authorization.
- Do not merge or deploy without authorization for the current task. Current Phase 1 is explicitly review-only.

## Architecture map

- `src/import/`: CSV/deck metadata resolution, retries/cache and legality.
- `src/storage/`: browser-local IndexedDB repositories and atomic writes.
- `src/decks/`, `src/models/`: conceptual entries, physical assignments, formats.
- `src/intelligence/`, `src/synergy/`, `src/dna/`, `src/upgrades/`: tags, semantics, causal relationships, DNA and recommendation evaluation.
- `src/components/`: binder/deck UI; `src/presentation/`: explanation-only helpers.
- `src/standard/`, `src/legacy/`: separate constructed-format upgrade behavior; preserve Commander behavior.
- `worker/`, `wrangler.jsonc`: same-origin Scryfall relay plus SPA assets. Deployment needs Worker AND assets, not a static-only upload.

## Validation

Use package scripts: `npm run lint`, `npm run test:unit`, `npm run build`.
Relevant production-browser checks: `CI=1 TEST_PRODUCTION=1 npx playwright test <files>` after building. Five standard sizes are 360×800, 390×844, 430×932, 768×1024 and 1440×1000. Chromium emulation is not physical iPhone verification.

Run timing-sensitive unit checks separately from heavy browser tests. For explanation changes, capture pre-change scores/order/best cuts/confidence and compare exact outputs. Test supported interactions, absent supply, token restrictions, removed partners, unsupported clauses and no writes.

`tests/unit/commanderProtection.test.ts` compares protected source bytes. Intentional UI/metadata edits can flag it even with numerical parity. Report this openly; do not silently refresh `tests/commander-protected.sha256.json`. A known failing guard means the branch is not fully green/merge-ready.

GitHub publication and Cloudflare deployment are separate facts. Report verified SHA, exact tests/results and limitations. A push, local build or health route alone does not prove successful deployed upstream lookups.

## Keep handoffs small

Update `PROJECT_MEMORY.md` when the baseline, authorization, validation or next step changes. Replace stale state rather than append a diary. Store detailed evidence in a task-specific `docs/` report and link it. Never store secrets or private deck/collection backups as memory.
