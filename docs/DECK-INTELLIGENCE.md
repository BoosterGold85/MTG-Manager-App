# Deck Intelligence — review branch

Implemented on `feature/deck-intelligence`, initially based on `26751d0` (v0.6.24), then rebased
on `d619135` to preserve the new collection-filter changes. This is a review change, not a
main-branch release or production deployment.

## Baseline and fixture status

Before implementation, the complete existing unit suite passed **931/931**. Constructed Overview
provided legality and deck-count warnings, without the Commander analysis/strategy presentation.
The baseline and source commit are recorded in `tests/audit/deck-intelligence/baseline.json`.

**The exact Carnage Mayhem 60-card deck is still unavailable.** The repository and attached page
snapshot do not contain its saved entries, quantities or printing variants. The user has been asked
for its location/export. No invented 60-card list is labeled as their deck. The existing synthetic
Legacy fixture remains a separate compatibility fixture.

The new mechanism fixture freezes actual Scryfall records for Vision of Love, Diresight and Carnage,
Crimson Chaos, obtained on 2026-11-05. It establishes the requested rules examples, not full-deck
coverage. Freeze the exact exported deck as a separate fixture when supplied; preserve entry quantities,
boards, set/collector identifiers and finishes, then capture its coverage/strategy results before approval.

## Coverage first

`src/deckIntelligence/coverage.ts` reads intended decklist entries rather than allocated inventory.
Main deck and sideboard are audited independently; older assignment-only Commander decks are also readable.
Each entry retains printing resolution, requested finish availability, Oracle completeness, per-ability
interpreter coverage, saved format legality/freshness, owned canonical copies and allocated copies.
An empty Oracle string is valid; absent text or an incomplete card face is not fabricated as a vanilla card.

The four summary counts are **mechanical-analysis** categories, in entries and quantities. An entry can
have fully interpreted canonical rules while its desired printing or finish remains unresolved; these
are deliberately separate states in the expanded row. Entirely unsupported abilities count as partial
analysis, with the underlying `unsupported` state and exact clauses exposed. Unresolved means no
unambiguous canonical match; unverified means required Oracle/type data is unavailable. Legality never
changes these counts.

Canonical grouping uses Oracle IDs, with unambiguous normalized-name fallback. Printing entries and
inventory references remain distinct. Basic lands are explicitly described as nonexclusive decklist
resources; zero allocation is not missing Oracle data. Rejected source rows remain visible as excluded
import issues rather than being counted as successfully imported cards.
Rules-reference dialogs do not invent an owned/binder quantity for a canonical metadata record.
Finish-only name imports retain explicit foil/nonfoil/etched requests even without set/collector details.

Explicit per-entry and attention-only refreshes bypass old negative lookup results, use the existing
paced/retried Scryfall client, and retain independent successes on partial responses. Refresh issues
remain visible during the current view. A failure does not erase good saved metadata or declare legality.
Canonical fallback data never substitutes another desired printing or physical assignment. Successful
metadata writes use the existing revision-checked collection transaction. Ordinary browsing makes no
metadata requests.

## Goals and relationship evidence

The additional analysis is explanatory. It reads the approved typed Oracle facts, capability relationships,
resource semantics, condition predicates and deck-relative functional roles. Existing Plan Fit, Brew Score,
ranking weights, frozen holdout labels and protected Commander scorer files are unchanged.

Main-deck canonical identities supply inference; the sideboard does not establish the main plan. Plans
require actual directed relationships, not shared words or creature types. Oracle coverage below 80% or
interpreted abilities below 60% of intended nonland copies withholds inferred goals. These are explanation
confidence guards, not ranking thresholds or recommended composition ratios. Plans have Low or Moderate
confidence, bounded by distinct partners. This pass recognizes Discard/Mayhem, creature recursion, resource
engines, and existing supported triggered/reuse relationships; it is not a complete archetype classifier.

Manual plan and casual/competitive preference persist on the deck across refresh/reload and backups.
The manual plan takes precedence in the summary but does not manufacture mechanical evidence or change
the existing scoring model. Selecting competitive does not certify competitive readiness.

The interaction schema separates confirmed, conditional, thematic, unresolved and rule-conflict states.
This implementation conservatively labels potential plays **conditional**; it does not promote shared
themes/unsupported guesses into verified chains or claim completed combos. Restricted discard selection
that cannot be validated is unresolved. Rule-conflict entries distinguish an invalid proposed rules link
from an active casting prohibition; neither claims the cards are illegal to include together.

Verified examples:

- **Vision of Love → Carnage:** Vision's Oracle text offers sacrificing an artifact **or discarding a card**.
  Choosing discard can put Carnage from hand into the graveyard. Carnage's Mayhem cost is `{B}{R}`;
  the card itself must have been discarded that turn and remain available in the graveyard. Vision's
  normal cost is `{1}{R}`. Normal creature casting timing, priority and any applicable restrictions remain.
  Choosing the artifact sacrifice option does not satisfy discard.
- **Diresight ≠ Mayhem enabler:** surveil moves cards from library to graveyard. It does not discard Carnage
  from hand, so that action cannot satisfy Mayhem. The two cards can still coexist in a deck.
- **Carnage recursion:** its entry trigger targets a creature card of mana value three or less in your graveyard.
  Explicit target checks exclude larger creatures. Attacking and subsequent combat-damage sacrifice
  restrictions stay in the quoted Oracle evidence; no permanent, repeatable recursion loop is inferred.
- **Casting prohibition:** an active “Players can't cast spells from graveyards…” effect prevents Mayhem
  casting. Permission does not override prohibition.

Chains provide participating-card detail buttons, original Oracle evidence, costs, target scope and timing
qualifications. Generic old capability links are only exposed when both cards have fully interpreted
abilities. When the existing interpreter supplies a partner relationship without an unambiguous
producer/consumer direction, the UI uses a nondirectional link; those links do not establish
enabler/payoff roles for strategy inference. Unsupported/missing cards remain visible in coverage
rather than becoming invented partners.
Weakly keyed metadata indexes, per-card condition/fact caches and per-pair proofs reuse unchanged results;
refreshing one metadata object invalidates its own relationships. Cache data is derived and rebuilds on reload.

## Diagnostics, upgrades and mobile

Four Overview sections provide concise summaries with expandable evidence: Card Analysis Coverage,
Deck Strategy, Synergy Chains and Weaknesses. Composition includes quantities, mana curve, actual saved
mana production, role units and enabler/payoff quantities. Mana color identity is never asserted as proof
of production. Gaps describe actual missing roles, dependency supply, unsupported data and observed
expensive-spell demand; fixed Commander role targets are not imposed on Legacy.

Owned constructed candidates keep their current Plan Fit/Brew Score. Expanded explanations name actual
partners and conditions. Comparison previews show deterministic before/after role units, gained/lost
canonical relationship types and losses from the selected exact entry. Relationship-type counts do not
pretend that removing one of four copies removes the whole mechanism. Physical swaps still require the
existing explicit confirmation and fresh legality gate. Explanations are deferred until expanded.

Legacy Overview and stale-legality warnings now refer to bans/eligibility, with no Standard rotation claim.
Legality, analysis confidence and competitive readiness remain independent.

## Validation and remaining limits

Existing frozen blind/golden files and the protected-source hash manifest are not refreshed or relaxed.

- Baseline full suite: 931/931 passed before implementation.
- Full implementation suite before the collection-filter update: 957/957 passed.
- Rebased full suite, including the final finish-only regression and two new upstream filter tests:
  **959/960 passed**. The only failure was the existing 4,421-candidate elapsed-time assertion;
  its protected scoring source and five-second budget are unchanged. The two original timing tests
  passed together on an isolated run (38/38 tests); timings remain intermittent on this executor.
  The final 12-test ranking recheck passed 11 functional checks but again failed that elapsed-time
  assertion (13.36 seconds against five seconds). The performance gate remains unresolved; no green
  full-suite result is claimed for the rebased branch.
- Final focused coverage/import/format/Legacy/source-protection checks: 64/64 passed, including all
  27 new Deck Intelligence unit regressions.
- `npm run lint`: passed.
- `npm run build` (TypeScript project checks plus production Vite build): passed.
- Production browser validation: **24/24 passed** on the final build. The 15 new checks span
  360px, 390px, 430px, tablet and desktop, including accessibility, rules-reference ownership,
  targeted metadata retry, intent persistence and confirmation-free comparison previews.
  Nine existing desktop checks preserve Commander confidence, Uugguu/Hurska coverage, Legacy
  swaps, unavailable copies, fresh-legality confirmation, banned-card rejection and responsiveness.
- `git diff --check`: passed.

Full-suite command: `npm run test:unit -- --maxWorkers=1 --testTimeout=30000`. The explicit
performance assertions were not changed. The test timeout is not a replacement for those assertions.

Remaining limits: the exact user 60-card fixture is pending; unknown mechanics/target predicates are not
guessed; strategy inference is deliberately limited; no sequencing simulator, guaranteed combo search,
matchup/sideboard plan, competitive win-rate estimate or manual-intent ranking retune is added. Printing
finish availability describes supported finishes, not verification that a particular physical copy exists.
New refresh-error details are view-local, while saved metadata and user intent persist.
