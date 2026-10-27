# v0.6.9 — Pings / punisher decks (Valgavoth, Harrower of Souls)

Baseline: v0.6.8 at `dc0f802`. Your Valgavoth deck plays as a punisher, "group chaos" deck: symmetric effects give everyone cards, then ping them over time. The app read it as Sacrifice / Spells and showed Protection 0 and Recursion 0.

## Root causes

1. The engine had no concept of opponent life loss as a mechanic. Valgavoth's "Whenever an opponent loses life…" trigger fell through to "turn" ("acts every turn"), so it linked only through its "draw a card" half (Card Advantage). The `life-loss` tag also matched "you lose 2 life", so it couldn't prove a pings plan, and drain only lived inside Sacrifice.
2. Shroud was not a protection mode, so Lightning Greaves counted for nothing.
3. Recursion required "return … from your graveyard", which missed reanimation worded "put(s) … from a graveyard onto the battlefield", such as Exhume.

## Fixes (generic, no card names)

- **Card Intelligence**, ruleset 0.3.5 (saved auto-tags refresh once; manual corrections are kept). New `src/intelligence/rules/pings.ts`:
  - `opponent-life-loss`: opponents or every player lose life or take damage, never "you lose" and never plain "any target" burn.
  - `punisher`: whenever a player or opponent does something, damage or life loss for that player, or an "unless they sacrifice/pay" clause.
  - `symmetric-draw`: each player draws or wheels.
- **CardFacts.** `opponentLifeLoss(text)` reports `direct`, `theirTurn` (punisher, upkeep and draw-step triggers that can fire on opponents' turns) and `anyTarget`.
- **Strategy and recommendation:**
  - Commander triggers on opponents losing life, or being dealt damage, get the event `life-loss`.
  - Sources emit `life-loss`, `life-loss-their-turn` and `life-loss-weak`, and the verifier accepts them.
  - Strength: their-turn sources 1. Other direct sources 1, or 0.6 when the reward only triggers on opponents' turns. "Any target" alone 0.4.
- **Deck DNA:**
  - Family "Pings / Punisher" (opponent-life-loss, punisher, symmetric-draw), plan "ping opponents a little at a time, punishing what every player does".
  - Cards that reward opponents losing life carry a typed payoff signal.
  - Matching strategy feature "pings".
- **Card functions.** Shroud is a protection mode, partial (0.7) when it's the only one. "Put(s) … card(s) from a graveyard onto the battlefield" counts as recursion.
- **Blueprint.** The mechanic label reads "Rewards opponents losing life (pings, drain, punisher effects)".

## Results on the Valgavoth fixture

- Themes: Pings / Punisher 54% · Ramp · Card Advantage · Sacrifice / Death Payoffs · Interaction.
- Primary: Pings / Punisher + Sacrifice / Death Payoffs. Spells is no longer primary.
- Summary: "…ping opponents a little at a time, punishing what every player does… Valgavoth reinforces Pings / Punisher and Card Advantage".
- Key cards: Spiteful Visions, Mogis, God of Slaughter, Fate Unraveler. Payoff: Punisher via Fate Unraveler.
- Commander links:
  - Spiteful Visions, Fate Unraveler, Kaervek, Mogis and Kederekt Parasite: 1.
  - Gray Merchant (your-turn burst): 0.6.
  - Infernal Grasp: 0.
- Deck Health: Protection 0 → 0.7, Recursion 0 → 1. Tutors stay 0 because the deck runs no tutors.

## Not changed

Upgrade scoring architecture. The golden engine fixture is identical. All earlier regression decks (Reign of Dragons, Jackal clones, Mayhem, Miles Vehicles, cross-archetype) pass unchanged.

## Fixture

`tests/data/valgavoth-pings.json` and `tests/valgavothFixture.ts` contain the supplied list: 87 distinct cards and 100 total with 7 Mountain and 8 Swamp. The Oracle text is written from memory, because Scryfall is blocked here. 14 entries are marked `fixture_confidence: "low"`: Agate Instigator, Blood Pact, Corpse Explosion, Deadpool, Geothermal Bog, Gleeful Arsonist, Persistent Constrictor, Sadistic Shell Game, Spiked Corridor // Torture Pit, Star Athlete, Suspended Sentence, Séance Board, The Lord of Pain and Witch's Clinic.

## Tests

`tests/unit/valgavoth.test.ts` (6):
- The deck reads as Pings / Punisher, not Spells.
- The Commander trigger and its links, including the their-turn weighting and that paying your own life never counts.
- Key cards are punisher engines.
- Greaves counts as protection and Exhume as recursion.
- Generic tag rules: pings, punisher, symmetric draw, no self-loss, no plain burn.
- `opponentLifeLoss` classification.

## Validation run

- `npm run lint` and `npx tsc -b`: clean.
- `npm run test:unit`: 473 passed; the golden engine fixture is unchanged.
- `npm run build`: passed.
- `npm audit`: 0 vulnerabilities.
- `git diff --check`: clean.
- Playwright on the production build: 375 passed across all five viewports.
