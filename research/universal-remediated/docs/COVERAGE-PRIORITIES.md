# Next mechanical coverage work

These priorities use the unchanged 30-deck corpus, not the unseen holdout.
Counts are input occurrences, not card strength or numerical synergy weights.

| Reusable mechanism | Observed blockers | What must be verified |
|---|---|---|
| Targeted exile/destruction and controller-based life | Swords to Plowshares: 20 copies in eight decks | Mandatory selection, target type/controller, last-known power, death versus exile, token disappearance, shield/indestructible/prevention, life recipient and zero life |
| Ordered hand/library transitions | Brainstorm: 12 copies in three decks | Known/unknown identities, top-card order, draw costs, replacement effects, hand minimums and subsequent access; no invented drawn enablers |
| Stack objects, timing and spell/ability targets | Counterspell: nine copies in three decks | Announcement versus resolution, target legality, copying versus casting, response order, mana abilities and failure handling |
| Generic graveyard casting permissions and costs | Emry: eight copies in two decks | Typed permissions, time scope, target identities, actual casts versus returns, affinity/alternative-cost arithmetic and prohibitions |
| Opposing choices and multi-clause damage/copies | Chain Lightning: eight copies in two decks | Explicit opposing payments and target choices, independent copy identity, resource conflicts and non-exhaustive outcomes |
| Broader triggered predicates and counted events | Common entry/death/counter payoffs | One event versus each counter/token, optional payment, intervening-if checks, once-per-turn caps and last-known identity |

A separate next revision can develop these mechanisms while the reviewed
revision stays frozen. No new parser pattern enters the dormant merged module
without its own tests and review. Do not simplify unsupported global influences
away merely to increase reported coverage. Measure per-copy/unique-card/clause
coverage and actual certified interactions after each expansion.

The frozen revision's additional-cost evidence and rule-derived transition
citations should be repaired alongside these mechanisms in a new revision;
never overwrite the historical predictions. Establish a newly held-out,
independently adjudicated evaluation before claiming the new revision meets
activation gates.
