# Upgrade Selector (v0.6.27 candidate, unreleased)

Read-only creativity ranking of owned cards for one Commander deck, opened from the deck Overview with **Find Upgrades**.

## What it does

- **Theme:** counts engine patterns (discard, +1/+1 counters, return to hand, enters, graveyard, sacrifice, tokens) across the deck, qty-weighted. The top two with at least three cards are the engine.
- **Candidate pool:** the existing owned, legal, not-in-deck pool (`candidateGroups`), restricted to the commander's color identity by canonical subset match.
- **Creativity score**, five axes, each 0–3, weights configurable (default 1, total out of 15):
  - *Engine fit:* 1 secondary pattern; 2 primary pattern; 3 primary pattern plus a second pattern, or the primary inside an activated ability's resource cost.
  - *Obscurity:* 0 unless printed before 2015-01-01 **and** EDHREC rank is known. Rank ≥2000 gives 1, ≥5000 gives 2, ≥10000 gives 3.
  - *Surprise:* a resource cost that produces value scores 2. Three when the cost is the deck's own engine pattern.
  - *Loop:* trigger or enter (+1), repeatable deck engine (+1), the card's trigger or repeatable cost linked to the engine (+1).
  - *Real impact:* creatures from power+toughness (ETB `+1/+1` counters included) per mana value, plus a point for two or more ability lines. Non-creatures from ability-line count.
- **Dead slots:** nonland, non-commander deck cards with engine fit 0.
- **Swaps:** dead slots paired one-for-one with the best engine-fitting candidates. These are score-based suggestions, not a simulated evaluation.
- **Niche gem:** the best candidate that is both pre-2015 and engine-fitting. If none qualifies, none is shown.
- **AI layer:** prompt builder and strict response validator (`src/upgradeSelector/aiReview.ts`). No provider is configured, so no API call is made. The panel says "Not configured".

## Data

- Release date and EDHREC rank are fetched through the existing same-origin lookup proxy (`/cards/collection`, 75 per batch) and cached in a **separate** IndexedDB database, `mtg-upgrade-selector` v1. Rows refresh after seven days. Existing collection, deck and metadata stores are not touched.
- **Deviation from the request:** the request asked for a weekly bulk `oracle_cards` cache. The production proxy allows only `/cards/*` and `/sets`, and the bulk file is large, so a bulk pipeline needs a Worker route and a scheduler. That is not built. The shipped cache covers only cards the user's deck and candidate pool touch, refreshed on demand.
- Oracle text, type line, colors, mana value and keywords come from the existing metadata. Nothing is duplicated.

## Test cases from the request

Test fixture: real Scryfall oracle text, fetched 2026-11-26 (`tests/fixtures/upgradeSelector.json`).

| Card | Deck | Engine | Engine fit | Obscurity | Surprise | Loop | Impact | Total |
|---|---|---|---|---|---|---|---|---|
| Fertilid | bounce/counters | counters, bounce | 3 | 0 | 3 | 3 | 3 | **12** (meets ≥12) |
| Skirge Familiar | mayhem/discard | discard, enters | 3 | 0 | 3 | 2 | 3 | **11** (does not meet ≥12) |

**Skirge Familiar does not reach 12 under the rules as specified.** Two facts drive this:

1. Skirge Familiar was printed in 2021 (Fertilid in 2023). The spec's Obscurity rule ("released before 2015") gives both 0, so 12 is the ceiling. Skirge therefore needs all four other axes at 3.
2. Loop is 2 of 3. The spec's Loop rule rewards triggers and enters. Skirge has neither, only a repeatable discard cost in a deck with an enters engine.

I did not change any axis to lift Skirge to 12. Adding a point for "discard as a repeatable resource" or changing the Obscurity cutoff would be tuning to two named cards, which the project rules forbid. The Skirge assertion is an `it.fails` test, so the suite stays green while the gap stays visible. It will turn red when the gap is closed, at which point the assertion should be converted to a normal test. The decision on the rule belongs to the user.

Negative controls in the suite: Fertilid in a discard-only deck scores below 12. Skirge in a counters/bounce deck has engine fit 0 but keeps generic surprise 2, which matches the spec's deck-independent definition.

## Validation (exact commands and counts)

Environment: `npm ci` from the lockfile, then the commands below. Chromium: `/opt/pw-browsers/chromium` via `CHROMIUM_PATH`, `--trace off`.

- `npm run lint`: exit 0.
- `npx tsc -b`: exit 0.
- `npm run build`: exit 0.
- `npm run test:unit`: 59 files, 1,028 passed, 1 expected fail (`it.fails`, Skirge target). New files: `upgradeSelector.test.ts` (scoring), `upgradeSelectorMetadata.test.ts` (cache), `upgradeSelectorAi.test.ts` (AI validation).
- `npx vitest run tests/prototype`: 6 files, 188 passed. Frozen-byte checks pass after the boundary whitelist update (below).
- New browser spec `tests/browser/upgradeSelector.spec.ts`: 5/5 viewports pass (360, 390, 430, tablet, desktop). Covers the panel rendering, read-only state (JSON equality of saved state before and after the scan), no horizontal overflow, and an axe scan of the panel.
- Existing browser suites on the same tree (`decks`, `deckNavigation`, `deckIntelligence`, `experimentalAnalyzer`, `strategy`, `workspace`): 82 passed, 3 failed. The 3 failures are `decks.spec.ts:94` on mobile-360, mobile-390 and tablet, all the same axe `color-contrast` check on the Add Card dialog's tile subtitles and eyebrow. **These fail on the untouched base commit `2a665f0` too** (verified on all three viewports). The check is flaky: it passed on some earlier runs. Pre-existing; I have not changed the design tokens.

## Boundary and changes to existing files

- `src/components/DeckLibrary.tsx`: one import and one mount line for the commander Overview. The mount is placed after the overview summary and before the Experimental analyzer, so the phone flow keeps "What This Deck Does" in view (an earlier placement broke `workspace.spec.ts:90`, now fixed).
- `tests/prototype/productionBoundary.ts`: the exact new import and mount line are normalized, the same way the v0.6.26 analyzer lines are. No hash was refreshed silently.
- No change to scoring, storage, models, schema, `app.css`, package version or Worker files. The new stylesheet is `src/components/UpgradeSelector.css`.

## Not verified

- Not tested on a physical device. Chromium emulation only.
- No deployment verification. The live origin was blocked from this runtime earlier (see PROJECT_MEMORY.md).
- No AI provider call was made or configured. The AI layer is tested only through validation of synthetic responses.
- The weekly bulk cache is not built (see Data).
