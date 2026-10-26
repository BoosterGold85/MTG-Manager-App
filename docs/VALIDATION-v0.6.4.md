# v0.6.4 — Basic Land Import Exception

Baseline: `6c1a78d` (v0.6.3, now Approved). Scope: the supplied "Basic Land Import Exception" brief. No recommendation, DNA or synergy scoring changes; their engine versions are unchanged.

## Rule

`isBasicLand(card)` (`src/decks/decks.ts`) is true when the supertype part of the front-face type line contains both `Basic` and `Land`. Names are never used.

| Card | Basic? |
|---|---|
| Plains … Forest (`Basic Land — X`) | Yes |
| Snow-Covered basics (`Basic Snow Land — X`) | Yes |
| Wastes (`Basic Land`) | Yes |
| Command Tower, Path of Ancestry, Dryad Arbor (`Land Creature — Forest Dryad`) | No |

## Behavior

- **Import preview** (`src/decks/deckImport.ts`): basic entries get status `basic` and skip quantity, printing and allocation matching. They are always reviewed, never suggested picks, never counted as missing, unassigned or needing review, and appear in a separate `basic` summary count. Owned printings are still listed for information.
- **Confirm**: a basic entry is saved with `basicLand: true`, its requested printing and a reference card. No assignment is created, so owned basics stay available to every deck. The repository import check is unchanged and still validates every non-basic assignment.
- **Deck views**: `deckOwnership(deck, state)` reports `basic` separately from `missing`. `missingEntries` excludes basics. Rows carry `basicLand`; the owned/missing filter treats basics as not missing. Card Detail shows "Physical assignment: Not tracked (basic land)". Deck size, type counts, mana statistics and Deck DNA still include basics.
- **Add Cards** on a decklist deck: a basic grows its entry (or creates one with the chosen printing) without consuming a copy or checking availability. Decks created with New Deck (no decklist) keep v0.4.0 allocation.
- **Unchanged**: nonbasic lands and all other cards. "Owned but fully assigned", review choices, forged-pick refusal and no taking copies from other decks.
- **Existing data**: decks imported before v0.6.4 keep any real basic-land assignments they already have. Their unassigned basic remainder is now shown as "not tracked" instead of missing, detected from metadata.

## Tests

- `tests/unit/basicLands.test.ts` (7): detection; A — the same printing already fully assigned elsewhere imports without conflict and consumes nothing; B — a different printing is kept with no choice; C — 12 Islands with 3 owned has no shortage, counts as land; D/E — Snow-Covered Mountain and Wastes; F/G — Command Tower and Sol Ring keep strict allocation and refuse forged picks; editor add of basics doesn't consume.
- Updated `tests/unit/deckImport.test.ts` to use Command Tower (nonbasic) as the multi-printing example. Updated deck browser expectations (`deckImport.spec.ts`, `deckNavigation.spec.ts`) for basic Forests.

## Validation results

**Passed:** lint; **401 unit tests** (394 + 7); production build; `TEST_PRODUCTION=1 npm test`: **335 browser tests** across 360×800, 390×844, 430×932, 768×1024 and 1440×1000 (13.0 min); `npm audit`: 0 vulnerabilities; `git diff --check`.
