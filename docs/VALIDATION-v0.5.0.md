# v0.5.0 — Deck DNA Core

Baseline: `19e1dbe` on GitHub `main`, approved v0.4.2 including the large-import regression. Scope: the supplied [Deck DNA Core executable](v0.5.0-executable.md). v0.4.2 is Approved; v0.5.0 is Current. No v0.6.0 features.

## Architecture

- `src/dna/engine.ts`: pure conceptual input/grouping, theme scoring, Commander reinforcement, normalized weights, per-card Synergy/reasons, summary/Core Plan composition and a bounded derived-analysis cache.
- `src/dna/families.ts`: presentation families above the unchanged Card Intelligence taxonomy. Graveyard groups Reanimator/Recursion/Self-Mill/payoffs; Counters groups placing/amplifying/proliferating; Tokens groups generation/payoffs/Go Wide/Populate; Sacrifice/Death Payoffs, Ramp, Card Advantage, Combat and other families retain their source tags. Dynamic validated creature types produce e.g. Dragons Matter.
- `src/intelligence/canonicalAnalysis.ts`: the v0.4.2 canonical-analysis function/cache moved without behavior changes and re-exported from its original module. Both DNA and browsing reuse it without a module dependency cycle. Current saved analysis is preferred; otherwise analysis is cached once per canonical identity, ruleset and input fingerprint.
- `DeckDnaPanel`: DNA, concise deterministic summary and collapsible Core Plan/evidence before the preserved Basic Composition. Core Plan identifies primary strategies, supporting engines, explicitly evidenced payoff or an insufficient-evidence fallback, and up to three strategy anchors.
- `InThisDeck`: contextual Synergy, strongest theme connections, Commander links, primary/supporting roles, components and quoted evidence. Universal Card Intelligence remains separate. Collection detail has no contextual DNA section.
- `deckBrowse`: adds Synergy sorting and an optional DNA theme predicate to the existing sequence builder. The grid and Previous/Next share that exact sequence, including missing cards. Only Synergy modes show the score metric; all prior sorts/filters/navigation stay available.

## Explicit methodology

Canonical cards are grouped by Oracle identity, with normalized-name fallback/migration consistent with the stored metadata. Printing groups aggregate quantities rather than producing duplicate analysis. Entry decks use their whole main decklist plus the actual `Deck.commanders` references; legacy assignment-only decks retain their conceptual quantities. Ownership, assignment state, price and popularity are not strategic inputs.

| Signal | Base evidence units |
| --- | --- |
| Explicit payoff / typal interaction | 4 |
| Reanimation / Aristocrats payoff operation | 3.5 |
| Strategy / enabler | 3 |
| Supporting mechanic / role | 2 |
| Placing +1/+1 or -1/-1 counters | 2 |
| Resource generation | 1.8 |
| Interaction | 1.5 |
| Combat keyword characteristic | 0.6 |
| Matching creature subtype alone | 0.35 |

Each assignment is multiplied by its Card Intelligence confidence. Typal cost reduction/tutoring is treated as an enabler, not a payoff. The strongest signal on a card carries the family contribution; secondary related signals add 20% each, capped at 1.2 additional units. This prevents redundant taxonomy tags on one card from overwhelming independent evidence. Quantity uses diminishing influence: `1 + 0.35 * log2(min(quantity, 4))`. Repetition boosts a main-deck family by `1 + min(0.6, log2(distinct contributors + 1) / 6)`.

A theme normally needs at least `max(2, ceil(6% of non-Commander canonical identities))` independent main-deck contributors. Strong Commander evidence can relax this by one contributor if the main-deck base weight is at least 2. The Commander cannot introduce an unsupported theme. Commander evidence is initially multiplied by 2.5, then capped at **45% of that family's main-deck base evidence** (under 31.1% of the combined weight before the repetition adjustment). Thus an unrelated Commander cannot override the actual 99.

Subtype signals are considered when an explicit type interaction exists or the type occurs on at least three canonical identities. A card merely being an artifact never creates Artifacts Matter. Discard outlets require an actual graveyard context to contribute to Graveyard; life drain requires death/sacrifice context to contribute there. An isolated Treasure or counter mechanic cannot dominate a large deck. Combat keywords are weak evidence and never establish a claimed combat win condition.

Primary families must reach both 2 weighted units and 10% of the strongest family's weight; at most seven are shown. We do not pad weak decks to four themes. Largest-remainder integer rounding normalizes supported primary weights to **100%**, with stable ID tie-breaks. These are relative theme weights, not probabilities, raw card percentages or power ratings. Subthemes and original card/Commander evidence remain inspectable.

## Synergy and explanations

Each non-Commander canonical identity receives a score from 0–100, rounded to five-point steps:

- Theme support baseline: 10 points when a primary-theme connection exists.
- Dominant-theme alignment: up to 40, using connection strength and that family's importance relative to the leading theme.
- Breadth of theme overlap: up to 25, weighted by normalized theme weights.
- Explicit Commander connections: 10 each, capped at 15, requiring actual matching Commander evidence rather than a shared color/type alone.
- Payoff relationship: 10, or enabler relationship: 6.
- Supporting role: 5. Without a primary-theme connection, a generic role gets a 15-point baseline; no evidenced connection/role gets 0.

A matching creature subtype becomes stronger *deck-relative* support (2.8 minimum units) when the deck contains explicit type payoffs/enablers. Its raw DNA contribution stays weak. Mana value informs early-mana supporting roles, not generic card quality. Scores 75+ are Strong fit, 45+ Supporting fit; smaller values mean Limited theme evidence. Utility cards and basic lands can score low without being bad cards.

The contextual section shows actual theme and Commander evidence, roles and named point components. It explains rounding/capping and excludes prices, EDHREC, market value, rankings and raw power. Manual Card Intelligence additions/suppressions feed the derived result; they never write a deck-relative score back into universal tags.

## Deterministic summary and Core Plan

Templates describe the top strategic families and use source subthemes to distinguish self-mill, recursion and reanimation, token generation versus board support, and death versus sacrifice effects. A material Commander connection adds a sentence naming the Commander and supported families. Supporting roles alone are explicitly qualified instead of inventing a focused strategy. Weak evidence gets an honest fallback. No LLM, paid API, speculative turn sequence or unsupported win condition is used.

Core Plan stays compact and collapsed by default. It lists the top two strategic families, up to three supporting engines and a named explicit payoff from the evidence, or says none was identified. Strategy anchors are actual deck cards with the strongest supported relative fit.

## Cache, lifecycle and persistence

`DeckDnaCache` is a 64-entry in-memory cache. The key contains deck ID, stable full conceptual-content revision, DNA engine version and Card Intelligence ruleset. The revision includes canonical quantities, Commander identities, relevant metadata fingerprints, mana values, creature-type signals and effective assignments/evidence. This avoids timestamp collisions and naturally invalidates after add/remove, Commander changes, deck import changes, metadata/ruleset changes and manual corrections.

Sorting, theme filters, Next/Previous, rename and unrelated inventory changes reuse the result. Filling an existing missing entry with a physical copy does not change strategy; changing the conceptual quantity does. Returning to an earlier composition can reuse its earlier cache entry. React memoization avoids even preparing the DNA input on each navigation render. A `mtg:deck-dna` performance measure is recorded only on a real calculation and supports the browsing-no-recalculation assertions.

No persisted derived state or schema migration is introduced. Reload rebuilds DNA safely from the stored decklist, canonical metadata and corrections, without fetching card data for this analysis. Backups keep the approved fields and export version 0.5.0; the rebuildable cache is not duplicated into backup. Existing collection import/re-import, assignment accounting and storage transactions are unchanged.

## Regression decks and tests

`tests/dnaFixtures.ts` contains deterministic canonical-shaped semantic fixtures with Oracle excerpts for Lathliss Dragon typal, Atraxa Counters, Meren Graveyard/Reanimator and Ghave Tokens/Aristocrats. They reuse bundled metadata where available. Additional names/excerpts are curated fixtures, not claims of newly downloaded full Scryfall snapshots or complete real-world decklists.

25 new unit cases cover the four theme profiles, subtheme aggregation, normalized/deterministic percentages, explicit payoff versus incidental support, Commander bounds and replacement, composition changes, quantity/printing grouping, missing/owned equality, price independence, honest explanations/weak evidence, manual suppression, legacy decks, caching/invalidation, Synergy sorting/theme filtering and a 100-distinct-card analysis/cache performance guard (under 1 second on the test runner).

Three browser workflows at each of the five sizes (15 cases) cover saved DNA, sum-to-100 and reload determinism, summary/Core Plan/anchors, inspectable In This Deck with missing-card context, both Synergy sorts, visible-sequence Next/Previous and position/boundaries, theme selection/clear, unchanged percentages through filtering, no analysis during browsing, assignment-neutral caching, conceptual quantity add/remove invalidation/reuse, unchanged Collection detail, Axe/overflow checks and screenshots.

All prior v0.3.1/0.3.2/0.4.x suites remain present, including the 4,421-row upload/interruption/cache/repair regressions. Only the two release-version backup assertions change from 0.4.2 to 0.5.0.

## Validation

**Passed:** lint; **261 unit tests** (236 preserved + 25 new); TypeScript/Vite production build; **275 production browser tests** across all five approved sizes (260 preserved + 15 new) in **10.8 minutes**, with no skips; dependency audit (**0 vulnerabilities**); and `git diff --check`. The three targeted 360px DNA workflows also passed before the full run. A final clean `npm ci` passed; lint, all 261 unit tests, build and audit passed again. The rebuilt production asset hashes match the artifact used by the full browser suite. Dependency records are unchanged from the baseline; only the two application-version fields in the lockfile change.

```sh
npm run lint
npm run test:unit
npm run build
TEST_PRODUCTION=1 npm test
npm audit --cache /workspace/.npm-cache
git diff --check
```

Approved sizes: 360×800, 390×844, 430×932, 768×1024, 1440×1000.

## Analytical limits and deployment

These are transparent heuristics over saved Card Intelligence, not a complete rules engine or calibrated card-quality model. Unusual wording, missing Keywords/faces/Oracle text, interactions not represented by the taxonomy, card-choice intent and combos without explicit supported signals can be missed. Manual corrections can influence conclusions. The normalization hides unselected minor families, and shared families intentionally compress distinct subplans. A family name is a presentation aggregate; inspect its actual subthemes. No claim of win rate, power level, optimal cuts or complete gameplay understanding is made.

The derived cache lasts for the browser session, not across reloads. No background cloud analysis, external comparisons or recommendations are added. Existing import matching and ownership limitations remain those documented for v0.4.2. Retained not-imported ManaBox rows have no canonical decklist entry to analyze and therefore cannot contribute until resolved.

Cloudflare deployment is not verifiable here: no deployment connector/CLI is configured, and GitHub commit-status API access returns `Forbidden`. A Git-triggered build must not be claimed successful without evidence. No v0.6.0 work is included.


## Release scope

No material scope deviations. Fewer than four supported families are intentionally allowed rather than inventing incidental themes. The approved v0.4.2 data/ownership/import/navigation behavior is preserved; only backup release-version assertions were updated in existing tests. README, CHANGELOG and ROADMAP identify v0.5.0 as Current and v0.4.2 as Approved. The validated release is committed and pushed to GitHub `main`; Cloudflare status remains unverified as described above.
