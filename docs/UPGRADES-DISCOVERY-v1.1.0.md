# Upgrades: Recommended from your collection (DISCOVERY_VERSION 1.1.0)

> **Superseded in part.** The Vehicle/flying claims below were wrong: Subterranean Schooner and Tangle Tumbler do interact with
> Miles (the card's own rule gives a flying counter when a Vehicle lacks flying). The corrected evidence and the revised labels are in
> `docs/UPGRADES-DISCOVERY-AUDIT.md`. Read that document first.

Status: implemented on `claude/sweet-tesla-vvlj2b`, not merged, not deployed. Requires owner review of the blockers in
section 6 before any merge.

## 1. Audit: what the existing engine already does

| Existing piece | Decision | Notes |
| --- | --- | --- |
| `brewCandidates` / Brew Score (`src/upgrades/brew.ts`) | Reused, unchanged score | Already yields verified links (`links`), fed conditions and package bridges per owned candidate. |
| Commander/deck relationships (`src/synergy/recommendation.ts`, `src/dna/strategy.ts`) | Reused; evidence now exposed | Each link already carried the rule text that proves it; it was dropped at output. |
| `upgradeFor` / `evaluateUpgrade` (`src/upgrades/upgrade.ts`) | Reused | Best one-for-one cut for complete decks, evaluated only for the shortlist. |
| `candidateGroups` (owned, legal, not in deck) | Reused | Enforces Commander color identity, singleton rules and assignment via the existing explorer. |
| Worker, client, cancellation, revision checks | Reused | New `discover` mode only. |
| Save / Add / Review Swap / SwapReview / saved list | Reused | Same confirmation workflows; nothing is written automatically. |
| Build Around My Commander, Improve My Current Deck, Brew filters, Printings | Kept | Reached from "Explore by goal" below the recommendations. |
| Brew Lab, Universal Synergy Engine, Analyzer | Untouched | Not part of this change. |

What needed changing:

- **Selection (new):** `src/upgrades/discovery.ts`. Decides which owned cards are presented and how.
- **Evidence exposure (additive):** `recommendation.ts` link records carry `evidence`; Brew results carry `verified` and `needs`. No score input changed.
- **Landing (UI):** `src/components/Discoveries.tsx` and `DeckUpgrades.tsx`. The Upgrades tab opens to recommendations; the goal chooser moves below them.

## 2. What a recommendation requires

A card is shown only if at least one of these holds:

1. A rule-backed link to the Commander or a deck card (the engine's `Source → Receiver: rule text` evidence).
2. A condition this deck really supplies, other than crew (crew is a prerequisite for every creature deck, not an interaction).
3. A package bridge (labelled Speculative, since it is an inference).

Hard exclusions: a card the engine flags as conflicting (Anti-synergy) is never shown.

Three generic rules, derived from observed output rather than card names:

- **Category effects are not discoveries.** If the same deck-card rule text is the reason for three or more candidates, every card of that kind does it. Commander relationships are exempt.
- **Stated conditions must hold for the card.** "A Vehicle you control enters, draw a card if it has flying" fires only for a Vehicle with flying. Checked for keyword and type conditions named in the rule text.
- **No repeated rule.** At most two recommendations share one rule (`MAX_PER_RULE = 2`).

Strength (category, not a number):

- **Strongly supported:** High-confidence analysis, a printed rule link at strength 0.8+, and not a symmetric or cost-based relation.
- **Plausible:** a real link or a supplied condition that depends on how the deck plays.
- **Speculative:** Low-confidence analysis, or a package bridge alone.

Ordering: available unassigned copies first, then strength, then the existing Brew order. No new score is introduced.

Potential change: an incomplete deck gets **Add to Deck** (existing add path). A complete deck gets the best one-for-one swap and **Review Swap** (existing confirmation). Nothing changes until confirmed.

## 3. Evidence on the regression decks

These are the existing public/synthetic fixtures, with owned copies of the last 25 non-basic cards moved out of the deck
(an incomplete deck with owned additions). They are not the owner's private decks.

**Miles "Tails" Prower (8 recommendations):**

- Skysovereign, Consul Flagship; Smuggler's Copter; The Lunar Whale; Skybox Ferry: flying Vehicles on the Commander's
  "Vehicle enters, draw if it has flying" payoff. Subterranean Schooner and Tangle Tumbler (no flying) are not shown here; this list is capped (see the audit), and both have a real interaction through the Otherwise branch.
- Time Wipe and Turn to Mist: reuse Mu Yanling, Wind Rider's entry effect.
- Prydwen, Steel Flagship: artifact-entry trigger from Signets.
- Ugin, Eye of the Storms; Serra Disciple: Plausible, supplied colorless or historic spells.

**Lathliss, Dragon Queen (10 recommendations):**

- Utvara Hellkite, Scourge of Valkas, Spit Flame, Sarkhan, Dragon Ascendant: Dragon attack/enter engines from deck Dragons.
- Skyline Despot, Tyrant's Familiar: Dragons that trigger Lathliss's own token creation (two only, by the rule cap).
- Warstorm Surge: creature-enters damage from Anger.
- Orb of Dragonkind, Thrill of Possibility, Unexpected Windfall: Plausible, shown after the strong results.

**Reading the lists.** The usefulness target (7 of the top 10 worth seriously considering) requires human judgment. I have not
graded it. My own reading: the Vehicle and Dragon-engine results look like real, specific interactions. Weaker entries are
Serra Disciple (a pump on historic spells), Orb of Dragonkind, and the Haven-linked graveyard cards. Staggering Insight is linked
to Aeronaut Admiral through an Aura-text relation I could not verify and needs review. Carnage/Mayhem has no fixture in the repository, and Jackal exists only as a trimmed
fixture in `tests/dnaFixtures.ts`. Neither was run through this discovery change, so this report does not cover them.

## 4. Vehicle / flying (corrected)

The earlier "known scoring issue" was a misdiagnosis. The validator accepted Miles's Vehicle trigger for non-flying Vehicles correctly,
because the rule has an Otherwise branch (a flying counter). The real defects were: branch text that always described the draw, granted
flying ignored, trigger object types unchecked, and a snippet cut before the Otherwise clause. These are fixed in the shared logic. See
`docs/UPGRADES-DISCOVERY-AUDIT.md`, section 2.

## 5. Validation (exact commands and results)

Commands run from the repository root. Results are in section 6 where they fail.

- `npx eslint .`: exit 0 (after moving the availability helper out of the component file).
- `npx tsc -b`: exit 0.
- `npm run build`: exit 0 (also run with changes stashed to capture the baseline browser comparison).
- `npx vitest run tests/unit`: **1011 passed / 2 failed of 1013** (57 files). Baseline before the change: 1001/1001. The 2 failures are the byte-identical guards in section 6; all 999 pre-existing tests, including the Brew and Upgrade golden tests, still pass.
- `npx vitest run tests/prototype`: **186 passed / 2 failed of 188**. Both failures are the same byte-identical guard, in the two universal prototype files.
- New tests: `tests/unit/discovery.test.ts` (12 tests: 6 synthetic selection rules, Miles and Lathliss fixtures, read-only
  check, incomplete/complete behavior) and `tests/browser/discoveryLanding.spec.ts` (phone, tablet and desktop projects).
- Updated tests: `tests/browser/synergy.spec.ts` (new landing heading, "Explore by goal" region);
  `tests/browser/recommendation.spec.ts` cold-worker test (landing worker is expected; assertion now reads `<= 2` and excludes
  discovery cards from the goal-candidate check).
- `TEST_PRODUCTION=1 npx playwright test --trace off` (full production build, all five projects, 2 workers):
  **572 passed / 23 failed / 15 skipped of 610** (15.8 min). Failures are classified in section 6.

Same-origin storage preservation: this change adds no IndexedDB schema, key or migration, and no write path. The discovery
unit test asserts that the collection state and deck are byte-identical after evaluation. The landing browser test asserts
the IndexedDB snapshot is unchanged after viewing and makes zero Scryfall calls. A cross-version old-build to new-build
storage test was not added in this change; it is not required because storage is untouched.

## 6. Blockers and failures (honest)

**A. Byte-identical boundary guards (4 tests). Needs your decision before merge.** These assert that scoring,
recommendation and Commander-protected files match the release baseline. This change edits them on purpose and additively:

- `src/synergy/recommendation.ts` (link evidence in output; no scoring input changed)
- `src/upgrades/brew.ts` (verified and needs fields; score unchanged)
- `src/components/DeckUpgrades.tsx`, `src/hooks/useRecommendationAnalysis.ts`, `src/workers/recommendationProtocol.ts`,
  `src/upgrades/index.ts`, `src/styles/app.css`

Failing: `tests/unit/commanderProtection.test.ts`, `tests/unit/experimentalAnalyzer.test.ts`,
`tests/prototype/universalRemediated.test.ts`, `tests/prototype/browserUniversalRemediated.test.ts`. I did not refresh any
hash or baseline. Evidence that no score moved: the Brew and Upgrade golden tests pass. The evidence is removing the
protected-file edits, which would also remove the rule text behind "What happens".

**B. Browser failures reproduced on untouched `main` (same environment, same build method).**

- `brewLab.spec.ts` (3 tests × 5 projects = 15): needs `PRE_ANALYZER_DIST` (an old-build artifact not present here), and the
  analyzer cancel/timeout case waits on a control that never appears. Reproduced on baseline for mobile-390.
- `decks.spec.ts:94` (4 projects): axe color-contrast on the Add Card dialog (`.tile-subtitle`, `.rarity`, `.allocation-copy`).
  Reproduced on baseline for mobile-390, tablet and desktop; mobile-360 was not run on baseline separately (same test, same dialog). I did not change those classes.

**C. Timing failures under full-suite load that pass in isolation with this build.**

- `upgradeRecovery.spec.ts:61` (Legacy detail dialog axe contrast; 3 projects failed in the full run).
- `recommendation.spec.ts:266` (cold worker responsiveness; 1 project failed in the full run).

Both pass 10 of 10 when run alone on all five projects with this build. Both pass on baseline. I am classifying them as
load-sensitive flakes, not as proven fixed.

**Result after classification:** 572 passed, 23 failed, of which 19 are pre-existing (B) and 4 are load-sensitive (C).
No failure is in a test of the new landing behavior: `discoveryLanding.spec.ts` passes on every project.

Not verified: a physical device (only Chromium emulation was used), a live deployment, the owner's private decks, and the
human usefulness target (7 of the top 10 worth considering).
