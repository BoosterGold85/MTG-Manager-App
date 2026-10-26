# v0.6.6 — Upgrades I Own: two separate questions, and Mayhem

Baseline: v0.6.5 Clones & Copies (approved). Directive: rebuild Upgrades I Own around two questions that are never combined, keep the v0.6.3 factual engine, and model Mayhem through the typed intelligence system rather than as display-only DNA.

## Shared factual chain

Canonical card → CardFacts → typed Oracle effects → mechanical relationships. Both goals read the same facts; neither writes a deck or moves a copy.

- `src/synergy/facts.ts` (CardFacts 1.2.0): controller/beneficiary `Scope` (`you`, `opponent`, `each_opponent`, `target_player`, `each_player`, `other_players`, `unknown`). `benefitsYou` is true only for `you` and `each_player`; an "any player" effect is never widened to "you". Imperative removal defaults to `you`. New typed facts: discard (`who`, `mode` cost/choice/loot/rummage/hand/effect), cast-from-graveyard-after-discard, damage (source vs multiplier, combat, amount, creature targets, opponent reach, triggered), combat roles and attack triggers, scoped token multipliers (e.g. Treasure only), answer coverage by permanent type with mass/instant-speed flags.
- `src/upgrades/cardFunction.ts`: per-card function summary (roles, answers, coverage, engine pieces, effective mana value for self-reducing costs, standalone impact with reasons, low-impact body analysis, confidence and uncertainties).

## Mode 1 — Build Around My Commander

- `src/upgrades/blueprint.ts`: Commander Blueprint from the Commander's own typed mechanics, token types, strategy features and mana value plus a normal 100-card structure (36 lands, 10 ramp, 10 card advantage, 8 interaction, …). Generic adjustments: cost ≥6 → +2 ramp; abilities that need the Commander on the battlefield → protection; self-attacking/Voltron → more protection, fewer finishers; graveyard → recursion; spells → card flow; tokens/sacrifice/lands/discard plans. No empty-99 deck analysis and no card-name exceptions.
- `src/upgrades/build.ts`: **Commander Fit** (0–100) from verified Commander interactions (shared v0.6.3 engine), supported creature types, token types, shared mechanics and scoped engine relationships; structural support is capped well below Commander-specific fit. **Build Priority** combines fit (discounted by Commander dependency) with standalone impact × blueprint role weight, with penalties for low-impact bodies and nonbos.
- Bands: Fit Exceptional ≥90, Excellent ≥80, Strong ≥68, Good ≥55, Situational ≥35, Weak. Priority Core ≥85, High Priority ≥72, Strong Consideration ≥60, Consider ≥47, Situational ≥34, Low Priority.
- Default sort: Build Priority → Commander Fit → confidence → name.

## Mode 2 — Improve My Current Deck

- `src/upgrades/upgrade.ts`: deck utility vector (Commander plan, mana, curve, card advantage, interaction breadth, protection, resilience, engines, finishing, card quality, redundancy, Commander dependency) with saturating curves. **Upgrade Value** = utility after the best valid one-for-one swap − current utility.
- Valid cuts protect functions: never the Commander; land ↔ land only; essential floors for ramp, card advantage, interaction, protection, wipes and finishers unless the candidate replaces the function; never the only creature/artifact/enchantment answer; never the only controlled discard when the deck needs it. Basic lands are fungible (one copy leaves).
- Scoped engines: damage multipliers × damage sources, extra combats × attack triggers/attackers, token multipliers × matching token sources only, discard enablers × discard payoffs, each with diminishing returns.
- Bands: Major ≥2, Strong ≥1, Moderate ≥0.45, Minor ≥0.15, Sidegrade ≥−0.15, Downgrade. Low confidence is capped at Minor Upgrade and ranks after confident results in the same band.
- Output: best swap, alternatives within 0.5, reasons, concerns, cut reasons, confidence and a developer trace (`?trace` in the URL). Minimum 60 main-deck cards.

## Mayhem

Mayhem is a typed mechanic, not a keyword label:

- Card Intelligence (ruleset 0.3.4): `mayhem` ("Mayhem Discard-Cast"), `madness` ("Madness Discard-Cast"), `discard-payoff` tags, labelled distinctly from the keyword filters (`src/intelligence/rules/discard.ts`).
- CardFacts: a Mayhem card is a conditional cast from your graveyard after being discarded this turn. Controlled discard, looting and rummaging are enablers; opponent discard is not; Mayhem is not reusable recursion.
- Deck DNA: **Discard / Mayhem** family. Its weight is backed by typed `controlled-discard` signals from the deck's real outlets.
- Recommendation and upgrade scoring use actual discard support (verified enabler ↔ payoff relationships and the `controlledDiscard` blueprint need).

## UI

Deck → **Upgrades I Own** → "What are you trying to do?" (Improve My Current Deck / Build Around My Commander). Build mode shows Build Priority and Commander Fit with reasons, concerns, dependency and timing. Improve mode shows the Upgrade label and value, best swap, reasons and alternatives; Compare shows component deltas for the best swap or any deck card. Card Detail opened from Upgrades I Own shows Commander Fit, Build Priority and Upgrade Value separately. Analysis runs after the goal renders, with an "Analyzing owned cards…" status.

## Tests

- `tests/unit/upgrades.test.ts` (30): Lathliss Mode 1 named expectations (Dragon Hatchling fits but has lower priority; Hoarding Dragon above it; Fiery Emancipation; staples; Death by Dragons and Xorn get no wrong-scope token credit; blueprint derivation; ordering). Reign Mode 2 (every upgrade names a real cut; Hatchling not a top upgrade; Fiery valued through damage engines; Death by Dragons at best a sidegrade; Vandalblast valued for coverage; band boundaries; function-protecting cuts). Mutation tests: Xorn's Treasure value falls to zero without Treasure sources; extra combat loses engine value without attack triggers; damage multiplier loses engine value without damage engines; fewer Dragons raise and more Dragons lower Dragon marginal value; Chaos Warp's coverage value rises when broad answers are removed. Eight cross-archetype fixtures (Dragon typal, Spellslinger, Aristocrats, Landfall, Voltron, Artifact, Tokens, Graveyard). Large-collection budget test.
- `tests/unit/mayhem.test.ts` (5), `tests/unit/factsScope.test.ts` (5).
- Browser: `synergy.spec.ts`, `recommendation.spec.ts`, `strategy.spec.ts` rewritten for the two-goal flow (goal chooser, disabled Improve below 60 cards, Build and Improve lists, comparison, detail scores, availability/search/sort, progressive rendering, no writes, no Scryfall requests, axe, no horizontal overflow).

## Performance

The shared recommendation engine now caches per-deck-card text, roles and source events, so scoring a candidate no longer re-derives them for all 99 deck cards (about 7× faster per candidate). Swap simulation precomputes each deck card's single-copy contribution and links. On a 4,421-candidate collection with saved analysis: Build ≈2.5 s, Improve ≈3.6 s (including Build), comparable to the previous explorer.

## Known limitations

- Fixture Oracle text for the new candidates (`tests/upgradeCandidates.ts`) and the Mayhem cards is written from memory: Scryfall was not reachable from the build environment. Re-check against Scryfall when refreshing fixtures.
- Band boundaries and component weights are initial calibrations pinned by the regression fixtures. They will likely need tuning against real decks.
- Mode 2 evaluates one-for-one swaps only; it does not solve multi-card changes.
- Small archetype fixtures (10 cards) only check the Commander-plan component in Mode 2; full Mode 2 calibration is pinned on the 100-card Reign of Dragons deck.
- The pre-existing 4421-card synergy timing test (5 s budget) can still be flaky under parallel load.

## Validation run

- `npm run lint`: clean. `npm run test:unit`: 447 passed. `npm run build`: passed. `npm audit`: 0 vulnerabilities. `git diff --check`: clean.
- Playwright (production build): 335 passed across mobile-360, mobile-390, mobile-430, tablet and desktop.
