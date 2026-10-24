# v0.4.0 — Commander Library

Baseline: `ecdb89c` (approved v0.3.2 plus visual identity formalization). Scope: the user's supplied [Commander Library executable](v0.4.0-executable.md). v0.3.2 is Approved; v0.4.0 is Current. No v0.5.0 work.

## Architecture and invariants

- `src/models/deck.ts`: Deck, array of DeckCommander references, printing-group DeckCardAssignment relationships. Canonical identity, Scryfall ID, selected inventory ID, commander name/identity are retained. Full card metadata is not copied into each deck.
- `src/storage/deckRepository.ts`: DeckRepository boundary; LocalDeckRepository commits decks and physical totals through CollectionRepository's existing optimistic revision check and single IndexedDB transaction. No separate storage write can leave partially assigned copies. Failures/stale tabs preserve persisted data and show errors.
- `src/decks/decks.ts`: canonical commander eligibility, color subset boundary, derived usage/counts/conflicts/basic composition. Commander reservations count as assigned copies. One commander is selected in the current UI; the model supports multiple references without implementing Partner rules.
- Additions require an existing owned printing, compatible canonical identity and available physical copy. Removal releases one deck card; deletion releases the entire deck after confirmation. Collection IDs and metadata/source rows remain intact.
- Existing importer matching, caching, service-error recovery, worker intelligence/ruleset and manual override paths remain unchanged. Import plans retain `decks` and assigned counts. Quantity shortages preserve references, clamp availability to zero and produce preview/UI warnings. Omitted CSV records retain the approved upsert behavior. The legacy no-decks invariant still refuses unexplained assigned counts below ownership.
- Allocated record removal/full collection clear is refused with release instructions, preventing dangling references. No automatic transfer, deletion, proxy, wishlist or inferred reconciliation is introduced.
- Backups keep the existing outer fields and `collection` snapshot; `collection.decks` contains all deck/commander/assignment references. Printing details remain on referenced collection items. No restore implementation.

## UI and responsive coverage

Primary navigation is Decks in both desktop and mobile navigation. The library uses commander art, editorial headings, existing palette tokens and restrained metadata. Name and commander selection, editor, Add Cards, allocation dialog and explicit deletion all reuse the existing native dialog/focus primitives. Add Cards uses CardGrid and FilterDrawer with Name/Oracle/All, tags, Keywords, colors, types and mana filters, permanently bounded by deck identity. Exhausted copies identify using decks. Collection Card Detail adds a small Deck Usage section below Card Intelligence.

Production browser flows run at 360×800, 390×844, 430×932, 768×1024 and 1440×1000. New flows capture assignment/editor/exhaustion/conflict screenshots, check overflow and Axe accessibility on the empty library, Add Cards, allocation dialog and populated editor. Existing binder/import/management/intelligence/brand browser coverage remains present; only the obsolete future-Commanders navigation assertion is updated to the working Decks empty state while preserving binder-search state assertions.

## Deterministic test coverage

12 new unit tests cover create/canonical commander selection, metadata-based eligibility, color identity, multi-deck copies, exhaustion/no transfer, release/delete ownership preservation, distinct printing/finish/language/condition, normal/identical/reduced/zero-quantity re-imports, conflicts/recovery, backup, collection removal guards, rename, storage/stale-write protection, reference/count validation, basic stats and imported filters.

Three new browser workflows run in all five projects (15 cases): actual ManaBox upload → create → commander → filtered add → reload → Collection Deck Usage; two decks with exhausted copies and separate foil groups → release → rename → confirmed deletion; and actual reduced-quantity re-import → conflict → explicit release → full backup → reload.

The pre-existing 4,421-row interruption/resume/cache regression remains in the unit suite and the interrupted-import Retry unresolved flow remains in all five browser projects.

## Validation

**Passed:** lint; **208 unit tests**; **230 production browser tests** across the five approved sizes; TypeScript/Vite production build; dependency audit (**0 vulnerabilities**); whitespace checks. No skipped tests. Full browser run: **8.3 minutes**. This adds 12 unit cases and 15 browser cases to the preserved suite. The actual CSV import/re-import workflow is exercised, including a shortage after assignments exist. After formatting the new modules and rebuilding, all **15 Commander Library browser cases** passed again against the final production artifact (all five sizes); lint, 208 unit tests, build and audit were rechecked.

```sh
npm run lint
npm run test:unit
npm run build
TEST_PRODUCTION=1 npm test
npm audit --cache /workspace/.npm-cache
git diff --check
```

## Limits and deployment

Local browser/origin persistence only. One commander per deck in the UI. No full rules engine, banned list, singleton enforcement or advanced Partner validation; the editor warns explicitly. No commander replacement UI in this foundation (rename/add/remove/delete are supported); recreate a deck with a different commander after explicitly releasing copies. Average mana value excludes lands; multi-type cards contribute to each relevant type count. Color identity always uses canonical metadata, never visual colors or tags. Printing group assignments track quantities, not individually serialized physical cards. Changed binder/condition/variant fields remain distinct import records rather than guessed migrations.

No Deck DNA, recommendations, AI, history, accounts, sharing or sync. Existing manifest/icons remain unchanged. The validated release is pushed to GitHub `main`. No Cloudflare credentials or connected deployment tooling are available in this environment; GitHub commit-status API access also returned Forbidden. A configured Cloudflare Git integration may deploy the push, but its result is **unverified**. Local production validation is not proof of a Cloudflare deployment.


## Changed files

- Domain/storage: `src/models/deck.ts`, `src/models/collection.ts`, `src/decks/decks.ts`, `src/storage/deckRepository.ts`, `src/storage/collectionRepository.ts`, `src/storage/collectionManagement.ts`, `src/import/plan.ts`.
- UI: `src/app/App.tsx`, `src/components/DeckLibrary.tsx`, `src/components/CardDetail.tsx`, `src/components/CardGrid.tsx`, `src/styles/app.css`.
- Tests: `tests/unit/decks.test.ts`, `tests/browser/decks.spec.ts`, and the intentional navigation expectation update in `tests/browser/binder.spec.ts`.
- Release/docs: `package.json`, `package-lock.json`, `README.md`, `CHANGELOG.md`, `ROADMAP.md`, this report, and the supplied `docs/v0.4.0-executable.md`.

No material scope deviations. Single-commander UI and limited format validation are the executable's permitted foundation limits. Assigned-record removal guards are the necessary collection integration to prevent dangling deck references. No v0.5.0 features are included.
