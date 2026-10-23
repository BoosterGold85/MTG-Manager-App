# v0.2.1 — Collection Management & Multi-Select

Implemented against the supplied `MTG_Manager_v0.2.1_Collection_Management_Executable.md`, on approved v0.2.0 commit `a6ed12a`. No v0.3.0 capabilities were added.

## Behavior and persistence

- Select is available for persisted owned cards, not unowned sample data. Tiles become keyboard/touch toggle buttons with `aria-pressed`; artwork remains visible. A sticky action bar shows the total selection, including hidden records.
- Selection uses inventory IDs. Search, normal filters, Commander Colors, sorting and progressive rendering do not alter it. Select all unions every current matching record, including unrendered results. Cancel clears selection.
- Bulk and detail removal share `changeCollection`, which writes a new snapshot through `CollectionRepository.save`. Only selected inventory records are removed; unrelated records, canonical caches and existing import history/problems remain unchanged. Removed IDs are pruned from selection only after successful persistence.
- Clear displays stored record/copy totals and requires typed `CLEAR`. It saves an empty snapshot with incremented revision, clearing metadata, name resolutions, import history and unresolved rows. Search/filters/selection reset. Reload retains the empty binder rather than falling back to samples.
- Existing IndexedDB transactions and optimistic revision checks remain the atomic persistence boundary. Failed writes preserve cards, totals and selections, show a recoverable error and permit retry. Another-tab conflicts require reload. No schema migration or server storage was introduced.
- Local deletion never modifies ManaBox or its CSV files. A later confirmed export may recreate deleted records. Untouched records retain absolute-quantity upsert behavior. There are no tombstones.
- Manage Collection counts all stored records (including zero-quantity records), sums physical/assigned/unassigned quantities, shows the last successful import timestamp/filename and browser-local storage guidance.
- JSON backups read the current persisted snapshot, include application/schema version and export timestamp, inventory IDs/quantities, canonical metadata and original provenance. Samples are never exported as owned inventory. Cached metadata can include previously removed printings; inventory reflects only current records. No IndexedDB database/store/key configuration is exported. Backup restore is intentionally outside scope.

## Validation

Commands executed:

```sh
npm run lint
npm run test:unit
npm run build
TEST_PRODUCTION=1 npm test
npm audit --cache /workspace/.npm-cache
git diff --check
```

- Lint: passed.
- Unit: **72 passed** (67 preserved + 5 management tests).
- Full production browser suite: **140 passed**, no skipped tests (110 preserved + 30 management cases across five viewports).
- Production TypeScript/Vite build: passed.
- Dependency audit: **0 vulnerabilities**; no dependencies added.
- Whitespace check: passed.
- Following visual review, the mobile management sheet was adjusted to full width and ID pruning made linear. Lint, all 72 unit tests and production build were rerun, with the 30 affected management browser cases rerun at all five viewports.

New unit checks cover targeted removal, unrelated records, repository recreation, accurate quantities/statistics, backup metadata/content, empty snapshots, full clear of import/problem state, stale revisions, failed reads/writes and non-mutation of caller state.

New browser checks exercise actual CSV upload/preview/commit, single/multiple selection and deselection, cancel/clear selection, hidden selection, sorting, searched/normal/Commander-filtered select all, 328 selected records beyond the first 120 tiles, progressive rendering, cancel/remove/detail removal, owned totals, unchanged unrelated records, reload persistence, removal followed by repeated re-import, downloaded backup contents after deletion/clear, typed clear confirmation, no stale selection, and injected quota failures followed by retry. Axe checks cover Select mode, removal confirmation, Manage Collection and clear confirmation. Keyboard selection, Escape and confirmation focus wrapping are exercised.

## Viewport and visual review

Browser workflows run at 360×800, 390×844, 430×932, 768×1024 and 1440×1000. Screenshots of selection, removal, management and clear were inspected at each size. Follow-up screenshots also cover larger selected counts, empty state after clear and reload. Artwork, readable confirmation scope, separated destructive controls and compact selection action bar are retained. The mobile sheet uses existing bottom-sheet positioning, full width and safe-area bottom padding; the action bar sits above bottom navigation with extra page space so records remain reachable.

Physical-phone hardware testing was not available; Chromium mobile emulation is the mobile evidence. Native mobile Safari behavior and OS download handling are not claimed verified. Existing reduced-motion rules remain in force.

## Files changed

- `src/app/App.tsx`: overlay/state orchestration, management entry points, selection bar, version.
- `src/components/CardGrid.tsx`: selected styling, accessible selection toggles.
- `src/components/CardDetail.tsx`: secondary removal entry point.
- `src/components/ManageCollection.tsx`: statistics, import information, backup/error handling and clear entry.
- `src/components/ConfirmCollectionChange.tsx`: explicit destructive confirmation, typed full clear, write failure/retry.
- `src/storage/collectionManagement.ts`: statistics, shared repository-backed mutations and backup serialization.
- `src/storage/collectionRepository.ts`: revision-error wording now applies to management as well as imports; transaction behavior unchanged.
- `src/styles/app.css`: management dialogs, selection states/bar and responsive/safe-area styles.
- `tests/unit/management.test.ts`, `tests/browser/management.spec.ts`: new regression coverage. Original suites unchanged.
- `package.json`, `package-lock.json`: version 0.2.1 only.
- `README.md`, `CHANGELOG.md`, `ROADMAP.md`, this document: behavior, release and validation documentation.

## Deployment and limitations

The existing Cloudflare static build remains `npm run build` → `dist`; no infrastructure changes. GitHub `main` is the authorized publication target. No Cloudflare connector, Wrangler CLI, configured deployment URL or Cloudflare credential variables were available, so public deployment cannot be verified here. A configured Git integration may deploy after push; push success does not establish deployment success.

Data remains local to this browser profile/origin. No accounts, cloud sync, server recovery or backup restore. Clear is intentionally irreversible within this UI; original ManaBox exports and JSON downloads remain the user's backups. Browsing/import architecture, filters and Commander Colors are preserved. No deviations from executable scope; physical-phone and public-deployment verification limitations are disclosed above.
