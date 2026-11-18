# Brew Lab on "Lumra Rebuild V2" (2026-11-18)

Scope: a 100-card Commander list (Lumra, Bellow of the Woods, green). Card data from Scryfall's public collection endpoint (79 names, all found). This is a deck-internal proxy: the in-app pass tests your owned collection, which was not available, so these results show what the engine can read in this list, not what your collection would add.

## Readability (compiler, 79 unique cards)
- Readable: 7 (Forest, Sol Ring, Elvish Mystic, Elemental Bond, Galewind Moose, Garruk's Uprising, Harmonize).
- Unreadable: 72. Of these, 14 are lands and 58 are nonland.
- Main unreadable families (approximate, first matching rule): land search/fetch 18; other 27; landfall triggers 8; extra land plays 8; layout/modal/keyword set aside 6; static grants 3; mana variants 2.
- Lumra itself is unreadable (its P/T and ETB mill/return are unsupported), so the commander's own contribution is not tested.

## Discovery pass (anchor Lumra, focus each nonland card, partners = the other deck cards, library 40)
- 63 focus cards run, 208/208 scenarios each (not truncated).
- 3 focus cards produced findings, all `draw +1`:
  - Elemental Bond + Galewind Moose: Moose enters with power 6 (≥3), Bond draws. Matches oracle text.
  - Garruk's Uprising + Galewind Moose: Moose enters with power 6 (≥4), Uprising draws. Matches oracle text.
- Negative control: Elvish Mystic (power 1) does not trigger either card.

## Limits
- Coverage is low: most landfall, land-search and extra-land cards (the deck's engine) are unreadable, so chains involving them are not found.
- Results describe this list only; the real pass needs owned copies in the collection.
