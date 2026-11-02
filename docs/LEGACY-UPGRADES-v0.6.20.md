# v0.6.20 — Legacy Upgrades & Interesting Brews

## Use it in an existing Legacy deck

Reload the updated app, open a Legacy deck and choose **Upgrades** between Cards and Settings. Existing decks need no recreation or collection re-import. Select **Check owned-card legality** if saved metadata is unverified/stale. The check uses Scryfall's **Legacy** status; a Standard ban or rotation does not determine Legacy eligibility.

Legacy defaults to **Brew Score**, prioritizing available copies. **Interesting Brews** filters for supported, locally novel mechanisms. Expand **Why this brew?** to see actual main-deck partners and evidence. Plan Fit remains a separate ranking option. Other-deck usage and unavailable copies remain visible, with an availability filter.

Choose Compare, explicitly choose a different nonland main-deck entry, and review one to four equal-count copies. The existing constructed preview shows modeled Upgrade Value, opening-seven probability, lost role coverage, exact released physical variants and availability. No cut is selected automatically. Confirm checks the incoming printing's current Legacy legality, then performs one revision-checked atomic save. It never changes quantity owned, moves copies from another deck, changes the sideboard or silently fills older missing decklist requests instead of adding the reviewed quantity.

## What makes a Legacy brew interesting

The Legacy lens uses existing canonical Oracle facts, recipient-verified capability relationships and actual condition supply. It does not call or retune the Commander recommender, import popularity, or treat generic utility/shared tags/new card names as cleverness.

- **Verified interactions:** entry reuse, independent copies, attachments, Vehicle support, spell copying, artifact sacrifice/tap costs, counter interactions and graveyard land reuse. Recipient restrictions from the existing factual helpers still apply.
- **Supported conditions:** candidate conditions need understood supply with a factor at least 0.5. When a candidate feeds another main-deck card, current supply plus one incoming copy must reach that support factor. Explanations name the actual partner and available main-deck quantities. A threshold is not a guarantee that a game event occurs.
- **Distinct mechanisms:** equivalent capability and condition descriptions are merged. Entry reuse is not counted twice; copying an entry effect does not fabricate an extra bridge; qualifiers on the same cast event share one mechanism. Counter placement types and self/recipient restrictions remain significant.
- **A bridge:** at least two distinct supported mechanisms must have distinct main-deck partners. Several descriptions of the same effect do not satisfy this rule.
- **Local novelty:** the candidate is not already in the main deck and no single existing main-deck card already supplies its supported mechanism combination. This is novelty within this deck, not global rarity, tournament originality or market popularity.
- **Additional copies:** remain valid consistency candidates up to the combined main/sideboard copy limit, but an existing main-deck card earns no novelty bonus. Four copies of one named partner do not become four different anchors.

For reproducibility, let `N` be unique supported partner names and `C` their summed main-deck quantities (capped at four per name). Evidence contributes `min(50, 12*N + min(8,C))`; a verified bridge adds 20, an explicit reuse/copy/amplification relationship adds 15, local novelty adds 10, and understood supported conditions add 5. The total is bounded at 100. With no verified partners, Brew is zero. An **Interesting Brew** requires score at least 55, local novelty, and either two distinct partners or a verified bridge. Names and scores are deterministic; there are no named-card bonuses.

Plan Fit and Upgrade Value retain the v0.6.19 constructed model. They are separate from Brew. These are experimental explanations of recognized relationships, not win-rate estimates, calibrated Legacy power ratings, or proof of an infinite combo. No automatic optimizer or matchup adviser is added.

## Architecture and safeguards

`src/legacy/brew.ts` owns the new Legacy lens. The existing constructed kernel (`src/standard/engine.ts`, retaining its Standard exports for compatibility) now also exposes format-gated Legacy functions. `ConstructedUpgrades.tsx` replaces the Standard-only component name and renders format-specific labels, checks and actions. The shared cancellable worker dispatches by deck format; cache identity includes both model versions and the deck/revision. All normal browsing/ranking/filtering remains local; artwork may require its image host.

Standard scoring/version **0.1.0** is unchanged. Commander scoring remains **0.6.16**. All 27 protected Commander source files are unchanged from the approved baseline, and the frozen twelve-deck ranking comparison remains exact. This release does not resume or complete the earlier unfinished Commander generalization research.

Legacy legality snapshots expire after seven days. Confirmation requires a fresh same-printing/name Legacy-legal result at most five minutes old and live verification through the existing paced/retried batch client. Failures save nothing. Both-board four-copy limits and supported Oracle exceptions apply across printings. Existing collection CAS checks, atomic persistence and connection recovery remain intact. No storage migration, data reset or authentication changes are needed.

## Limits

- Main-deck owned nonlands only; sideboard matchup advice and land/mana-base swaps remain deferred. Missing decklist cards contribute to intended-deck analysis but are not fabricated as owned candidates.
- Mana screening, curve/role coverage and Oracle extraction remain approximate. Source counts, sequencing, restricted mana, missing face-level costs, mulligans and opponent interaction are not simulated. Opening-seven probability is only a named-card draw calculation.
- Severe resource/loss effects remain conservatively omitted because mitigation and combo legality/timing are not proved. This can miss valid Legacy combos. Clever interactions outside the recognized factual vocabulary can also be missed.
- Candidate explanations are capped for readability. Local mechanism novelty can miss subtle functional differences. No real user Legacy deck has been competitively calibrated; synthetic ownership fixtures and frozen real Oracle examples validate behavior, not metagame quality.
- One incoming owned variant and one outgoing main-deck entry per review; mixed incoming variants require separate reviews. No public account or remote collection access is introduced.

## Validation

- `npm run test:unit`: **665/665 passed**, 44 files, in 12.46 seconds with the default command, run separately from browser emulation. Eleven new Legacy cases cover format-specific bans/staleness, copy caps across printings/boards, novel reuse vs generic utility, independent partner counts, unsupported conditions, quantity/revision guards, no stealing, atomic preservation, frozen real Oracle copy/entry examples, real vs duplicated bridges, qualifier deduplication and counter payoff/amplification scope.
- One earlier concurrent run exceeded the existing five-second 4,421-candidate microbenchmark budget while browser workers were active. The isolated default suite passed; the benchmark, threshold and protected Commander code were not changed.
- `TEST_PRODUCTION=1 npx playwright test`: **480/480 passed** in 19.1 minutes. Includes all 450 existing cases plus 30 new Legacy cases across Chromium 360×800, 390×844, 430×932, 768×1024 and 1440×1000.
- Legacy browser coverage checks tab discovery on existing decks, Brew default/filter and named evidence, owned vs allocated copies, two-copy preview/no writes/confirmation/reload, current Legacy legality and newly banned cards, availability controls, zero Axe violations, no horizontal overflow, and cancellable analysis of 3,000 synthetic owned candidates with two-second control/navigation action budgets.
- After the final Legacy reuse-evidence guard, selected-state styling and concise explanation display, `npx vitest run tests/unit/legacyUpgrades.test.ts tests/unit/commanderProtection.test.ts` passed **12/12**, final lint/build passed, and `TEST_PRODUCTION=1 npx playwright test tests/browser/legacyUpgrades.spec.ts` passed **30/30** on the final source. The selected filter and expanded Brew evidence have zero Axe violations at all five sizes; mobile screenshots were visually reviewed. These are not physical iPhone/Android or installed-PWA tests, and not competitive recommendation-quality measurements.
- `RECALL_OUT=/workspace/legacy-recall.json npx vitest run tests/audit/recall.audit.test.ts`: passed offline. All 240 top-20 positions across twelve Commander decks exactly match v0.6.16 names, order, Brew and Synergy scores. All 27 protected source hashes remain unchanged.
- `npm run lint` and `npm run build`: passed. The existing main-chunk size warning remains. App/package/version endpoint agree on 0.6.20; model versions are separate.
- `npm audit --omit=dev --json`: zero production findings. Full `npm audit --json`: thirteen inherited moderate development lint-toolchain findings, zero high/critical; no dependencies were added or upgraded.
- `git diff --check`: passed. README, CHANGELOG and ROADMAP updated; later features remain deferred.

## Publication and deployment

The user has authorized publication to main. GitHub remote SHA is verified after pushing. Cloudflare deployment remains unverified: the environment's enforced network policy excludes the Workers hostname and no Cloudflare credentials are configured. GitHub push success is not proof of deployment. The served `/version.json` should report app **0.6.20**, Commander ranking **0.6.16**, Standard ranking **0.1.0**, and Legacy ranking **0.1.0** at https://mtg-manager-app.lhauswirth15.workers.dev .
