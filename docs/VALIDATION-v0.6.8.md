# v0.6.8 — Evaluator fixes from the Miles "Tails" Prower deck

Baseline: v0.6.7 at `f387d20`. A real Vehicles deck exposed four generic evaluator problems. All fixes are rules-based; no card names are special-cased.

## Root causes and fixes

1. **Mass removal.** `answerOf` (`src/synergy/facts.ts`) tested "destroy/exile all" against the start of the whole line, so `• Destroy all creatures` and `Return a creature you control …, then destroy all other creatures` were read as targeted removal. It now tests the matched removal clause. Board Wipes in Deck Health and the upgrade model share this fact, so both update.
2. **Key Cards.** `central` was the top three generic synergy scores. `src/dna/engine.ts` now ranks strategic centrality:
   - 2 × primary-theme connection strength (payoff and enabler signals weigh more than support),
   - + 4 × the strongest verified Commander relationship,
   - + 1.2 × verified relationships with other deck cards (engine centrality),
   - with fit score only as a tie-breaker.

   A card qualifies only with a primary-theme connection plus a payoff/enabler signal, a Commander relationship or at least one engine link.
3. **Core Plan payoff.** An explicit `payoff` signal is still preferred. Otherwise the payoff is taken from a typed relationship: a Commander trigger verified against at least two primary-theme cards, quoted as its full ability line, or the primary-theme card with three or more deck links.
4. **Finishers.**
   - `cardFunction` treats Vehicles as threat bodies, at 0.85 to reflect crewing.
   - Large evasive Vehicles count as finishers.
   - A repeatable attack trigger that creates creature tokens counts as a finisher (0.9).
   - `combatThreat` includes Vehicles.

Supporting fix: `Vehicle` is a trigger object in strategy receivers. Vehicle cards and "create … Vehicle … token" emit `vehicle` in both the strategy profile and the recommendation relationships, so "Whenever a Vehicle you control enters" is verified. The Vehicles family plan reads "crew Vehicles and attack with them".

## Results on the Miles fixture

- Primary: Vehicles / Combat.
- Board Wipes: 0 → 2 / 2 (Cleansing Nova, Time Wipe).
- Finishers: 0.8 → 5.8 / 4.
- Key Cards: Parhelion II, Deluxe Dragster, Mu Yanling, Wind Rider. Mishra's Bauble is not a key card.
- Payoff: "Vehicles payoff via Miles "Tails" Prower: Whenever a Vehicle you control enters, it gains flying until end of turn. If it's your turn, draw a card."

## Architecture unchanged

Commander Fit, Build Priority and Upgrade Value logic are unchanged. The golden engine fixture changed in one reviewed way. Utvara Hellkite, which makes attacking Dragon tokens, gained the new attack-engine finisher credit (finishers 0.8 → 0.9). That reorders the second alternative cut for three low-value Reign candidates (Mana Geyser → Chandra's Ignition). Every Upgrade Value, label, best cut, Commander Fit, Build Priority and ranking is identical.

## Fixture

`tests/data/miles-tails-vehicles.json` and `tests/milesFixture.ts` contain the supplied list: 72 distinct cards and 100 total with 15 Island and 15 Plains. Scryfall and its data hosts are blocked by this environment's network policy, so the Oracle text is written from memory. 18 entries are marked `fixture_confidence: "low"` and should be checked against Scryfall when the fixture is refreshed. These are mostly recent, Universes Beyond and Un-set printings: Miles "Tails" Prower, Cargo Ship, Cid, Cloudspire Captain, Gearseeker Serpent, Goldbug, Guidelight Pathmaker, Irontread Crusher, Kitsune Ace, Mu Yanling, Rolling Hamsphere, Sanwell, Skybox Ferry, Tangle Tumbler, The Lunar Whale, Thopter Fabricator, Ugin and the Unfinity Rocketship. The Commander's text is reconstructed from your description ("rewards Vehicle ETBs with flying/card draw"). The high-confidence cards carry the behaviors under test: Cleansing Nova, Time Wipe, Parhelion II, Mishra's Bauble and Smuggler's Copter.

## Tests

- `tests/unit/miles.test.ts` (7):
  - Miles deck: 100 cards, Vehicles / Combat plan, wipes counted, key cards, typed payoff, Parhelion finisher credit.
  - Generic rules: modal, "choose one or both", multi-clause and "then exile all" wipes; non-creature modal mass removal; attack-token engines; large evasive Vehicles count as finishers and a small Vehicle does not.

## Validation run

- `npm run lint` and `npx tsc -b`: clean.
- `npm run test:unit`: 467 passed, including the reviewed golden fixture.
- `npm run build`: passed.
- `git diff --check`: clean.
- Playwright on the production build: 375 passed across all five viewports.
