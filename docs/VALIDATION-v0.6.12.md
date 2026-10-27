# v0.6.12 — Deck-relative conditions and engine-agnosticism fixes

Baseline: v0.6.11 at `19940ad` (approved). This release implements the corrections proposed in `docs/AUDIT-ENGINE-AGNOSTICISM.md` before Brew Score (v0.6.13).

## Acceptance rule

> A recommendation cannot receive major credit for an effect unless the engine can point to actual cards in this deck that reliably satisfy the condition required to use that effect.

- **Conditions** (`src/upgrades/conditions.ts`): `effectConditions(card)` reads the condition each ability needs from Oracle text.
  - Kinds read: spell casts by kind, permanents or types entering, dying or attacking, counter placement, sacrifice, life gain, discard, tokens, scry and surveil, cycling, graveyard leaves, intervening "if you control…", type anthems, and the counter and token replacement effects.
  - Not counted as conditions: self triggers, phase triggers, and triggers every table supplies (opponents' actions, any creature dying, your attacks and draws).
- **Supply** (`SupplyIndex`, one per deck model): the deck cards that satisfy each condition, with the Commander counted twice. `conditionFactor` is 0 below two suppliers and reaches 1 at a reliable count: 8 for cast/enter/die/attack kinds, 5 for repeated sources, 30 for lands, 12 creatures to crew a Vehicle. A condition the parser can't check gets 0.5 and lowers confidence.
- **Credit** (`deckCardFunction`): the card's function without its conditional abilities, plus each ability's own contribution scaled by its factor. Vehicles scale their attack and body credit by crew supply.
  - Used by the deck model (Deck Health and Upgrade Value) and by Build Priority.
  - Synergy (`scoreRecommendation`) drops the role credit of any ability below half supply and records why in its conflicts.
- **Explanations:** every Upgrade reason, concern, Build Priority reason and Synergy conflict about a conditional ability names the cards that feed it, or says that nothing does.

## Audit corrections

| Finding | Fix |
|---|---|
| Commander as a single trigger source counted as a full link | Capped at 0.3 unless the Commander repeatedly produces the event, for example by creating matching tokens (`producesRepeatedly`). "Strengthens the Commander plan" requires a link ≥ 0.5. |
| "non-Human" read as Human support | `(?<!non-)` in every creature-type pattern |
| Treasure counted as bodies | Only creature tokens raise the token target |
| Vehicles tagged go-wide | The Crew reminder ("any number of creatures you control") is excluded |
| "your next end step" read as an unknown Commander trigger | Added to the delayed-trigger pattern |
| Flying alone made Combat a theme | Keyword combat signals count only with repeated attack payoffs (≥ max(3, 4%) of the 99), or an attacking Commander |
| Upgrade targets from a Commander-only template | `deckTargets`: ramp shifts by the 99's average mana value; recursion, token, sacrifice-outlet and discard targets rise only when the 99 pursues that plan (≥ 15%, or primary and ≥ 10%) and fall back when only the Commander suggests it; the Commander's own roles count toward totals. Deck Health shows each reason. |
| Ugin, Eye of the Storms first in most decks | Ultimates beyond starting loyalty ignored; ramp credit scales with the source's cost (5 → 0.7, 6+ → 0.4) |
| Unused Dragon/Soldier typed roles | Still defined and still unused; to be removed with the Brew work |

Versions: Card Intelligence ruleset 0.3.7 (tags change, so saved auto-tags refresh once). DNA and Synergy 0.6.12.

## Golden engine output (reviewed)

Changes against v0.6.11 `main` (`tests/golden/upgrades-v0.6.6.json`), 17 entries:

- **Reign of Dragons:** values move ≤ 0.02. Three best cuts change from Hit the Mother Lode to Chandra's Ignition (Combat Celebrant, Fiery Emancipation, Savage Beating). Labels unchanged.
- **Artifact (synthetic):** its 5-mana rocks count 0.7 ramp, so cheap mana candidates rise: Alania's Pathmaker 0.38 → 0.49 (Minor → Moderate), Artifact Mana Engine 0.19 → 0.26.
- **Landfall (synthetic):** the deck's landfall payoffs have few lands to feed them, so Additional Land Engine rises 0.64 → 0.97 and Alania's Pathmaker −0.32 → 0.12 (Downgrade → Sidegrade).
- **Spellslinger, Voltron, Graveyard (synthetic):** moves ≤ 0.1, labels unchanged.
- **Blink (synthetic):** Generic Fight now has a valid cut (−1.2, Downgrade) where before it had none (0, Downgrade).

## Tests

- `tests/unit/conditionalCredit.test.ts` (16), all on the holdout decks with real Scryfall data:
  - **Acceptance invariant:** in every holdout deck, for every conditional card in the candidate pool and the deck, an ability with no suppliers adds nothing to any role or to impact; any credit given names suppliers that really are in the deck. This covers more than 100 cards.
  - Upgrade and Build explanations of every conditional ability name its feeders.
  - Named cases:
    - Sarkhan's Unsealing: none of its roles in an enchantress deck, credited among big Dragons.
    - Ugin's colorless trigger: credited only with colorless spells.
    - Evolution Witness: credited, with its feeders named.
    - Skysovereign: crew credit follows the deck's creatures.
    - Synergy follows the same rule.
  - Parser cases on real Oracle text.
  - One test per audit fix.
  - Ownership doesn't change credit.
- `tests/unit/cardPoolRules.test.ts`: Ugin ultimates and ramp by cost.
- Updated expectations (intentional, not regressions):
  - `deckDna.test.ts` and `deckDna.spec.ts`: the small Dragon fixture no longer shows a flying-only Combat theme, so it shows 3 themes.
  - `strategy.test.ts`: the off-type utility card now has an unconditional draw ability; its old instant/sorcery trigger is correctly unfed in a spell-less deck.
- Audits (not in the unit suite):
  - `tests/audit/holdout.audit.test.ts`: 11 decks, 13 of 14 pre-registered checks pass. H3 (Breya) still reads as Sacrifice first and Artifacts third, a fair reading of an artifact-sacrifice deck.
  - `tests/audit/conditions.audit.test.ts`: 3,578 of 32,094 Commander-legal cards have deck conditions; 811 unrecognized conditions get half credit.

## Known limitations

- Supply counts cards, not timing or reliability within a game. A tutor that finds a supplier doesn't count as one.
- Synergy drops a role below half supply rather than scaling it; Upgrade Value scales smoothly.
- Static conditions beyond type anthems and "if you control…" are not modeled: threshold, delirium, metalcraft, "as long as…".
- Reanimation isn't treated as an alternative to ramp, so a Dragon reanimator still gets a high ramp target from its curve.
- The holdout decks are about 40 spells plus a 36-land base, so their Upgrade Values run high. They test direction and evidence, not absolute values.

## Validation run

- `npm run lint`, `npx tsc -b`, `git diff --check`: clean. `npm audit`: 0 vulnerabilities. `npm run build`: passed.
- `npm run test:unit`: 508 passed.
- Playwright on the production build: 380 passed across mobile-360, mobile-390, mobile-430, tablet and desktop.
  - The desktop deck-editor test (`decks.spec.ts:94`) failed once on an accessibility scan during the final run. It is the known intermittent failure from earlier releases: it passed 10 of 10 in isolation and in a full desktop re-run (76 of 76). This release changes no deck-editor UI.
