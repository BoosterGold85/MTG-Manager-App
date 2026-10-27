# v0.6.7 — Deck Workspace UX & Actionability

Baseline: v0.6.6 at `09b82e3` (approved). This is a UX and actionability pass. The recommendation engine was not rebuilt and its scores did not change.

## Engine preservation

- `tests/golden/upgrades-v0.6.6.json` was captured from the v0.6.6 engine before any UI change. It covers the Reign of Dragons deck with every regression candidate and the eight cross-archetype decks: candidate identities, order, Commander Fit and label, Build Priority and label, confidence, Upgrade Value, label, best cut and alternatives.
- `tests/unit/upgradesGolden.test.ts` asserts that output is byte-identical. It passed after every pass.
- New read-only helpers in `src/upgrades/index.ts` reuse the existing functions:
  - `candidateGroups`: the memoized `ownedCandidateGroups`.
  - `buildFor`: `evaluateForBuild` with the same blueprint.
  - `deckHealth`: reads `currentDeckModel` totals and blueprint targets.
- `buildAroundCommander`, `commanderBlueprint`, `improveCurrentDeck`, `upgradeFor` and `compareSwap` are unchanged.

## Workspace

- The route gains `tab` (`overview` by default and omitted from the URL, plus `cards`, `upgrades`, `settings`). Unknown values fall back to Overview. Opening another deck starts on Overview; Back and Forward restore the section.
- Components:
  - `DeckLibrary`: shell, shared state, the single write path and Card Detail.
  - `DeckHeader`, `DeckOverview`, `DeckCards` (including the Add Card dialog), `DeckUpgrades` (including Saved), `SwapReview`, `DeckSettings`.
  - `src/decks/workspace.ts`: tab ids and color-identity names.
- `SynergyExplorer` and `DeckDnaPanel` were removed. Their content moved into Upgrades and Overview; the DNA methodology is now collapsed under "How this analysis was calculated".

## Data model and repository

- `Deck.savedCandidates?: SavedDeckCandidate[]`. Each entry stores id, intent, candidate identity and name, preferred copy, suggested cut and timestamp, never scores. Decks saved before 0.6.7 have no field and behave as `[]`. Collection validation rejects malformed entries.
- New `DeckChange` actions: `save-candidate` (saving again de-duplicates per intent), `remove-saved` and `swap`.
- `swap` runs in one repository transaction and commits one revision:
  - It validates the current state: deck exists, the card going out is in the main deck and is not the Commander, the copy coming in exists, is legal and deck-playable, and is unassigned.
  - It then removes one copy of the outgoing card and adds the incoming copy through the same helpers `add` and `remove` use (`addOne` and `removeOne`).
  - Entry decks update the decklist and its assignments together. Assignment-only decks swap one assignment.
  - Missing and basic outgoing copies release nothing. Basic lands coming in reserve nothing.
  - Any failure, including a stale revision, writes nothing.

## Tests

- Unit:
  - `tests/unit/swap.test.ts` (8): atomic entry-deck swap with exactly one revision and ownership unchanged; missing outgoing card; basic land out and in; no copy taken from another deck with no write; stale base rejected; invalid outgoing, self-swap and Commander; legacy decks without entries; saved-candidate persistence, de-duplication and removal on swap.
  - Deck Health uses the same counts and targets as the upgrade engine (`tests/unit/upgrades.test.ts`).
  - The golden engine-output test.
- Browser:
  - `tests/browser/workspace.spec.ts`: routing (default, refresh, Back/Forward, invalid tab, clean header); Axe on Overview, Cards, the Filters sheet, the goal chooser, Build results, Improve results, Review Swap, Saved and Settings; phone tasks A–F with a readable summary, 44px targets and a two-tap swap.
  - `recommendation.spec.ts`: Improve ranking and disclosure; Review Swap with best, manual and invalid cuts; atomic Confirm Swap; Save Upgrade persistence with a recalculated grade; a stale or unavailable copy rejected with no write; no copy taken from another deck; low confidence, detail scores and Evaluate as Upgrade.
  - `synergy.spec.ts`: Upgrades as a section with history; Build-mode Add to Deck exactly once; Save Candidate with build intent after reload.
  - Existing deck specs migrated to the sections: `decks`, `deckDna`, `deckImport`, `deckNavigation`, `strategy`, `storageRecovery`.

## Known limitations

- Changing a deck's Commander and updating an existing deck from a new list are not supported. Settings says so instead of faking it.
- Add Card closes after each successful add, so adding several copies means reopening it.
- The physical iPhone smoke test (`docs/IPHONE-SMOKE-CHECKLIST.md`) has to be run by hand on a device. It was not run in this environment; Chromium emulation at 360, 390 and 430px covers the responsive checks.
