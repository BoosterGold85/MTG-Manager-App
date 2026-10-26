# v0.6.3 — Recommendation Engine vNext

Baseline: `f426199` (v0.6.2). [Supplied executable](v0.6.3-recommendation-vnext-executable.md). The uploaded text ends mid–Pass 5; no missing continuation was invented. The user explicitly directed continuation through the supplied passes with documented review checks. All functional sections supplied, including confidence and optional replacement comparisons, are implemented. Work stops before v0.7.0.

## Documented review gates

### Pass 1 — Facts and typed classification

`src/synergy/facts.ts` separates canonical observations from scoring. Typed library searches retain destination, basic-only restriction, targets and source text. Token facts retain actual token types, count, granted abilities, face and controller. Firebending belongs to the created token rather than its creator; mana is explicitly card- or token-scoped. Ramp distinguishes persistent sources, rituals, temporary combat mana and smoothing. Tribal effects and Changeling are factual classifications, not score bonuses. Unknown quantities/destinations and missing metadata remain explicit uncertainty. Visual colors are optional canonical data and are never substituted with color identity.

Gate: 29 initial classification tests passed, including canonical Scryfall snapshots of both named regression cards. Subsequent integration adds controller and conditional-output checks. Existing Card Intelligence taxonomy/overrides and descriptive Deck DNA remain intact. Optional canonical visual colors are preserved by normalization; no collection schema migration.

### Pass 2 — Commander and existing-card relationships

The existing restricted event matcher is reused with factual emissions rather than tag-derived actions. It checks cast versus entry, nontoken, required keywords, own/other triggers, controller, exact damage and typed objects. Compatible amplification/copy/untap/blink and factual graveyard/proliferation relationships retain rules evidence. Every nonzero Commander relationship stores evidence; its independent raw scale is 0–25. No score is awarded merely for a shared generic label.

Actual-deck testing found and corrected two parser errors: nested reminder text being treated as another ability of the parent spell; and ability-word prefixes preventing recognition of self-only triggers. Death is not automatically sacrifice. A player’s own actions cannot satisfy an opponent-only trigger; explicit forced opponent draws can.

Gate: exact Reign Wayfinder and Fire Nation tests, existing trigger restriction cases and the new controller/ability-word regressions pass. Generic card tags may change discovery/evidence presentation, but cannot invent or suppress canonical Oracle relationships. Opponent-only token triggers also cannot create a generic priority for the player’s own tokens.

### Pass 3 — Typed profile and needs

The immutable derived profile holds factual role counts, unmet targets, supported creature/token types, effects, weak/saturated areas and curve data. Counts use conceptual deck quantities, never Collection ownership quantities. Wrong-type tokens do not fill the Dragon-token role. A conditional token-producing Commander without its required inputs does not become three unconditional token sources. Basic land to hand supplies smoothing utility, never unrestricted tutoring/ramp; a fulfilled land target earns no missing-land role credit.

Targets retain the existing contextual scaling but counts are rebuilt from typed effects. Lands include the supplied 32 Mountains and six other lands (38 total). Existing independent Commander Colors eligibility and full-deck exclusions remain intact.

Gate: 69 exact printing snapshots resolve the supplied 100-card list offline; token priorities, role need/saturation, ownership independence, conditional producers and source scope tests pass.

### Pass 4 — Negative scoring and confidence

Explicit negative adjustments cover wrong tribe/token, redundancy, curve congestion, poor efficiency, low impact, unsupported subthemes, missing enablers, developed-board-only payoff, same printed function, nonbo and incompatible identity. Lack of Commander interaction by itself is not a penalty: the noninteraction guard only applies to a purported relationship that did not validate. Effects that replace/exile the player’s own graveyard or wipe its artifact engine are distinguished from opponent-only/one-sided effects.

Confidence is High/Medium/Low with separate reasons, based on canonical classification completeness and parsing/mode ambiguity. It contributes no score points. It cannot force a cut suggestion. The developer-only `src/synergy/developerTrace.ts` entry exposes typed facts, needs, source evidence, components, penalties, gate and exact totals; no UI imports it and it is omitted from the production entry graph.

Gate: existing anti-synergy/curve/efficiency regressions plus new confidence, identity and scope checks pass.

### Pass 5 — Normalization and integration

Weights are centralized in `SCORE_WEIGHTS`, sum to 1, and currently contribute **20 Commander / 20 theme / 25 needed role / 20 efficiency / 10 curve / 5 existing-card relationships**. The brief’s **proposed starting** 25/20/20/15/10/10 weights were adjusted during calibration: with them, an efficient, genuinely needed role-only removal spell could reach at most 45 and remain Weak Fit despite the brief’s explicit utility requirement. The calibrated weights permit Worth Considering without inventing Commander/theme points. Raw Commander relationship strength still uses the required independent 0–25 scale; the UI distinguishes it from its weighted contribution.

The old seven-component per-card scorer is retired. Generic overlap independently contributes **zero**. Positive contributions, signed negatives and any explicit eligibility/gate adjustment sum exactly to the raw score, then clamp to 0–100. An 80+ result requires verified strong Commander interaction, at least two distinct major engines, or extreme unmet role need with excellent efficiency and no resolved conflict. A one-engine near-80 case proves the gate can reduce the result to 79. No distribution shaping, card-name exception, prices or popularity.

Bands: 90 Exceptional, 80 Excellent, 70 Strong, 60 Reasonable, 50 Situational, 35 Weak, 0 Poor. Tiers retain ≥70 / 50–69 / below 50, with below-50 initially collapsed. Ties use confidence, Commander relationship, need, efficiency, availability and stable name/identity. Caches are bounded to four active profiles and 10,000 score/fact entries; expansion uses the cached result. Existing large-candidate performance checks remain included.

Gate: exact component budgets/arithmetic, bands, 80+ eligibility, cache/semantic invalidation, price/ownership independence and eleven archetype tests pass. A role-only removal spell reaches Worth Considering when its function is genuinely missing.

## Replacement comparisons and UX

Existing Compare can suggest up to three materially lower-scoring, function/type-compatible comparisons in nearby curve space. It excludes Commanders, preserves land/nonland slots and protects uncovered essential functions. It abstains for low-confidence candidates or when no valid comparison meets the gap threshold. Suggestions explain role/type overlap, mana values, score delta, Commander differences and resolved redundancy. Selecting one only populates the existing comparison. Six component differences are displayed with an explicit local-heuristic qualification; there is no save/swap/delete/move action.

Compact candidate summaries remain deterministic and evidence-based; exact facts and math remain under lazy Why this score?. Confidence is shown separately. Existing shared Card Detail, printing groups, availability/deck usage, search, progressive rendering, ownership and physical assignments remain intact. No new dependencies, account/cloud-sync work, external recommendations, automatic cuts or New Set Watcher.

## Exact-deck regression results

The user supplied the actual Reign of Dragons export during implementation. `tests/data/reign-of-dragons.manabox.txt` preserves it. Scryfall returned **all 69 requested exact set/collector printings** with no unresolved/substituted records. Quantities total **100**. Selected reproducible results are in [the JSON report](v0.6.3-reign-regression-results.json).

| Card | Fit | Commander relationship | Key evidence |
| --- | ---: | ---: | --- |
| Changeling Wayfinder | 70 — Strong | 25/25 | Changeling supplies Dragon type; nontoken entry triggers Lathliss; basic land goes to hand, with zero unrestricted-tutor/ramp classification. |
| Fire Nation Attacks | 12 — Poor | 0/25 | Two Soldier tokens; firebending is token-scoped; no Dragon-token or Lathliss trigger. Minor actual indirect deck relationships remain possible. |
| Dragon Tempest | 70 — Strong | 25/25 | Printed flying/Dragon entry payoff. |
| Utvara Hellkite | 86 — Excellent | 25/25 | Dragon attacks generate Dragon tokens; strong verified Commander/engine interaction satisfies the Excellent gate. |
| Alania’s Pathmaker | 14 — Poor | 0/25 | Off-plan creature; no strong missing-role benefit. |
| Harnesser of Storms | 17 — Poor | 0/25 | Off-plan creature with redundant payoff function. |
| Mongoose Lizard | 6 — Poor | 0/25 | Off-plan, low-impact body relative to this deck. |

The two named candidate fixtures reuse local test artwork where image identity is irrelevant; their Oracle facts are canonical Scryfall snapshots. Production artwork normalization is unchanged. These scores describe this exact deck context, not universal card strength. For example, the supplied list already contains substantial functional interaction; Chaos Warp’s score in that saturated list is not its score when removal is missing. The latter is separately tested and reaches Worth Considering with zero Commander points.

## Full validation

- `npm run lint`: passed.
- `npm run test:unit`: **394 passed** (342 baseline plus 52 added). Scoring/band/copy assertions affected by the requested model were updated; all non-scoring regression suites remain included.
- Focused production mobile browser run: **10 passed**, including both new actual-deck flows, existing scoring/search/comparison and deck-relative navigation.
- `CI=1 TEST_PRODUCTION=1 npm test`: **335 passed** (final clean production-build run, 12.3 minutes).
- `npm run build`: passed; JS approximately **516.77 kB / 160.89 kB gzip**, CSS **64.62 kB / 12.13 kB gzip**. Vite emits its standard advisory for a JS chunk above 500 kB; this is a warning, not a build failure. No dependency was added.
- `npm audit --audit-level=low`: **0 vulnerabilities**.
- `git diff --check`: passed.

Production browser projects: 360×800, 390×844, 430×932, 768×1024 and 1440×1000. Tests include axe, overflow, no Scryfall browsing requests, no recomputation on disclosure, exact arithmetic and unchanged saved-state snapshots. The existing 4,421-row importer and storage/ownership recovery cases remain part of the full run.

## Limitations and deployment

This is deterministic heuristic extraction, not a complete Oracle/rules interpreter, simulated game state, complete Commander legality validator or universal power rating. Unparsed, variable, modal and unusual interactions may remain conservative or incomplete. Role targets, efficiency, conditional source reliability and proposed cuts still need human review. A score difference is not an instruction to replace a card; no change is made automatically.

The original pasted export has a Commander heading followed by a blank line and no Main/Deck heading. The existing importer keeps a board active until another heading, so the offline parser regression adds **`// MAIN` after Lathliss** before resolving; all original card names, quantities and printings remain unchanged. The stored original paste is unmodified. No importer behavior was silently changed during this scoring pass. Anyone importing that exact text should add the Main heading.

Chromium mobile emulation does not establish physical iPhone/Safari behavior; optional WebKit/device checks were not run. Existing device smoke guidance remains available. Cloudflare deployment status is **unverified**; the static build configuration is unchanged, and a successful GitHub push/local build is not proof of hosted deployment.
