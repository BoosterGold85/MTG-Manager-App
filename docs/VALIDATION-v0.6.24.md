# v0.6.24 — Resource and deck semantic coverage

This release includes the previously prepared land-deck and Uugguu coverage fixes and implements
the confirmed Hurska audit findings. It builds on remote main `6d0286b`, retaining its Cloudflare
Worker/SPA build configuration. The read-only audit capture remains a historical baseline outside
the repository; this document describes the implementation that followed it.

## Resulting behavior

- Life-gain observers do not count as initiating effects. Food creation supplies a conditional paid
  life-gain option, while sacrificing Food to another ability does not automatically gain life.
- Food-sacrifice conditions bind their required resource subtype and use distinct cache keys.
  Treasure-only and observer-only effects do not qualify without an applicable type grant.
- Life amount replacements, Clue/Food/Treasure bundle replacements and additional-Food replacements
  are recognized as modifiers of actual events. They do not originate events or prove infinite loops.
- Food activation discounts preserve generic versus colored costs, tapping and sacrifice requirements.
  Artifact-to-Food grants retain their during-your-turn restriction. Producing Food does not make the
  producing permanent itself a Food. Food subtype alone does not grant the predefined token's ability.
- Kutzil-style combat conditions require power-boosting support and player combat damage. A plain
  unmodified body does not establish either condition. Counter distribution and Equipment boosts
  remain valid conditional support.
- Variable modal removal and targeted life gain are understood separately. Land-subtype tutors gain
  the Land classification without inventing a basic-only restriction. Target-controller compensation
  is not counted as your resources without the appropriate ownership context.
- Named-partner tutoring requires the actual named card in the deck. It grants no tutor role for an
  absent partner and does not permit arbitrary partner commanders.
- Optional hybrid/X payoff payments are explained explicitly. These are potential interactions,
  not a simulation of current battlefield state or available mana.

The exact supplied Hurska list has 100 cards and 80 canonical names. Its tested ability shapes now
have no unsupported or partial clauses. Three procedural land entries account for 23 physical lands;
the remaining 77 names are full under the engine's coverage definition. Full coverage does not mean
an exhaustive Magic rules simulator.

The earlier land and Uugguu mechanisms are documented in `LAND-DECK-COVERAGE.md` and
`UUGGUU-DECK-COVERAGE.md`. Uugguu's captured Commander legality remains `not_legal`; semantic
support does not override canonical legality.

## Data and compatibility

Hurska and Uugguu canonical records are offline fixtures, not runtime card-name exception tables.
Production logic uses effect text, types, event scope, conditions and actual compatible deck partners.
No ownership quantities, saved deck entries or manual corrections are reset. Ruleset 0.3.9 refreshes
automatic analysis, while updated fact/function/condition and ranking-cache versions invalidate stale
derived results. Recommendation and Brew score weights, formulas, bands and thresholds are unchanged.

Prior frozen holdouts and original golden artifacts are preserved. The existing reviewed land-coverage
snapshot remains the applicable golden output. The source-hash guard is refreshed for these intentional
Commander semantic changes and includes the new resource helper; it continues guarding later unrelated
Standard/Legacy development.

## Validation

The regression fixtures include the 13 land cards, the 100-card Uugguu list, and the 100-card Hurska list.
The 90 Hurska checks cover all 80 names and renamed equivalents, event/observer separation, resource
subtypes, replacements, costs, conditional combat, modal removal, land-subtype ramp and beneficiary
scope. The full-deck test forbids network access and verifies its in-memory saved data remains unchanged.

Metadata/text-derived resource caches are bounded and shared across semantically identical reprints;
empty ability records take a fast path. Earlier timing failures were investigated without increasing
the explicit 4,421-candidate or 1,500-candidate performance budgets.

Final verification:

- Lint and TypeScript/production build passed.
- Production-browser regression checks passed: 15/15 across five viewports.
- Full unit run: 929/931 passed; both failures were elapsed-time performance assertions.
  The deck-analysis timing assertion passed on isolated rerun. The candidate-ranking timing
  assertion passed in an isolated run but remains intermittent in this environment. Budgets
  were not relaxed. All functional, golden, frozen-regression and source-hash checks passed.
- Git whitespace validation passed.

Production deployment is managed by the existing main-branch Cloudflare integration.
