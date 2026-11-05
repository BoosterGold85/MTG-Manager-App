# Land-deck ability coverage

Follow-up to v0.6.23, prompted by a production screenshot listing thirteen partially understood cards.
This is a source change, not a deployed release.

The regression set covers Asceticism, Courser of Kruphix, Dryad of the Ilysian Grove,
Embodiment of Insight, Fecund Greenshell, Incubation Druid, Lair of the Hydra,
Oracle of Mul Daya, Six, Spelunking, Titanoth Rex, Tooth and Nail and Wayward Swordtooth.
Names occur only in test data. Production recognition uses ability text, including renamed variants.

## Behavior

- Additional land plays, library land access, color fixing and untapped land entry are distinct effects.
  Library land access does not grant extra land drops. Fixing does not add ramp credit.
- Regeneration supplies limited protection, not recursion or indestructibility.
- Animated lands provide conditional combat value, not token generation.
- Creature deployment from hand needs creatures in the deck; it is neither drawing nor casting them.
- Top-card land-or-hand selection preserves its alternative outcomes. Toughness-qualified entry triggers
  require creatures whose printed numeric toughness exceeds their power; unknown values do not qualify.
- Retrace access requires both lands to discard and nonland permanents to recast. Mana costs still apply.
- Self-cycling keyword-counter triggers do not require unrelated cycling cards. Keyword counters are
  distinct from +1/+1 counters. Adapt is self-only and needs mana and the absence of +1/+1 counters.
- Land-count bonuses and bodies restricted by the city's blessing receive partial heuristic credit;
  deck composition does not establish current battlefield state.
- Three-character names such as Six now resolve correctly in deck-condition parsing.

The card-function and condition versions are incremented. Collection/deck records are not changed.
Full coverage means these ability shapes are recognized, not exhaustive Magic rules simulation or
validated win-rate prediction. No combo solver or board-state simulator is introduced.

## Fixtures and validation

`tests/data/land-coverage.json` contains analysis-only rules-text fixtures. Six records come from the
existing offline Scryfall test corpus; seven were transcribed from published card text because the
environment's Scryfall proxy was unavailable. These are not newly fetched canonical printing records.
The screenshot identifies cards, not a full decklist or collection.

Text references include the [Bloomburrow release notes](https://magic.wizards.com/en/news/feature/bloomburrow-release-notes),
[Embodiment of Insight](https://mtg.wtf/card/ogw/131/Embodiment-of-Insight),
[Titanoth Rex](https://mtg.wtf/card/iko/174/Titanoth-Rex),
[Spelunking](https://mtg.wtf/card/lci/213/Spelunking),
[Lair of the Hydra](https://mtg.wtf/card/afr/356/Lair-of-the-Hydra),
[Asceticism](https://mtg.wtf/card/som/110/Asceticism), and the existing modal-card fixtures.

`tests/unit/landCoverage.test.ts` checks all thirteen cards, renamed variants, effect distinctions,
positive/negative deck supply, and conditional combat value. Existing semantic coverage tests also run.

The previous golden snapshot is preserved. The new `upgrades-land-coverage.json` differs only for the
sparse synthetic Landfall case's Additional Land Engine: build priority 83 -> 70 and upgrade value
0.97 -> 0.36, because additional land drops now require actual land supply. Its Commander fit and
comparison cuts are unchanged. No score weights or thresholds were tuned. The Commander source-hash
baseline is refreshed only for the three intentionally changed analysis files; the protection test
continues to guard against unrelated Standard/Legacy changes.

Validation: the final full unit run passed all 740 tests in 48 files, including the existing large-collection
timing budgets. The production build (including TypeScript) and lint passed. The build retains its existing
large-chunk advisory. An earlier run overlapped the build and exceeded timing limits; the isolated final
run passed without changing those limits.
The production-browser analysis-confidence check passed at all five approved viewport sizes
(360, 390, 430, 768 and 1440 pixels), including accessibility and overflow checks. Local server
startup required sandbox escalation. The live deployed site and the user's saved deck were not changed.
