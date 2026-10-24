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
| **0.5.0 — Current** | Deck DNA Core: local deterministic theme families, Commander influence, evidence-led summaries/Core Plan, per-card Synergy and contextual browsing.                                                                                                   |
| 0.6.0               | Synergy Explorer: explainable candidates from owned, preferably unassigned copies; no automatic changes.                                                                      |
| 0.7.0               | New Set Watcher: evaluate new releases against existing deck identity.                                                                                                        |
| 0.8.0               | Uniqueness: separate originality, cohesion and power; lawful comparison-provider abstraction. EDHREC only through a permitted data relationship, never unauthorized scraping. |
| 0.9.0               | Invite-only Playgroup: authentication, private collections and selective sharing.                                                                                             |
| 1.0.0               | Personal Commander OS: reliable imports, explainable intelligence, privacy, export and polished onboarding.                                                                   |

## Release discipline

Build the manager first; add intelligence in layers. Artwork and one-handed browsing come first. Physical copies must never silently move between decks. Preserve a deck's identity before considering raw power. Future intelligence should combine deterministic card data, inspectable tags, relationships, scoring and evidence-backed explanations.

The v0.1.x exit condition is a coherent collection → detail → back experience that people want to browse on a phone. Collect visual/touch feedback and freeze the binder before beginning import work. Minor releases add a capability layer; patches polish the existing layer. No future-roadmap feature may be slipped into a patch.
