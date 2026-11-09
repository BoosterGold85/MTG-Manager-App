# MTG Manager roadmap

Summarized from the supplied master whitepaper. Future entries are planning only; they are not implemented in v0.1.0.

| Release             | Focus                                                                                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1.0               | Digital Binder Foundation: sample collection, premium mobile UI, artwork, search, filters, sorting and card details.                                                          |
| 0.1.1 — Frozen      | Binder polish: Commander Colors subset filtering; continued ergonomics, accessibility and visual review.                                                                      |
| 0.2.0 — Approved | Real Collection Foundation: ManaBox CSV preview/import, deterministic matching, safe re-import upserts, local persistence and physical ownership.                             |
| 0.2.1 — Approved | Collection Management & Multi-Select: safe local removal/clear, statistics, import history and JSON backup. |
| 0.3.0 — Approved | Card Intelligence & Taxonomy: inspectable semantic tags, evidence, confidence and correction.                                                                                 |
| 0.3.1 — Approved | Importer reliability: recoverable lookup interruptions, retries, safe pacing and durable metadata checkpoints; no new intelligence scope. |
| 0.3.2 — Approved | Intelligence Polish & Tagging Accuracy: semantic corrections, validated typal signals, canonical Keywords and optional Oracle text search. |
| 0.4.0 — Approved | Commander Library: local decklists, owned-printing assignments, copy availability, re-import conflicts and backup. History remains future scope. |
| 0.4.1 — Approved | ManaBox Deck Import: preview-first text/paste import, explicit commander confirmation, ownership reconciliation, missing-card decklist entries separate from physical-copy assignments. No sync engine. |
| 0.4.2 — Approved | Deck Browsing & Card Navigation: shared Card Detail from decks, Previous/Next following the visible sort/filter order, deck sorting and lightweight filters. No Deck DNA. |
| 0.5.0 — Approved | Deck DNA Core: local deterministic theme families, Commander influence, evidence-led summaries/Core Plan, per-card Synergy and contextual browsing.                                                                                                   |
| 0.5.1 — Approved | Storage / Deck Import Reliability: bounded connection recovery and fail-closed ownership preview; no new DNA features. |
| 0.5.2 — Approved | Audit fixes: cross-tab change notice, URL/history screen and deck routes, consistent records/copies wording, readable mobile labels, opt-in WebKit + iPhone smoke checklist. No new DNA features. |
| 0.6.0 — Approved | Synergy Explorer / Upgrades I Own: owned canonical candidates, availability-first ranking, explicit other-deck usage, evidence and read-only comparison; no automatic changes.                                                                      |
| 0.6.1 — Approved | Deck-aware Synergy scoring: strategy profiles, Commander interactions, role deficits, packages, efficiency, negative modifiers, exact breakdowns and recommendation tiers. |
| 0.6.2 — Approved | Synergy Explorer UX Polish: compact evidence-based summaries, concise ownership, lazy Why this score? diagnostics; approved v0.6.1 scoring unchanged. |
| 0.6.3 — Approved | Recommendation Engine vNext: typed canonical facts, verified interactions, role gaps, calibrated scoring/confidence and conservative read-only replacement comparisons. |
| 0.6.4 — Approved | Basic Land Import Exception: Basic-supertype lands are tracked in decks with their printing but never exclusively allocated or blocking. |
| 0.6.5 — Approved | Clones & Copies: clone/copy-permanent and copy-creature-spell detection, Deck DNA family and Synergy archetype. |
| 0.6.6 — Approved | Upgrades I Own rebuilt around two goals: Build Around My Commander (Commander Fit + Build Priority from a Commander Blueprint) and Improve My Current Deck (best one-for-one swap Upgrade Value). Typed Mayhem / discard support. |
| 0.6.7 — Approved | Deck Workspace UX & Actionability: Overview / Cards / Upgrades / Settings sections in the URL, Deck Health from the upgrade engine, in-page Upgrades with Saved candidates, Build-mode Add to Deck and atomic Review/Confirm Swap. Scores unchanged. |
| 0.6.8 — Approved | Evaluator fixes from the Miles Vehicles deck: modal/multi-clause mass removal, strategic Key Cards, typed Core Plan payoffs, Vehicle trigger objects and threat/finisher credit. Scoring architecture unchanged. |
| 0.6.9 — Approved | Pings / Punisher decks: opponent life loss as a typed Commander trigger and DNA theme, punisher and symmetric-draw tags, shroud protection and "put onto the battlefield" recursion. |
| 0.6.10 — Approved | Full card-pool audit against Scryfall bulk data: clause-level effect scope, mass removal, protection, ramp and tutor wording, comma-safe Commander triggers and five new trigger events; fixtures moved to real Oracle text. |
| 0.6.11 — Approved | "The app isn't sure" warnings on the Overview: unclassified Commander abilities, few Commander-linked cards, a weak plan, untracked cards and missing rules text. Library tucks count as removal; qualified anthems count as team pumps. |
| 0.6.12 — Approved | Deck-relative conditions: an effect earns credit only when cards in this deck feed it, named in every explanation. Engine-agnosticism audit fixes and 11 holdout/adversarial decks. |
| 0.6.13 — Approved | Brew Score v1: a deck-relative "interesting and unusually useful here" lens in Upgrades, built only on data-derived signals. |
| **0.6.14 — Approved** | Group Draw theme, alternate wins and mill as finishers, a Defense role for pillowfort and restriction cards, neutralized creatures as removal, and card velocity in the land target (from the Kwain deck). |
| 0.7.0               | New Set Watcher: evaluate new releases against existing deck identity.                                                                                                        |
| 0.8.0               | Uniqueness: separate originality, cohesion and power; lawful comparison-provider abstraction. EDHREC only through a permitted data relationship, never unauthorized scraping. |
| 0.9.0               | Invite-only Playgroup: authentication, private collections and selective sharing.                                                                                             |
| 1.0.0               | Personal Commander OS: reliable imports, explainable intelligence, privacy, export and polished onboarding.                                                                   |

## Release discipline

Build the manager first; add intelligence in layers. Artwork and one-handed browsing come first. Physical copies must never silently move between decks. Preserve a deck's identity before considering raw power. Future intelligence should combine deterministic card data, inspectable tags, relationships, scoring and evidence-backed explanations.

The v0.1.x exit condition is a coherent collection → detail → back experience that people want to browse on a phone. Collect visual/touch feedback and freeze the binder before beginning import work. Minor releases add a capability layer; patches polish the existing layer. No future-roadmap feature may be slipped into a patch.

### 0.6.15 — Completed: Recommendation Recall & Interaction Coverage

The frozen pass is complete with targeted semantic, interaction and condition/profile fixes. Score weights and thresholds are preserved. Final evidence recommends B: accuracy/ordering and cold analysis still need work before new Brew Score implementation. Existing v0.6.13 lens is preserved; this pass adds no Brew functionality. See [the completed pass](docs/RECOMMENDATION-RECALL-COMPLETE.md). No later phase has begun.


### 0.6.16 — Completed: Recommendation Ranking & Performance

Bounded causal value, strategic redundancy protection and cold-analysis reuse meet the constructed ranking targets. Preserve the frozen corpus and inspect the full [report](docs/RECOMMENDATION-RANKING-v0.6.16.md). Broader holdout false positives and synchronous mobile work remain. Final recommendation B: validate this release manually before a separately authorized accuracy/responsiveness pass. No Brew Score implementation has begun.


### 0.6.17 — In progress; worker testing preview available

`0.6.17-preview.1` exposes read-only background recommendation analysis for manual testing. Ten blind decks are frozen, including the Zada replacement. Real-deck evaluation, downside/package-priority fixes and the final readiness decision remain pending. Scoring remains v0.6.16; do not begin Brew Score. See [preview validation](docs/VALIDATION-v0.6.17-preview.1.md).


### 0.6.18 — Multi-Format Deck Support

Separately authorized by the user: Commander, Standard and Legacy creation/import; constructed main/sideboards; copy/size and fresh Scryfall legality warnings. Preserve ownership and old Commander decks. No new recommendation model: v0.6.17 real-deck generalization remains in progress. See [validation and limitations](docs/MULTI-FORMAT-DECKS-v0.6.18.md).


### 0.6.19 — Released: Experimental Standard Upgrades

Separately authorized Standard-first phase: owned nonland candidates, additional copies, main-deck quantity comparisons and explicit atomic swaps using a separate Standard model. Commander source and ranking remain unchanged. Real Standard-list recommendation quality is not yet calibrated. Legacy, sideboard recommendations and mana-base changes remain future work. The unfinished Commander generalization pass is not resumed or represented as complete. See [model and validation](docs/STANDARD-UPGRADES-v0.6.19.md).


### 0.6.20 — Released: Legacy Upgrades & Interesting Brews

User-authorized Legacy owned-card exploration, with recipient-verified Brew evidence, local mechanism novelty, quantity-aware explicit comparisons and atomic confirmations. Preserve Commander source/ranking and existing Standard scores. Sideboard matchup recommendations, mana-base swaps and competitive/combo guarantees remain deferred. The earlier Commander generalization pass remains unfinished. See [model and validation](docs/LEGACY-UPGRADES-v0.6.20.md).


### 0.6.21 — Released: Legality Recovery & Upgrade Quick Reading

Focused reliability/usability fix: keep and resume successful legality lookups, isolate unresolved printings, browse beyond comparison gates, and open shared Card Detail from Standard/Legacy artwork with filtered navigation. No scoring changes, frozen expectation edits or new intelligence pass. Real blind quality evaluation and physical-device/deployment verification remain separate outstanding work. See [validation](docs/LEGALITY-RECOVERY-v0.6.21.md).


### 0.6.22 — Released: Same-Origin Lookup Reliability

Focused transport fix for repeated Safari lookup interruptions: a bounded same-site canonical metadata relay, Worker/assets deployment configuration, readable upstream failures and unchanged cache/retry/resume and ownership protections. No scoring or recommendation changes. Physical-device and deployed-edge verification remain separate from deterministic regression tests. See [validation and deployment](docs/SAME-ORIGIN-LOOKUPS-v0.6.22.md).

### 0.6.23 — Ability-Level Semantic Coverage

Targeted semantic release from real production decks, done after v0.6.22 instead of reopening the unfinished v0.6.17 pass. Cards are read ability by ability: understood parts count, unsupported clauses lower confidence, and vanilla cards are valid. Adds generalized dice, P/T-transformation, copy, counter-storage, blink, Saga/Class and cheat semantics, all supply-gated. Score weights, global thresholds and frozen expectations are unchanged. Blind holdout evaluation remains a separately authorized step. See [validation](docs/VALIDATION-v0.6.23.md).

### 0.6.24 — Released: Resource and Deck Semantic Coverage

General Food/life-gain event semantics, resource replacement and sacrifice scope, conditional combat links and land-subtype ramp. Includes the land and Uugguu coverage follow-ups. No score-weight tuning or automatic deck changes. See [validation](docs/VALIDATION-v0.6.24.md).

### 0.6.25 — Released: Deck Intelligence

Independent entry coverage, saved intent, conservative strategy and synergy evidence, composition gaps and owned-upgrade tradeoffs. Includes Cloudflare Preview support. Scores and assignments are unchanged. Exact Carnage deck fixture and the existing timing gate remain open; see [implementation and validation](docs/DECK-INTELLIGENCE.md).


### 0.6.26 — Current: Opt-in Experimental Synergy Analyzer

Read-only coverage scans and explicit targeted hypothetical mechanical analyses on saved Commander/Legacy decks. A separate bounded browser worker; no storage/schema changes and no production recommendation or numerical synergy integration. Coverage and independent correctness remain limited and clearly disclosed. See [release and safety report](docs/EXPERIMENTAL-ANALYZER-v0.6.26.md).
