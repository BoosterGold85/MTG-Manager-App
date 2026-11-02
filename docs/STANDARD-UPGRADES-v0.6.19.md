# v0.6.19 — Experimental Standard Upgrades

## Scope and workflow

This is the separately authorized **Standard-first** phase. Open a Standard deck → Upgrades → Check owned-card legality. Search the owned nonland catalog, review its exact printing/finish/language, availability and decks currently using it. A card already in the deck remains eligible for additional copies until its combined main/sideboard copy limit is reached.

Choose **Compare**, explicitly select a different nonland main-deck entry and choose one to four copies. No cut is preselected. The preview re-evaluates the full intended main deck, including missing/unassigned decklist entries, and displays modeled Upgrade Value, lost factual role coverage, main-deck copy counts and the chance of drawing at least one incoming card in a random opening seven (no mulligans). It shows the precise outgoing assigned variants that will be released. Read both cards before deciding.

**Confirm Standard change** performs a fresh Scryfall check of the selected incoming printing. A failed request or a nonlegal response saves nothing. Then a revision-checked repository operation revalidates format, copy limits, quantity, ownership availability, selected cut and legality proof (same printing/name, at most five minutes old), and commits one atomic collection snapshot. The same quantity comes out and goes in, main-deck count stays fixed, sideboard and other decks remain unchanged, and collection quantities owned never increase or decrease. Unassigned decklist copies are removed before physical assignments; the preview mirrors that rule. Incoming copies add actual decklist quantity rather than silently filling an existing missing request and shrinking the deck.

Unavailable candidates can be compared but cannot be confirmed. Assigned copies are never stolen from another deck. Comparisons are read-only. The main deck must have at least 60 entries by quantity before swaps are available. Existing format warnings remain visible; this is not whole-deck tournament certification.

## Isolated model, not a Commander retune

All new recommendation code lives in `src/standard/`, with a separate `StandardUpgrades` component and separate repository action types. The Commander tab still calls its original component. Shared Oracle fact/condition/capability helpers are consumed read-only; the Standard engine never calls the Commander scorer or profile builder.

`tests/commander-protected.sha256.json` freezes the approved v0.6.18 baseline (`500ed0f`) for every source file under `src/dna`, `src/synergy`, `src/upgrades`, plus the Commander tool, hook and recommendation worker. A unit test rejects changes to those files. The frozen twelve-deck Commander audit also checks recommendations against the published v0.6.16 order and scores. Commander ranking remains **0.6.16**; Standard model is **0.1.0**.

Standard Plan Fit and Brew Score are **experimental heuristics**, not established competitive ratings and not comparable with Commander scores. There are no popularity feeds, tournament-result claims or win-rate predictions. The existing unfinished Commander generalization research remains unfinished.

## Explainable calculation

The main deck supplies its actual quantities to the existing factual condition evaluator. A candidate gets relationship evidence only from explicit capability relationships in either direction or from supplying an understood condition on an existing card. Matching color or a generic shared tag alone is not interaction evidence.

- Relationship density uses up to four copies per other main-deck entry. Supported candidate conditions require an understood condition with supply factor at least 0.5. Evidence names actual supporting cards.
- Let `quality = min(1, 2 * relationshipDensity + sum(supportedConditionFactors) / 4)`.
- Plan Fit starts at `65 * quality + min(15, 5 * factualRoleCount) + 10`. It subtracts three points per mana value above the deck's nonland average plus one. Scores are rounded and bounded 0–100.
- The separate exploratory Brew lens is `85 * quality`, plus five for a card not already in the main deck, bounded 0–100. It is an interaction lens, not a claim of rarity or originality.
- Deck utility averages Plan Fit over actual nonland copies and adds diminishing factual role coverage: square root of the quantity-weighted role total, weighted four for interaction/card advantage/protection and two for other recognized roles. Upgrade Value is utility after minus utility before, rounded to one decimal. There are no imported Commander targets or archetype-specific competitive targets.
- The default catalog prioritizes available copies, then Plan Fit, Brew, name and owned-record ID. Users can explicitly choose Brew ranking. No automatic cut selection or multi-card optimization runs.

Primary cast-cost symbols are screened against saved main-deck land mana production (falling back to land identity). Hybrid alternatives and generic/Phyrexian alternatives are understood; snow/colorless are distinct symbols. This is **not** Commander color-identity restriction. Unsupported cast costs are omitted and counted as needing mana changes. Lands and land-faced MDFCs are omitted from this first-phase swap flow.

Potentially severe textual costs/effects (library exile, losing the game, skipping a turn/draw, self casting restrictions or discarding the hand) are conservatively omitted and counted separately. This model cannot validate their mitigating combos. These are broad rules, not named-card exclusions.

## Legality, caching and responsiveness

Only owned playable nonland printings with a saved `standard: legal` check at most seven days old enter analysis. Unknown/stale and known-nonlegal records are counted separately. The explicit legality action uses the existing paced, retried Scryfall batch path for owned nonlands and the current deck, bypassing stale metadata caches. It updates only legality metadata through the existing atomic revision guard. A partial network result is never saved as a complete check.

Browsing/filtering/sorting makes no Scryfall API requests. Artwork can still require its image host. Confirmation checks only the selected incoming printing again; a connection is required. A saved snapshot cannot guarantee future rotation/ban status or all tournament rules.

Analysis and comparisons run in a distinct cancellable module worker. State/deck/model/retry identities guard results; superseded workers terminate, and stale results never enable actions. A bounded twelve-entry catalog cache is scoped to immutable collection state and expires with legality. Expiration triggers local reclassification, not an automatic API call. Changing search/rank does not rerun the engine. Worker startup/analysis failures offer retry.

## Limits and deferred work

- **Standard main deck only.** Legacy upgrades, sideboard matchup advice, land/mana-base changes and automatic swaps are deferred. Legacy deck management/import remains available as before.
- Tests use an explicitly synthetic Standard fixture to validate mechanics. No real human Standard deck has yet been supplied for recommendation-quality calibration; these tests are not a competitive-quality benchmark.
- Mana screening does not model source counts, restricted mana, sequencing, mulligans or curve probabilities; missing face-level cast-cost metadata also limits screening. Opening-seven math only describes drawing that named card.
- Oracle extraction and condition coverage are incomplete; scores can miss useful cards or overvalue recognized roles. Severe-cost omissions can exclude valid combos. Main-deck history, opponent metagame and sideboard plans are not inferred.
- One incoming owned record/printing and one outgoing entry per review; mixed incoming printings require separate reviews. Existing outgoing assignments may be different variants and are listed explicitly before confirmation.
- No collection migration, account system, inventory reset, new Commander scoring or new external scoring data.

## Validation and deployment

- `npm run test:unit`: **654 passed**, 43 files, including twelve Standard/source-protection cases. Covers extra copies, combined-board limits, stale/unknown/banned metadata, severe downsides, primary/hybrid mana, quantity/revision guards, exact release variants, missing-entry growth, physical availability, unchanged Commander deck data and fresh confirmation proof.
- `RECALL_OUT=/workspace/standard-recall.json npx vitest run tests/audit/recall.audit.test.ts`: passed offline. All twelve decks' top twenty names, order, Brew and Synergy scores exactly match `docs/ranking/results-v0.6.16.json` (240/240 positions). All 27 protected source hashes match `500ed0f`.
- `npm run lint` and `npm run build`: passed on the final source. TypeScript and production output are valid; the existing main-chunk warning remains.
- `npm audit --omit=dev --json`: **zero production findings**. Full `npm audit --json`: thirteen inherited moderate development lint-toolchain findings, zero high/critical. No dependency changes or incompatible overrides.
- `TEST_PRODUCTION=1 npx playwright test`: **445/445 passed** in 18.1 minutes, across 360×800, 390×844, 430×932, 768×1024 and 1440×1000. This includes all 420 existing cases and 25 initial Standard cases.
- Added a dedicated catalog/review accessibility and screenshot case, then ran `TEST_PRODUCTION=1 npx playwright test tests/browser/standardUpgrades.spec.ts tests/browser/formats.spec.ts`: **50/50 passed**. After matching the availability dropdown to existing controls, rebuilt and ran `TEST_PRODUCTION=1 npx playwright test tests/browser/standardUpgrades.spec.ts`: **30/30 passed** on the final source. The combined runs verify **450 distinct browser cases** (420 existing + 30 Standard), rather than claiming a single 450-case run.
- New browser cases cover two-copy preview/no writes/confirmation/reload, allocated copies and availability filtering, explicit fresh legality, a printing banned at confirmation, and responsive 3,000-candidate background analysis with cancellation. Controls and navigation retain two-second action budgets; no physical-phone performance is claimed.
- Catalog and review have zero automated Axe violations at all five sizes, no horizontal page overflow, and captured screenshots; mobile catalog/review screenshots were also visually inspected. Chromium emulation is not physical iPhone/Android or installed-PWA validation.
- `git diff --check`: passed. Only Standard-specific recommendation files, explicit routing/repository branches, release docs/metadata and tests change; all protected Commander source files remain unchanged.

Cloudflare cannot be verified from this environment: the enforced network policy does not allow the Workers hostname, and no Cloudflare credentials are configured. The existing GitHub integration is the deployment path; pushing main is not proof of a completed deployment. After deployment, `/version.json` must show app **0.6.19**, Commander ranking **0.6.16**, Standard ranking **0.1.0** at https://mtg-manager-app.lhauswirth15.workers.dev .
