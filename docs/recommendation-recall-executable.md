# MTG MANAGER — RECOMMENDATION RECALL & INTERACTION COVERAGE PASS

Start from current main, including commit:

0f90fff

Do not begin the production Brew Score or Brew UI.

GOAL

The recommendation engine is now reasonably good at rejecting bad candidates, but it misses too many cards that should be recognized as useful.

Current research benchmark:

- Hidden Gem Recall@20: approximately 42%
- obvious expected-card recall: approximately 17%
- defined trap rejection: approximately 96%

The purpose of this pass is:

INCREASE RECALL

while preserving:

HIGH FALSE-POSITIVE REJECTION

Do not solve this by broadly loosening thresholds.

Find out WHY expected cards are being missed.

==================================================
1. FIRST DETERMINE WHERE RECALL IS LOST
==================================================

For every missed expected card in the Brew / recommendation corpus, classify the failure into exactly one primary category:

A. CANDIDATE GENERATION FAILURE
The card was never evaluated.

B. SEMANTIC EXTRACTION FAILURE
The engine did not correctly understand what the card does.

C. INTERACTION MATCHING FAILURE
The card facts were correct, but the engine failed to connect them to the deck.

D. CONDITION-SUPPLY FAILURE
A real interaction exists, but condition support was counted incorrectly.

E. ROLE / STRATEGY FAILURE
The deck profile did not recognize the need/package the card serves.

F. SCORING FAILURE
The correct evidence exists but receives too little weight.

G. RANKING FAILURE
The card scores reasonably but gets buried behind weaker generic candidates.

H. EXPECTATION FAILURE
The manually expected card is not actually supported strongly enough and should not be considered a required hit.

Produce counts for every category.

Do not change scoring until this classification exists.

==================================================
2. DO NOT LOOSEN THE ENGINE GLOBALLY
==================================================

Trap rejection is currently approximately 96%.

Protect that.

Do not solve low recall by:

- lowering all recommendation thresholds
- increasing generic tag overlap
- increasing Commander bonuses globally
- increasing card-quality bonuses globally
- rewarding popularity
- removing conditional-support requirements
- treating all shared archetype tags as interactions

The goal is better understanding, not more generous scoring.

==================================================
3. CANDIDATE COVERAGE AUDIT
==================================================

Confirm every expected card actually enters the evaluator.

Audit:

- Commander color identity
- legal-card filtering
- owned-card filtering
- alternate print grouping
- split / modal cards
- MDFCs
- Adventures
- transform cards
- colorless cards
- lands
- Vehicles
- Equipment
- Auras

For every missed golden card, record:

Candidate generated?
YES / NO

If NO, explain exactly why.

Candidate-generation failures must be fixed before scoring changes.

==================================================
4. FACT EXTRACTION COVERAGE
==================================================

Use real Scryfall Oracle data.

For missed expected cards, compare:

WHAT THE CARD ACTUALLY DOES

against:

WHAT CARD INTELLIGENCE EXTRACTED

Pay special attention to:

- triggered ability vs effect
- activation cost vs resulting effect
- self-only vs another permanent
- your creature vs any creature
- opponent vs controller
- nontoken / token
- non-Human / Human-style negation
- “one or more”
- once per turn
- delayed triggers
- replacement effects
- static abilities
- cast triggers
- ETB triggers
- leaves-battlefield triggers
- dies triggers
- cards entering graveyard
- cards leaving graveyard
- counter placement
- counter removal
- copying permanents
- copying spells
- copying triggered abilities

Prefer systematic parser fixes over named-card exceptions.

==================================================
5. WEAK INTERACTION FAMILIES
==================================================

Perform focused audits on the interaction families already identified as weak.

At minimum:

BLINK / ETB

Confirm:
- candidate actually has a useful ETB
- blink source can legally target it
- self-blink vs other-target blink
- temporary exile with delayed return
- blink does not get credit for non-ETB cards

EQUIPMENT / VOLTRON

Confirm:
- Equipment producers
- equip-cost reducers
- free equip
- equipped-creature payoffs
- equipment-entering triggers
- equipment density
- creature availability

VEHICLES

Confirm:
- crew requirements
- actual creature supply
- Vehicle recursion
- artifact relationships
- attack payoffs
- Vehicles do not imply Tokens or Go Wide

LANDS / LAND RECURSION

Confirm:
- lands entering
- lands leaving graveyard
- land sacrifice
- landfall
- extra land drops
- graveyard land engines

CLONE / COPY

Confirm:
- permanent type compatibility
- legendary constraint
- nonlegendary restrictions
- self-copy restrictions
- whether a copied ability remains independently useful
- once-per-turn limitations
- token-copy vs card-copy semantics

COUNTERS

Confirm:
- counter type
- target compatibility
- self-only placement
- another creature
- counter payoff
- proliferate
- counter removal
- counter doubling

==================================================
6. CONDITION SUPPLY
==================================================

Preserve the current rule:

A conditional effect receives credit only when the actual deck can feed its condition.

Do not remove this.

Improve its precision.

For every conditional candidate report:

Condition:
e.g. creature power 4+

Eligible deck cards:
14 / 99

Named feeders:
Card A
Card B
Card C
...

Support:
High / Medium / Low / None

A condition with fewer than two feeders currently receives no credit.

Keep this conservative rule unless the audit identifies a repeatable single source where treating it as zero is clearly wrong.

If an exception is needed, generalize it around:

REPEATABILITY

not card identity.

==================================================
7. REPEATABLE SINGLE ENABLERS
==================================================

Research whether the “minimum two feeders” rule misses legitimate engines.

Example concept:

One repeatable permanent can trigger a candidate every turn.

That may be more meaningful than two one-shot enablers.

Create:

Effective Condition Supply

instead of only raw feeder count.

Conceptually consider:

- number of feeders
- repeatability
- reliability
- mana/setup requirement

Do NOT hard-code named cards.

==================================================
8. INTERACTION MATCHING
==================================================

If both cards are understood correctly but no interaction is created, inspect the relationship vocabulary.

Look for missing producer → consumer edges such as:

produces counters
→ rewards counters

fills graveyard
→ consumes graveyard

creates artifact
→ rewards artifact entry

copies creature
→ repeatable creature engine

blinks permanent
→ useful ETB

sacrifices permanent
→ death payoff

discards
→ Madness / graveyard payoff

attacks
→ attack trigger

combat damage
→ combat-damage payoff

casts noncreature spell
→ spellslinger trigger

Do not fall back to generic tag overlap when a typed relationship can exist.

==================================================
9. OBVIOUS CARD RECALL
==================================================

17% obvious-card recall is too low.

Create a dedicated:

OBVIOUS FIT

evaluation set.

These should be cards where the relationship is simple and undeniable.

Examples:

token generator in a strong token-payoff deck

reanimation spell in a graveyard deck

+1/+1 counter source in a counter-payoff deck

ETB creature in a blink deck

equipment payoff in equipment deck

artifact payoff in artifact-heavy deck

The system should achieve high recall on these BEFORE Hidden Gem intelligence is approved.

Target:

Obvious Fit Recall@20 >= 80%

Do not proceed to final Brew Score below this target without documenting why.

==================================================
10. HIDDEN GEM RECALL
==================================================

Preserve the existing fixed expected Hidden Gem set.

Do not change expectations merely to improve metrics.

Target:

Hidden Gem Recall@20 >= 70%

A hidden gem should require contextual reasoning beyond simple theme overlap.

==================================================
11. TRAP REJECTION
==================================================

Preserve the trap corpus.

Target:

Trap Rejection >= 90%

Current performance is approximately 96%.

Do not knowingly trade this down below 90% simply to improve recall.

==================================================
12. PRECISION
==================================================

For top recommendations calculate:

Precision@10
Precision@20

Classify each result:

- Excellent contextual fit
- Good obvious fit
- Interesting / debatable
- Weak
- False positive

Target:

Precision@10 >= 80%

==================================================
13. REAL-DECK VALIDATION
==================================================

The constructed corpus is no longer enough.

Add at least 10 real human-built Commander decks that were NOT designed around the engine tests.

Prefer variety:

- precon upgraded lightly
- heavily personalized deck
- weird hybrid strategy
- low-power thematic deck
- typal deck
- graveyard deck
- artifact deck
- spell-heavy deck
- combat deck
- deck where Commander is mostly colors

Before running recommendations:

record a short human expectation sheet for each deck.

Do not tune values directly from these decks.

Use them as holdouts.

==================================================
14. UNKNOWN CARD / ABILITY REPORT
==================================================

Reuse the v0.6.11 uncertainty architecture.

For every test deck report:

- unclassified cards
- unclassified abilities
- low-confidence relationships
- missing Oracle data

A poor recommendation caused by known uncertainty should be classified differently from a confident wrong recommendation.

==================================================
15. EXPLANATION QUALITY
==================================================

Every recommendation in the validation report must be able to explain:

WHY THIS CARD?

using actual deck evidence.

Example:

GOOD

“This effect is fed by 14 creatures with power 4 or greater: A, B, C...”

GOOD

“Five blink effects can retrigger this card's ETB ability.”

BAD

“Good in this archetype.”

BAD

“Strong synergy.”

BAD

“Matches the Commander.”

Explanations must cite concrete semantic relationships.

==================================================
16. GENERIC-ENGINE SUPPRESSION
==================================================

Audit whether generically powerful cards still crowd out contextually stronger cards.

A generic value engine may rank highly when it fills an actual role.

It should not dominate because it has many unrelated abilities.

Multi-role cards should receive value only for roles that:

- are usable
- are relevant
- are realistically enabled

Preserve the lessons from Ugin.

Potential value != realized value.

==================================================
17. CARD QUALITY VS DECK FIT
==================================================

Keep generic card quality bounded.

A card being:

efficient
flexible
cheap
repeatable

may help break close scores.

It must not outweigh poor deck fit.

Deck-relative evidence remains primary.

==================================================
18. NO POPULARITY OR PRICE YET
==================================================

Do not add:

- EDHREC
- Moxfield popularity
- Archidekt popularity
- external deck frequency
- market price

Popularity and affordability are future Brew modifiers.

They must not be used to repair semantic recall.

==================================================
19. NO BREW UI YET
==================================================

Do not add:

- Brew filter
- Brew Score on cards
- Hidden Gems tab
- Brew Lab
- final user-facing Brew labels

Developer-only research output is allowed.

==================================================
20. PERFORMANCE
==================================================

Maintain practical local performance.

Benchmark:

100-card deck

against:
1,000 candidates
4,000 candidates
6,000 candidates

Do not use exhaustive card-combination searches.

Prefer:

- cached facts
- indexed condition supply
- bounded interactions
- cached deck profile

==================================================
21. VERSION CLEANUP
==================================================

Before release:

Audit the current version state across:

- package metadata
- README
- CHANGELOG
- ROADMAP
- validation docs

Do not rewrite Git history.

Establish current main as the canonical baseline.

Assign this completed pass the next correct project version consistently.

Document earlier research checkpoints as research checkpoints rather than pretending they were all production releases.

==================================================
22. VALIDATION
==================================================

Run:

- full unit suite
- full browser suite
- all five approved viewport sizes
- lint
- type check
- production build
- npm audit
- git diff --check

Also run:

- Brew research corpus
- obvious-fit corpus
- trap corpus
- 10+ real holdout decks
- existing golden regression fixtures

==================================================
23. COMPLETION REPORT
==================================================

Report:

CURRENT BASELINE

FAILURE CLASSIFICATION
- candidate generation %
- semantic extraction %
- interaction matching %
- condition supply %
- role/profile %
- scoring %
- ranking %

METRICS
- Obvious Fit Recall@20
- Hidden Gem Recall@20
- Trap Rejection
- Precision@10
- Precision@20

FAMILY RESULTS
- Blink
- Equipment
- Vehicles
- Lands
- Clone/Copy
- Counters

REAL DECK RESULTS

BEST NEWLY RECOVERED RECOMMENDATIONS

WORST REMAINING FALSE POSITIVES

WORST REMAINING FALSE NEGATIVES

PERFORMANCE

TEST COUNTS

VERSION

COMMIT SHA

DEPLOYMENT STATUS

==================================================
24. FINAL GATE
==================================================

Finish with exactly one recommendation:

A. READY FOR BREW SCORE

Only if:
- obvious-card recall is strong
- Hidden Gem recall meets or approaches target
- traps remain controlled
- explanations are causally grounded

B. ANOTHER INTELLIGENCE PASS REQUIRED

if the architecture is working but one or more interaction families still materially hurt recommendation quality.

C. REASSESS BREW APPROACH

if good recall cannot be achieved without unacceptable false positives.

Then STOP.

Do not build the production Brew Score automatically.