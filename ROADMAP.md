# MTG Manager roadmap

Summarized from the supplied master whitepaper. Future entries are planning only; they are not implemented in v0.1.0.

| Release             | Focus                                                                                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1.0               | Digital Binder Foundation: sample collection, premium mobile UI, artwork, search, filters, sorting and card details.                                                          |
| 0.1.1 — Frozen      | Binder polish: Commander Colors subset filtering; continued ergonomics, accessibility and visual review.                                                                      |
| 0.2.0 — Approved | Real Collection Foundation: ManaBox CSV preview/import, deterministic matching, safe re-import upserts, local persistence and physical ownership.                             |
| **0.2.1 — Current** | Collection Management & Multi-Select: safe local removal/clear, statistics, import history and JSON backup. |
| 0.3.0               | Card Intelligence & Taxonomy: inspectable semantic tags, evidence, confidence and correction.                                                                                 |
| 0.4.0               | Commander Library: managed decklists, card assignment, copy tracking and history.                                                                                             |
| 0.5.0               | Deck DNA: explain a deck's identity, archetypes, interactions and strategy.                                                                                                   |
| 0.6.0               | Synergy Explorer: explainable candidates from owned, preferably unassigned copies; no automatic changes.                                                                      |
| 0.7.0               | New Set Watcher: evaluate new releases against existing deck identity.                                                                                                        |
| 0.8.0               | Uniqueness: separate originality, cohesion and power; lawful comparison-provider abstraction. EDHREC only through a permitted data relationship, never unauthorized scraping. |
| 0.9.0               | Invite-only Playgroup: authentication, private collections and selective sharing.                                                                                             |
| 1.0.0               | Personal Commander OS: reliable imports, explainable intelligence, privacy, export and polished onboarding.                                                                   |

## Release discipline

Build the manager first; add intelligence in layers. Artwork and one-handed browsing come first. Physical copies must never silently move between decks. Preserve a deck's identity before considering raw power. Future intelligence should combine deterministic card data, inspectable tags, relationships, scoring and evidence-backed explanations.

The v0.1.x exit condition is a coherent collection → detail → back experience that people want to browse on a phone. Collect visual/touch feedback and freeze the binder before beginning import work. Minor releases add a capability layer; patches polish the existing layer. No future-roadmap feature may be slipped into a patch.
