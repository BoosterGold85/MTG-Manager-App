# v0.6.0 — Synergy Explorer / Upgrades I Own

Baseline: approved v0.5.1 (`85e1480`). Scope is the user's owned-card discovery and manual-comparison request. Suggested cuts, automatic swaps/moves, new-set recommendations and later roadmap functionality are not implemented.

## Shipped workflow

Decks → open a saved deck → **Explore Synergy** → search owned candidates / select copy availability → **Compare [card]** → explicitly choose an existing deck card. Both sides provide mana value, card type, available Oracle text, existing shared Card Detail and deck-relative evidence. Missing deck entries can be chosen for comparison. The explorer has no write/assignment actions or repository mutation dependency.

- Only positive-owned collection records contribute candidates. Alternate printings, finishes and other physical variants are grouped by canonical Oracle identity, with normalized-name fallback for older metadata. Printing details retain individual physical counts.
- The complete conceptual decklist and Commanders are excluded, including missing/unassigned entries. Legacy assignment-only decks are supported. Canonical/name fallback prevents another owned printing of a deck card from being recommended.
- Commander color identity uses the existing subset predicate over canonical `colorIdentity`, never visual colors. Colorless candidates remain compatible.
- Default order is: any unassigned copy first, then descending Synergy within each availability group, then deterministic name/identity ties. Availability does not change scores. The Copy availability selector can isolate available or fully assigned copies so assigned candidates remain easy to find in a large collection.
- Assigned copies show deck names and quantities from the same snapshot. No copy is stolen or moved. Collection quantities, source metadata, deck entries and assignments remain untouched.
- Candidate search covers the complete collection-derived result. Initially 40 candidates render, with Show more candidates adding 40. Search/availability changes reset that rendering bound.

## Scoring contract

`src/dna/engine.ts` extracts the existing per-card scoring and deck signal-context preparation into shared private functions. The v0.5.0 DNA families, weights, percentages, Commander caps, summaries and score components remain unchanged. `candidateScorer` prepares the existing saved deck's context once and evaluates external card signals against its **unchanged** primary themes. Candidates are never inserted into the deck or permitted to create their own theme weighting.

Scores retain the existing 0–100 scale rounded to five-point steps. They describe evidenced theme fit, not power, card quality, guaranteed upgrades or a suggested cut. Candidate explanations reuse In This Deck, including original tag evidence, explicit Commander connections, roles and component breakdown. Manual corrections apply through the existing effective-assignment path. Stable canonical metadata selection is independent of which physical printing currently has an available copy.

Analysis is local and synchronous over cached normalized metadata; browsing does not call Scryfall. React memoization reuses the candidate result while searching/filtering/comparing. Existing canonical-analysis and Deck DNA caches remain in use. There is no new persistence schema, stored recommendation cache, dependency or remote analysis provider. Application/backup version becomes 0.6.0; backup fields are unchanged.

## Tests added

**12 unit tests** cover grouped printings/finishes and physical counts, named deck usage, availability-first ordering with score invariance, zero-owned/off-identity/deck/Commander exclusion, mono/two/five/colorless identities, parity with existing deck-card scores, unchanged deck DNA, deterministic immutable snapshots, missing Oracle-ID fallback, manual suppression, legacy decks, empty inventory, 4,421 distinct owned candidates and availability-neutral canonical evidence selection. Existing 270 unit tests remain intact; only current backup-version expectations change.

**Three browser workflows × five sizes = 15 new cases** cover:

1. Candidate ranking/counts/explanations/usage, explicit comparison, both evidence sections, shared candidate details and return, keyboard dismissal, automated axe checks, no horizontal overflow, zero Scryfall lookups and deep snapshot equality through close/reload.
2. Fully assigned candidates remain visible below available ones; available and fully assigned views, full search and empty state; deep snapshot equality after cancellation.
3. A 72-candidate collection initially renders 40, Show more renders all 72, and search finds the last candidate across the complete result without changing saved data.

Synthetic curated fixtures isolate semantic behavior; they are not claims of live Scryfall, the owner's private decks/CSV, or physical iPhone testing. Some fixture artwork deliberately reuses a bundled card image while semantic metadata varies.

## Validation

Focused browser run: **15 passed** at 360×800, 390×844, 430×932, 768×1024 and 1440×1000. A contrast failure found during development was fixed using the existing secondary-text token within the selected comparison surface; accessibility assertions were retained.

**Passed:** lint, all **282 unit tests** (270 preserved + 12 new), production build, all **300 production browser tests** (285 preserved + 15 new) across five sizes with no skips in **11.6 minutes**, dependency audit (**0 known vulnerabilities**) and `git diff --check`. After final scoped dialog-padding and introductory-copy polish, lint, all 282 unit tests, the production build and all 15 explorer browser cases were rerun. No dependency versions changed; the lockfile changes only the root application version.

Manual local-production visual review also used real bundled artwork in isolated owned-card fixtures at 390px and 1440px. It did not touch the owner's saved collection. Commands:

```sh
npm run lint
npm run test:unit
npm run build
TEST_PRODUCTION=1 npm test
npm audit --cache /workspace/.npm-cache
git diff --check
```

The complete suite preserves collection import/re-import, v0.3.1 interrupted lookup recovery and the 4,421-row CSV test, physical assignments/conflicts, fail-closed v0.5.1 ownership preview, storage reconnection, deck navigation, intelligence/manual corrections, PWA assets and existing accessibility checks.

## Limitations and release boundary

- The explorer is intentionally read-only. Add/remove/copy assignment still belongs to the existing deck editor; no suggested cuts are generated.
- Commander color compatibility is enforced; existing singleton, banned-list and Partner/Background legality limitations remain.
- Sparse deck evidence yields limited fit explanations rather than invented themes. Scores rely on saved metadata and the existing deterministic ruleset; they do not evaluate every rules interaction, mana-base need or card-quality tradeoff.
- Data remains local to this browser/origin. Existing backup-restore/cloud-sync limitations are unchanged. No unrelated audit fixes or redesign are bundled into this release.
- Five viewport projects run Chromium. Actual Safari/iPhone lifecycle behavior is not independently verified.

## Deployment

Cloudflare deployment cannot be verified with the available tooling: no Cloudflare connector or credentials are configured. A production build or GitHub push is not evidence of a completed deployment. Git commit/push status is reported at release completion. Work stops before v0.7.0 and the future low-synergy-cut workflow.
