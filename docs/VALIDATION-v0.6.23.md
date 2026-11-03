# v0.6.23 — Ability-Level Semantic Coverage

Baseline: v0.6.22 at `266f2cb`. This was requested as part of "the current v0.6.17 work". v0.6.17 had already shipped as a preview, followed by v0.6.18–v0.6.22, so this is the next targeted semantic release, as the request's own fallback allows.

- The blind holdout corpus (`tests/audit/blind617`) and the real recall holdouts were **not run or inspected**. Their expectations are unchanged.
- No Brew Score work. Score weights and global thresholds are unchanged.

## What changed

- **Abilities** (`src/synergy/semantics.ts`). A card is split into keyword lines, static, triggered and activated abilities, loyalty abilities, Saga chapters, Class levels, dice-result branches and quoted granted abilities. Each ability gets typed capabilities (47 effect capabilities plus a team-keyword parser, and 17 rules-structure recognizers) and an access level:
  - immediate;
  - gated: Class level 2 counts 60% and level 3 36%; Saga chapter II counts 90%, III 80%, IV 70% (minimum 50%); opponent-state conditions count 50%;
  - inaccessible: weight 0, for ultimates beyond starting loyalty.
- **Card function.** `cardFunction` turns capabilities into roles and reasons. Gated abilities count at their weight; dice branches count at their expected value. Fourteen capability conditions (`conditions.ts`) gate each new dependency by actual deck supply: no suppliers, no credit, with suppliers named.
- **Coverage** (`src/upgrades/coverage.ts`). A card is full, partial, unsupported, vanilla or missing:
  - An ability is recognized only when a consumed capability, or an existing role, tag or rules capability, reads it.
  - An ability whose trigger condition is unverifiable is unsupported.
  - Missing data means the record has no rules text at all; `""` is a valid vanilla card.
- **Overview** (`analysisConfidence`). The binary "doesn't track … don't count" note becomes:
  - partially understood: "Recognized effects still count, but some interactions may be missing";
  - unsupported: "uses mechanics the app doesn't model yet";
  - missing data: "could not be matched to canonical card data".

  Partial notes always list cards, but lower confidence only at 10% or more of nonland cards (minimum 3).
- **Tags, DNA and Synergy:**
  - Dice tag and Deck DNA family; the Commander dice event, its emitted event and the Synergy verifier.
  - Ultimates beyond starting loyalty no longer tag a card.
  - "Gain life equal to" is life gain; "crews" with toughness is Vehicles; counter storage is a counters payoff.
  - New Synergy penalty `delayed_self_destruction`.
  - Ruleset 0.3.8; DNA and Synergy 0.6.23.

## Observed cards: before → after

The baseline is `docs/semantic/coverage-baseline-v0.6.22.json`; the result is `docs/semantic/coverage-v0.6.23.json`.

| | v0.6.22 (old warning) | v0.6.23 |
|---|---|---|
| Fully understood | — (no per-ability model) | 28 |
| Partially understood | — | 1 (Delina: "you may roll again") |
| Fully unsupported / "untracked" | 14 | 0 |
| Missing-data warning | 2 (both valid vanilla) | 0 (2 vanilla, no warning) |
| Counted only through a tag | 14 | 9 |
| With at least one role | 1 | 19 |

Per mechanic, each has the observed fixture, a renamed or rephrased synthetic, a negative control, and supply-present / supply-absent relationship assertions (`tests/unit/semanticCoverage.test.ts`, 35 tests):

- dynamic P/T (power from power or toughness, switching, team doubling) and Berserk's liability;
- loyalty accessibility;
- team keywords and self-sacrifice pumps;
- death triggers, without an aristocrats assumption;
- targeted spell copying, with opponent-targeting and multi-target negatives;
- triggered-ability copying, where activated, static and replacement abilities never supply;
- counter storage, never a counter source;
- friendly bounce, never removal;
- mass, repeated, delayed and granted blink;
- toughness crewing, needing Vehicles;
- selective sacrifice wipes;
- creature-tap costs, not sacrifice;
- cross-turn untap, which needs nonland tap permanents;
- dice: Commander event, suppliers / amplifiers / payoffs, branches, the zero-supplier negative, and amplifiers working only with a Commander that rolls;
- temporary attacking copies;
- Class levels and Saga chapters;
- conditional attack cheats;
- top-X cheats and multi-type selection, neither treated as draw;
- imprint copy engines;
- stat-scaled life gain;
- vanilla versus missing data.

## Regression safety

- **Preserved suites.** All v0.6.15 and v0.6.16 semantic and ranking suites pass, including trap rejection, causal relationship requirements, condition supply, loyalty accessibility, copy-versus-cast and attack-versus-entered-attacking.
- **Frozen recall facts.** The 72 frozen recall expectation occurrences keep identical facts, capabilities and tags (id, evidence, confidence, source). The test now ignores only the ruleset stamp, which must move with any rule change.
- **Constructed recall corpus** (12 fixed decks, 72 expectations; not holdouts), v0.6.22 → v0.6.23:

  | Metric | v0.6.22 | v0.6.23 |
  |---|---|---|
  | Obvious @10 | 10/24 | 10/24 |
  | Obvious @20 | 18/24 | 18/24 |
  | Hidden @10 | 15/24 | 16/24 |
  | Hidden @20 | 20/24 | 20/24 |
  | Trap rejection | 24/24 | 24/24 |

  17 expectation ranks move, almost all by one place. In the blink deck, Archaeomancer goes 4 → 1 and Peregrine Drake 14 → 7, because mass, delayed and granted blink now reach ETB reuse.
- **Golden** (`upgrades-v0.6.16.json`). The Elder Dragon War's Saga chapters are now timed, and chapter II reads as controlled discard: impact 0.78 → 0.68. Seven Reign candidates' best cut moves from Hit the Mother Lode to Chain Reaction (values ±0.01, labels unchanged). Build mode and all other cases are unchanged. Two over-credits were found and removed during review:
  - a one-shot "gain double strike until end of turn" read as a persistent team grant;
  - a "does something when it dies" note adding impact on top of the death effect's own value.
- **Explanation fix.** A positive swap whose gains are each under one point now names its small gains, rather than showing only concerns (found by the phone-task browser test). Text only.
- **Commander protection.** The protection hashes are re-pinned for this intentional semantic release and now also cover `semantics.ts`, `coverage.ts` and `utils/loyalty.ts`.
- **Other formats.** Standard and Legacy suites pass unchanged.

## Still unsupported among the observed mechanics

- **Delina's "You may roll again".** It's typed as extra roll supply, but the supply model counts cards, not rolls, so Delina reads as partial.
- **Relationship depth.** These are recognized and supply-gated, but don't yet change Deck Health: triggered-ability copying, counter storage, toughness crewing and imprint copying have no role. Their value shows in impact, explanations, conditions and Brew/Synergy links.
- **Commander-only access.** Far Traveler's grant is read as blink for the Commander, but whether the Commander is tapped at end step isn't simulated.
- **Slaughter the Strong's** total-power budget is recognized, but doesn't yet favor low-power decks in ranking.
- **Owlbear Cub's** opponent-state condition is a fixed 50% weight, not modeled from opponents' land counts.

## Validation run

- `npm run lint`, `npx tsc -b`, `git diff --check`: clean. `npm audit`: see the commit. `npm run build`: passed.
- `npm run test:unit`: 718 passed (47 files).
- Playwright on the production build: 525 passed across mobile-360, mobile-390, mobile-430, tablet and desktop.
- **Not run:** the blind holdout (`tests/audit/blind617`) and real holdout recall (`recall.holdouts`). They aren't authorized for this pass.
