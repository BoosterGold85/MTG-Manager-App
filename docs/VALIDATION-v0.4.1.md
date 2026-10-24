# v0.4.1 — ManaBox Deck Import

Baseline: `4505d0a` (v0.4.0 Commander Library, now **Approved**). v0.4.1 is **Current**. No Deck DNA or other v0.5.0 work.

## Architecture

- `src/decks/deckText.ts`: ManaBox/MTGA text parser producing card lines, retained issues, optional deck name and explicit commander flags.
- `src/decks/deckImport.ts`: resolution (offline metadata → Scryfall `set`+`collector_number` → Scryfall `name`), preview/ownership reconciliation, choices, summary, blocking checks and finalization into a `Deck`.
- `src/decks/prepareDeckImport.ts`: read-only orchestration. `src/import/scryfall.ts` gains `lookupDeckCards` on the existing client: same pacing, retry/backoff, canonical cache checkpoints and session reuse. Incomplete or failed batches raise `LookupInterrupted`. Only an explicit `not_found` makes a row "not recognized".
- `src/storage/deckRepository.ts`: new `import` and `remove-missing` actions. `add`/`remove` keep entries in sync for entry decks. Import re-checks availability, legality and name conflicts against the current saved state, all inside the existing single revision-checked transaction.
- `src/components/DeckImport.tsx`: source (file/paste) → lookup → preview → confirm. `DeckLibrary` shows owned/assigned/missing, Missing / Unassigned and retained rows.

## Schema (additive, `schemaVersion` 1 unchanged)

- `Deck.entries?: DecklistEntry[]`: `{ id, board: "commander"|"main", quantity, name, cardIdentity, scryfallId, requestedPrinting?, sourceLines? }`.
- `DeckCardAssignment.entryId?`: links physical copies to the entry they fulfil. Uniqueness is per `(itemId, entryId)`.
- `DeckCommander.itemId?` (absent when no copy is assigned) and `entryId?`.
- `Deck.importIssues?` and `Deck.source?`.
- Validation: entries must reference stored metadata; links must resolve; assigned copies per entry must not exceed its quantity. Legacy v0.4.0 decks (no `entries`) validate and behave exactly as before.
- Metadata for unowned decklist cards is added only where absent. Collection clear retains metadata referenced by decks.

## Tests

New unit tests (`tests/unit/deckImport.test.ts`, 18): parsing; name-only; set+collector; printing fallback/conflict; commander detection, ineligible, two and three commanders; exact/alternate/allocated/missing/ambiguous classification and summary; over-availability refusal; confirmed import with missing cards and reload; unchanged quantities/source rows/metadata; no copy moved from another deck, including a forged assignment refused at the repository; duplicate name never overwritten; color identity conflicts; editor fill/remove-missing/release; unowned commander and collection clear; collection re-import preserves entries; validation of entry links; Scryfall batching/not_found/cache; and an interruption without problem rows.

New browser workflows (`tests/browser/deckImport.spec.ts`, 2 × 5 sizes): a paste import with required commander selection, summary, color conflict, problem row, Axe/overflow checks, reload and Collection Deck Usage; and a ManaBox file upload with a Commander section, printing choice, duplicate name → Import as new deck, and no copy reuse.

## Validation results

**Passed:** `npm run lint`; **226 unit tests** (208 preserved + 18 new); `npm run build`; `TEST_PRODUCTION=1 npm test`: **240 browser tests** across 360×800, 390×844, 430×932, 768×1024 and 1440×1000 (230 preserved + 10 new, 7.2 min); `npm audit`: **0 vulnerabilities**; `git diff --check`. The v0.4.0 allocation, v0.3.2 intelligence/search/keyword and v0.3.1 interrupted-import suites ran unchanged, apart from the backup version string `0.4.0` → `0.4.1`.

## Known limitations

- The ManaBox export's exact section headings are not officially documented. The parser accepts common variants. Sideboard/maybeboard/companion rows are retained as not-imported rows, not stored as boards.
- Partner/Background legality, singleton, banned list and other format rules are not validated. Color identity remains the only enforced boundary.
- No re-sync of an existing deck from a later export. Same-name imports create a separate deck.
- Copy selection is per printing group (quantity), not per serialized physical card. A name-only row with several owned printing groups requires a choice even when any copy would do.
- Name matching uses canonical names/face names/aliases. A deck needs network access for cards absent from saved/bundled metadata.
- Cloudflare deployment is not verifiable from this environment.
