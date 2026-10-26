# v0.6.2 — Synergy Explorer UX Polish

Baseline reviewed: `758dc63` on main (approved v0.6.1). [Release executable](v0.6.2-executable.md).

## Changes

Candidate hierarchy is artwork → name → score/band → concise availability → one or two plain-language sentences → Why this score? → Compare → printing details. Fully assigned candidates retain Used in deck names and quantities. Repeated utility/conflict paragraphs no longer dominate the default view. Ownership uses Available N · Owned N, or Owned N · Available 0.

`src/synergy/summary.ts` is a deterministic presentation helper over the cached CardSynergy and DeckStrategyProfile. It reports only matched primary themes with awarded strategy points, an evidenced needed role with positive role points, Commander relationships (distinguishing partial from strong evidence), or a matching package. It translates the most relevant penalty into plain language, prioritizing engine conflict, redundant roles, off-plan creature type, limited impact, crowded curve, then absent Commander interaction. Unsupported cards do not acquire invented benefits. Summaries have no role-count arithmetic, totals or clamping language. No LLM, remote call or rescoring is used. The existing frozen reason format is read to name a needed role; a future scoring-output format change should update this adapter and its tests together.

Why this score? replaces Score breakdown in candidate, comparison and deck-relative detail. It remains native, keyboard-operable, default-collapsed and lazily rendered. It preserves every original component, signed penalty, role count/target, interaction/package fact and raw/final total. Detailed comparisons retain their original evidence and never make deck changes.

Candidate padding drops from 20px to 16px; paragraph/score/detail gaps use existing 4px/6px spacing tokens. Text sizes and 64px/80px artwork widths are unchanged. Disclosure targets remain at least 44px tall. No new colors, layout redesign or dependencies.

## Preserved contracts

- Scoring model, cache/version, component arithmetic, bands and thresholds are unchanged; no modifications to `src/dna/strategy.ts`, `src/dna/engine.ts`, family definitions or candidate-ranking logic.
- Recommended ≥70, Worth Considering 50–69; Other Legal Cards <50, subdued and collapsed initially.
- Final score descending, availability only a tie-breaker; full-set search, availability filters and progressive rendering remain intact.
- Existing data, imports, physical-copy assignments and storage schema remain unchanged. The backup application-version field advances to 0.6.2 only.
- No automatic swaps/cuts, external recommendations, AI summaries or v0.7.0 work.

## Validation

- `npm run lint`: passed.
- `npm run test:unit`: **342 passed** (329 existing, 13 new).
- `npm run build`: passed; main JS 488.24 kB (151.68 kB gzip), CSS 64.42 kB. Compared with v0.6.1, approximately 0.77 kB gzip JS added for presentation rules, with no scoring-model or network work added.
- `CI=1 TEST_PRODUCTION=1 npm test`: **325 passed** across all five sizes (full production-build regression suite).
- `npm audit --audit-level=low`: **0 vulnerabilities**.
- `git diff --check`: passed.
- `git diff --exit-code -- src/dna src/synergy/explorer.ts`: passed; scoring and ranking sources are unchanged.

Production Chromium projects: 360×800, 390×844, 430×932, 768×1024 and 1440×1000.

Unit coverage adds 13 presentation tests: eleven archetypes, natural redundancy wording and unsupported-card reasoning. It checks concise copy, absence of technical arithmetic, evidence gating, unchanged cached score objects and diagnostics. Existing v0.6.1 scoring/band/performance tests remain included.

The Lathliss browser fixture verifies strong Dragon engines stay recommended, off-plan creatures stay below 50, Worth Considering remains 50–69, ownership and other-deck usage are correct, default content hides diagnostic math, exact signed breakdown totals are available on expansion, and expansion does not rebuild the strategy profile. Existing search, ranking, comparison, printing, progressive-rendering, read-only snapshots, overflow and axe checks remain active across all five sizes. Only assertions affected by the requested labels/compact copy were updated.

## Limitations / deployment

Summary wording is deliberately bounded and deterministic. It highlights a few supported benefits and the highest-priority caveat; complete nuance remains in Why this score?. It is a local fit heuristic, not a guarantee that a card is better or a full legality checker. Long card/deck names may still wrap on narrow screens.

Tests emulate mobile Chromium; physical iPhone/Safari and optional WebKit coverage are not claimed. The existing iPhone smoke checklist remains available. This release uses the requested Lathliss fixture; it does not claim access to the user’s device-local Reign of Dragons export.

Cloudflare deployment is unverified: local production validation and a GitHub push do not confirm a successful hosted deployment. Cloudflare configuration is unchanged. No implementation scope deviation or later roadmap feature is introduced.
