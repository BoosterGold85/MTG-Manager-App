# v0.6.1 — Deck-aware scoring validation

Baseline: `e203054` (approved v0.6.0, including v0.5.2 audit fixes). Scope is the [scoring executable](v0.6.1-scoring-executable.md), not a new Explorer workflow or later roadmap work.

## Implementation

A cached `DeckStrategyProfile` derives Commander interactions, primary/secondary archetypes, role deficits, supported creature types, packages, curve and contextual efficiency from canonical metadata and effective tags. Existing descriptive Deck DNA theme calculations and taxonomy remain intact. Candidates use the frozen deck profile; evaluating a candidate does not insert it into the deck.

Scores use Commander / primary strategy / needed role / packages / efficiency / generic overlap / curve caps of **30 / 25 / 15 / 10 / 10 / 5 / 5**. Signed penalties address unsupported creatures, absent Commander interaction, redundancy, curve congestion, low impact and anti-synergy. The integer raw total clamps to 0–100; there is no distribution shaping or rounding to five. Prices, popularity and physical ownership quantities are excluded. Availability only breaks score ties.

Commander matching distinguishes self/other events, cast/ETB/death/combat/damage, object and creature types, keywords, nontoken/noncreature restrictions and compatible amplification. Changeling is handled in scoring without changing stored tags. This is deterministic heuristic analysis, not a complete Magic rules interpreter or universal power rating.

Role targets scale with actual main-deck size: baseline ramp 10 (12 for a high curve/expensive Commander), draw 10, removal 8, wipes 3, protection 4, recursion 3 (10 for graveyard strategy), hate/tutors 2 each, finishers 5 and lands 36 per 99 main-deck cards. Fixing targets depend on color count; relevant token/sacrifice/payoff/enabler strategies have explicit targets. The maximum unmet applicable role contributes to the 15-point role budget; generic utility cannot stack multiple deficits without bound.

Recommended (70+) and Worth Considering (50–69) remain visible. Other Legal Cards (below 50) starts collapsed. Each tier renders progressively while search covers the entire candidate set. The default-collapsed, lazily rendered breakdown includes all seven components, negative adjustments, evidence and exact raw/final totals. Existing comparison, printing selection, card detail, ownership and manual assignment behavior remains intact.

Caches are bounded (four profiles, up to 10,000 scores each), keyed by canonical scoring inputs rather than printing, quantity or price. No new network calls during scoring, dependencies, database migration, automatic swaps/moves, proposed cuts or v0.7.0 functionality.

## Regression coverage

- Eleven archetypes: Dragon typal, Spellslinger, Aristocrats, Landfall, Voltron, Artifacts, Tokens, Graveyard/Reanimator, Counters, Goodstuff and ETB/Blink.
- All seven budgets, signed arithmetic/clamping, exact bands, integer scores, Commander/object restrictions, trigger amplification, supported tribes/Changeling, off-plan creatures, own-versus-opponent anti-synergy, curve/redundancy, role utility and context-dependent scoring.
- Frozen candidate profile, bounded caches, semantic invalidation and ownership/price independence. Existing 4,421-candidate and distinct-deck performance checks remain active.
- Browser tests cover tiers, default collapsed weak candidates, exact expanded breakdowns, score-first ordering, search, availability filters, comparison/detail behavior, cache reuse, accessibility, overflow and unchanged saved state.
- All existing collection/import/recovery/management, deck import/ownership, intelligence, browsing/navigation, backup and cross-tab suites remain included. Assertions tied specifically to the superseded score formula/order were updated to the requested contract. A pre-existing immediate DOM read after asynchronous card removal now polls for the same expected theme labels; it passed 15 repeats across all five sizes before the final suite run.

Seven named canonical card snapshots are stored in `tests/data/scoring-cards.scryfall.json`; they contain public Oracle metadata, not prices or private collection data. In the curated Lathliss Dragon fixture, Alania’s Pathmaker scores **4**, Harnesser of Storms **0**, and Mongoose Lizard **0**, compared with Dragon Tempest **74**, Utvara Hellkite **75**, and Dragonlord’s Servant **66**. These are fixture-specific results. The same Alania scores **85** in the ETB/Blink fixture, demonstrating contextual treatment rather than a card blacklist.

## Validation commands and results

- `npm run lint`: passed.
- `npm run test:unit`: **329 passed** (284 preserved plus 45 added cases).
- `npm run build`: passed; production JS approximately 486.54 kB (150.91 kB gzip), CSS 63.88 kB.
- `CI=1 TEST_PRODUCTION=1 npm test`: **325 passed** across all five sizes (final clean sequential run)..
- `npm audit --audit-level=low`: **0 vulnerabilities**.
- `git diff --check`: passed.

Production browser coverage uses Chromium at 360×800, 390×844, 430×932, 768×1024 and 1440×1000. Device emulation does not establish physical iPhone/Safari behavior; the existing opt-in WebKit project and iPhone smoke checklist remain available. No physical device or WebKit run is claimed.

## Remaining acceptance gap and deployment

**The user’s actual saved “Reign of Dragons” deck could not be tested.** It is not in the repository and saved decks live in device storage. Its exported decklist was requested, but was not supplied during implementation. The curated Dragon fixture and real named-card snapshots above do not substitute for this exact-deck acceptance check. This is the outstanding deviation from full executable validation.

The static Cloudflare build configuration is unchanged. A successful local production build or GitHub push does not establish a successful Cloudflare deployment. No Cloudflare deployment credentials/status capability was available, so live deployment remains unverified. No later-roadmap work was begun.
