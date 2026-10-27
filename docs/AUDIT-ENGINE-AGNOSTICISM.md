# Engine agnosticism audit (before Brew Score v1)

Question: does the engine work out a new deck from its own Commander and 99 cards, or does it judge the deck by how such a Commander, type or archetype is normally built?

**Classification: B — mostly agnostic.** Deck DNA (what the deck does) is derived from the 99 and held up on 11 unseen decks. The Upgrades evaluation (Deck Health targets, Upgrade Value, the "Strengthens the plan" reason) still leans on a fixed Commander-deck template, on Commander-only targets and on Commander links that are too generous. Those issues should be fixed before Brew Score is calibrated, because Brew's bridge and Commander-connection signals read the same links.

Harness: `tests/audit/holdout.audit.test.ts`. Decks and their pre-registered expectations: `tests/audit/holdout-decks.json`. Card data is real Scryfall records in `tests/data/holdout-cards.json`.

## 1. Literal deck, card or Commander knowledge in production code

A scan matched every Commander-legal card name (Scryfall bulk, 39k names) against all string literals and comments in `src/`. **No card, Commander or deck name influences a score.**

Occurrences, none of which affect scoring:

| Where | What | Effect |
|---|---|---|
| `components/DeckImport.tsx`, `decks/deckText.ts` | "Sol Ring", "Meren of Clan Nel Toth" in import examples and placeholders | UI text only |
| `synergy/facts.ts:391`, `upgrades/cardFunction.ts:55`, `dna/strategy.ts:246`, `upgrades/upgrade.ts:243` | Condemn, Hallowed Burial, Blasphemous Act, Gregor, Ms. Bumbleflower, Lathliss in comments | Comments only |
| `synergy/facts.ts:566,615,616,740` | Creature-type-specific typed roles `dragon`, `dragon_token`, `soldier_token`, `dragon_tutor` | Defined but **never read** by any scorer (dead code), left over from the Reign of Dragons work. Should be removed or generalized to `type_token:<Type>`. |
| `synergy/facts.ts` token types (Treasure, Clue, Food, Gold, Blood, Powerstone, Junk, Incubator) | Game-rules token names that are also card names | Rules vocabulary, not card identity |

## 2. Indirectly overfit heuristics (no names, but chosen to make known decks come out right)

| Heuristic | Where | How it was chosen | Risk |
|---|---|---|---|
| Analysis-confidence thresholds (3 Commander-linked cards, plan ≥ 15%, untracked ≥ max(3, 8%)) | `upgrades/index.ts` | Picked so the four regression decks read High (documented in v0.6.11) | Directly tuned to four decks. Holdout: Kaalia reanimator got "few Commander links", which is correct; Greasefang got a false Low (finding 9). |
| Upgrade Value bands (2 / 1 / 0.45 / 0.15 / −0.15) | `upgrades/upgrade.ts` `UPGRADE_BANDS` | "Calibrated by the regression and mutation fixtures" | Labels are relative to Reign-shaped decks. Thin holdout decks show many Major Upgrades. |
| Build Priority bands | `upgrades/build.ts` | "Initial calibrated boundaries; regression fixtures pin the behavior" | Same |
| Synergy score weights | `synergy/recommendation.ts` `SCORE_WEIGHTS` | Tuned so needed interaction can reach Worth Considering | Moderate |
| Vehicle threat factor 0.85; attack-adds-attackers finisher 0.9 | `upgrades/cardFunction.ts` | Added for Miles (Parhelion II) | The text rule is generic; the values were tuned on one deck |
| Pings family, life-loss payoff signal strength 3 | `dna/families.ts`, `dna/engine.ts` | Added for Valgavoth | Generic text rule; the strength value is from one deck |
| Golden engine fixture | `tests/golden/upgrades-v0.6.6.json` | Freezes Reign-centred outputs | Protects against drift, but also freezes overfit behavior. Each change must be reviewed, not just accepted. |

## 3. Fixed archetype assumptions

- **Themes are data-derived.** A family (Graveyard, Counters, Vehicles…) only becomes a theme when at least `max(2, 6% of the 99)` main-deck cards carry its tags. The Commander's contribution is capped at 45% of the 99's. Creature-type membership alone is weak evidence (0.35); explicit type payoffs are strong. This held up: the Dragon reanimator and Ur-Dragon lands decks were not read as Dragon typal.
- **Combat keywords count as a weak "Combat" signal on every creature (0.6 each).** A deck of fliers drifts toward "support attacks and combat effects" (A1: Combat 18% and in the summary).
- **Only the top 7 themes are kept.** A real 6-Vehicle package was dropped in A2 (finding 7).
- **The core-plan wording is a per-family template** (`dna/engine.ts`). It describes the observed tags, so it is acceptable, but it is template text.

## 4. Fixed role assumptions

There are **two different role-target systems**:

- **Synergy (`dna/strategy.ts`):** a baseline of 10 ramp (12 if the average mana value is ≥ 3.5 or the Commander costs ≥ 6), 10 card advantage, 8 removal, 3 wipes and so on. Some targets do follow the 99: recursion rises to 10 when Graveyard is a primary theme, and tokens or sacrifice outlets rise when those themes are primary.
- **Upgrades and Deck Health (`upgrades/blueprint.ts`):** the same kind of baseline (36 lands, 10 ramp, 10 draw, 8 interaction, 4 finishers…), adjusted **only from the Commander's own text**. The 99 never changes a target, and the Commander's own roles never count toward the totals.

Consequences seen on holdout decks:

- H4 Niv-Mizzet spells: ramp target 12 (the Commander costs 6) in a low-curve cantrip deck. Finishers read 0.8/4 Low although the Commander is the damage engine.
- H5 Kenrith enchantress: recursion target 5, Low, because Kenrith *itself* has a reanimation ability. The template pushes an enchantress deck toward graveyard recursion the Commander already provides.
- A1 Ziatora: token target 8 ("wants many bodies") because Ziatora makes **Treasure**; the sacrifice-outlet target rises although Ziatora is the outlet.

## 5. What is data-derived

- Card Facts and card functions: from Oracle text.
- Commander triggers: from Oracle text, with an unclassified-trigger fallback that is now surfaced to the user.
- Deck DNA themes, percentages, contributors, key cards and payoff: from the 99, with the Commander capped.
- Recommendation links: typed relationships between a candidate and the actual cards in the deck.
- Deck Health counts (the targets are not).
- Analysis confidence notes (the thresholds are not).

## 6–7. Unseen and adversarial decks

Eleven decks were written for this audit and never used for tuning. Expectations were recorded in `holdout-decks.json` before the first run. Primary-theme checks: **13 of 14 passed.**

| Deck | Expectation | Result | Primary themes found |
|---|---|---|---|
| H1 Ur-Dragon built as lands | Lands primary; not Dragon-led | PASS ×2 | Lands 39%, Card Advantage, Ramp, Tokens; Dragons 4% |
| H2 Kaalia built as reanimator | Graveyard primary | PASS | Graveyard 41%, Combat 12% (Kaalia's attack trigger) |
| H3 Breya artifact sacrifice, few staples | Artifacts primary | **FAIL (partial)** | Sacrifice 27%, Tokens 17%, Artifacts 16%: right plan, but artifacts under-read |
| H4 Niv-Mizzet spells | Spells primary; card advantage not Low | PASS ×2 | Card Advantage 37%, Spells 22% |
| H5 Kenrith, Commander mostly for colors | Enchantments primary | PASS | Enchantments 40% |
| H6 Atraxa hybrid | No theme over 45% | PASS | Top theme 21% |
| H7 Tolsimir Wolves, low power | Wolves primary | PASS | Wolves 31%, Tokens 31% |
| A1 Dragon reanimator | Graveyard primary; not Dragon-led | PASS ×2 | Graveyard 35%, **Combat 18%**, Dragons 12% |
| A2 Vehicle sacrifice | Sacrifice primary | PASS | Sacrifice 24%, Graveyard 18%, **Tokens 15%, Vehicles missing** |
| A3 Counters recursion | Counters and Graveyard primary | PASS ×2 | Counters 37%, Graveyard 22% |

Strategy discovery generalizes. The failures sit in the Upgrades evaluation layered on top.

## Failures found

1. **Commander-link inflation.** A Commander that merely *is* one trigger source counts as a full-strength link: Kenrith (a 5-power creature) → Sarkhan's Unsealing 1.0, and Ziatora (a flying Dragon) → Dragon Tempest 1.0. Incidental 0.25 links (Ugin, Skullclamp with Vorel) still add more than a point of "Commander plan" in decks with little Commander synergy. That produces "Strengthens the *Commander* plan" for generic cards in almost every deck.
2. **Negation bug.** Mikaeus, the Unhallowed ("Other **non-Human** creatures get +1/+1") is read as "Explicit Human support" for Kenrith, a Human.
3. **Conditional roles aren't deck-relative.** Sarkhan's Unsealing is credited as repeatable removal and a finisher whether or not the deck casts creatures with power ≥ 4. It is the #1 upgrade in the Kenrith enchantress deck. This is the same pattern as the Ugin report: the card is valued as if the deck feeds its condition.
4. **Upgrades targets come from a Commander-only template** (section 4).
5. **Treasure counts as "bodies"**: a Treasure-making Commander raises the creature-token target by 8.
6. **Every Vehicle is tagged `go-wide`**, which inflates Tokens (A2: 15%).
7. **The top-7 theme cap** hides a 6-card Vehicle package (A2).
8. **Keyword combat signal** makes Combat a primary theme of a Dragon reanimator (A1).
9. **A delayed trigger is misread.** "Return it … at the beginning of **your** next end step" (Greasefang) is treated as an unclassified Commander trigger, giving a false Low confidence.
10. **Artifacts are under-read** in an artifact-token deck (H3). Partial: Sacrifice is a fair reading.

Fixed in this pass, from the user's Ugin report:

- Planeswalker ultimates costing more than starting loyalty no longer count as roles (Ugin's −11 was read as a tutor).
- Mana sources costing 5 count as 0.7 ramp, and 6+ as 0.4.
- Upgrade reasons now need a visible change (≥ 1 point) before they claim a component.

## Leave-one-deck-out

The heuristics are hand-written rules, not fitted parameters, so a literal leave-one-out refit isn't possible. The equivalent from now on:

- The holdout decks are never used to choose a value.
- A rule change is checked against them after it is written.
- A regression deck is added only after its expected results are written down.

The overfit rows in section 2 are the values to re-derive this way.

## Proposed corrections, before Brew calibration

1. **One deck-derived role profile.**
   - Targets = a weak prior (today's baseline) blended with the observed density of the 99, the curve and the Commander's mana value.
   - The Commander's own roles count toward totals (Niv's draw and damage, Kenrith's recursion).
   - Synergy and Upgrades read the same profile.
2. **Commander link strength reflects repetition.** A Commander acting as a single trigger source is weak (≈0.3). "Strengthens the plan" requires a candidate link ≥ 0.5.
3. **Conditional roles scale by the deck's supply of the condition** (creatures with power ≥ 4, colorless spells, Dragons entering), the same way token multipliers already scale by matching token sources.
4. **Parsing fixes:** the non-Human negation; Treasure isn't a body; Vehicles aren't go-wide; the "your next end step" delayed trigger.
5. **Theme selection:**
   - Keep any package that clears the repetition floor, rather than a top-7 cut.
   - Count combat keywords only when the deck has attack payoffs.
6. **Brew Score inputs are data-derived only:** packages from DNA contributors, typed links to actual deck cards, counted producers and consumers. No role template, archetype prior or popularity. Bridges and Commander connection depend on corrections 2–4, so they come first.
