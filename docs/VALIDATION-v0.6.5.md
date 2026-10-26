# v0.6.5 — Clones & Copies theme

Baseline: `2cd5106` (v0.6.4, now Approved). Trigger: a real Jackal, Genius Geneticist clone deck whose Deck DNA and Synergy Explorer didn't identify copying as its theme.

## Root cause

1. The taxonomy had no tag for copying permanents or creatures. "Enter as a copy of", "become a copy of" and "token that's a copy of" produced no signal at all.
2. `copy-spells` matched "copy that spell" for creature spells, so Jackal registered as a Spells/Spellslinger enabler.
3. Neither the Deck DNA families nor the Synergy Explorer strategy features had a clone theme to aggregate into.

## Fix

- `src/intelligence/rules/copies.ts`: `clones` (strategy category) and `copy-creature-spells` (enabler). The rule matches per sentence, records the matching sentence as evidence, and strips parenthesized reminder text first, so populate/myriad reminders don't count.
- `src/intelligence/rules/spells.ts`: `copy-spells` skips sentences that copy creature spells.
- `src/intelligence/taxonomy.ts`: 2 new tags (80 total). `RULESET_VERSION` 0.3.3 triggers the existing one-time recalculation; manual overrides are preserved.
- `src/dna/families.ts`: Clones & Copies family ("copy creatures and permanents to repeat their best effects"). `src/dna/strategy.ts`: Clones / Copies archetype feature. `DNA_VERSION`/`SYNERGY_VERSION` 0.6.5.

## Tests

`tests/unit/clones.test.ts` (5) and a new "Clones / Copies" entry in the shared DNA regression decks (`tests/dnaFixtures.ts`). Tag detection covers nine clone cards and evidence. Jackal is copy-creature-spells, not copy-spells or spellslinger; Narset's Reversal and Sea Gate Stormcaller stay copy-spells. Reminder and incidental text are ignored. The Jackal deck's DNA leads with Clones & Copies, and Spells is less than half its weight. Clones / Copies is a primary Synergy Explorer archetype.

Jackal's Oracle text in the fixture is reconstructed from memory: Scryfall was not reachable from the build environment. Detection depends on the standard "copy that spell" + "creature spell" wording, so it should hold, but confirm on the real saved deck after the one-time re-tag.

## Notes

- `tests/unit/synergy.test.ts` "ranks 4421 … deterministically" has a 5,000 ms budget. It intermittently exceeds it under parallel load both before and after this change (isolated: ~2.8 s either way). This is pre-existing timing flakiness, not a regression.
