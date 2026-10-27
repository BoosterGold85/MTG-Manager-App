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
| **0.6.8 — Current** | Evaluator fixes from the Miles Vehicles deck: modal/multi-clause mass removal, strategic Key Cards, typed Core Plan payoffs, Vehicle trigger objects and threat/finisher credit. Scoring architecture unchanged. |
| 0.7.0               | New Set Watcher: evaluate new releases against existing deck identity.                                                                                                        |
| 0.8.0               | Uniqueness: separate originality, cohesion and power; lawful comparison-provider abstraction. EDHREC only through a permitted data relationship, never unauthorized scraping. |
| 0.9.0               | Invite-only Playgroup: authentication, private collections and selective sharing.                                                                                             |
| 1.0.0               | Personal Commander OS: reliable imports, explainable intelligence, privacy, export and polished onboarding.                                                                   |

## Release discipline

Build the manager first; add intelligence in layers. Artwork and one-handed browsing come first. Physical copies must never silently move between decks. Preserve a deck's identity before considering raw power. Future intelligence should combine deterministic card data, inspectable tags, relationships, scoring and evidence-backed explanations.

The v0.1.x exit condition is a coherent collection → detail → back experience that people want to browse on a phone. Collect visual/touch feedback and freeze the binder before beginning import work. Minor releases add a capability layer; patches polish the existing layer. No future-roadmap feature may be slipped into a patch.
