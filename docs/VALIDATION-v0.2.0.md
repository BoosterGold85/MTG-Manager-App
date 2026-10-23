# v0.2.0 validation — Real Collection Foundation

## Scope and implementation

The v0.1.1 binder is frozen. Its original browser and unit test files are unchanged. This release adds a Collection import action, premium upload/preview/progress/result dialog, strict ManaBox parsing and matching, deterministic absolute-quantity upserts, original-row provenance, physical ownership fields, and browser-local persistence. No v0.3.0 work or Commander deck/account/intelligence features are included.

IndexedDB was chosen because the existing app is a static Cloudflare-compatible Vite site with no backend or authentication. `CollectionRepository` is the replaceable access boundary. Inventory, normalized metadata, unique-name resolutions and unresolved rows are committed atomically, with stale-preview revision checks. Demo data is only an unowned fallback before the first import.

## Commands and results

| Command                      | Result                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `npm run lint`               | Passed.                                                                          |
| `npm run test:unit`          | 67 tests passed: original 23 + 44 import/data/persistence tests.                 |
| `npm run build`              | Passed TypeScript and optimized production build.                                |
| `TEST_PRODUCTION=1 npm test` | 110 browser cases passed: the frozen 60 + 50 import cases across five viewports. |
| `npm audit`                  | Zero vulnerabilities, including development dependencies.                        |
| `git diff --check`           | Passed before commit.                                                            |

The frozen suite covers search, all existing filters and Commander Colors, sorting, reset, responsive density, modal focus/closing/browser back, skeletons, empty states, broken artwork and accessibility. The source test files `tests/browser/binder.spec.ts` and `tests/unit/collection.test.tsx` were preserved unchanged.

New unit cases cover valid BOM/CRLF/quoted/multiline CSV, missing optional fields/defaults, malformed and conflicting headers, invalid quantities/finishes, raw purchase fields, duplicate aggregation, identical re-import, 1→2 quantity updates, foil/nonfoil/etched separation, two printings, languages/conditions/binders, zero quantities, ownership/assignment invariants, retained problems and correction, protection against an incomplete duplicate-group total, matching precedence/conflicts, ambiguous name printing searches, unique-name cache proofs, set-name lookup, unknown/network errors, cancellation, double-faced metadata, actual `color_identity`, IndexedDB reopening/atomicity/stale previews, and imported filters/sorting.

Stress checks: 10,000 parsed/aggregated source rows and stable re-import; 1,000 distinct uncached printings resolved in 14 requests of at most 75 identifiers; row-limit rejection above 100,000. Browser checks import 5,000 rows and reload the saved quantity. A separate browser check saves 1,000 distinct inventory records, verifies bounded 120-record first render and 240-record expansion, and searches the entire collection rather than only rendered tiles.

The ten new browser scenarios run at **360×800, 390×844, 430×932, 768×1024 and 1440×1000**. They exercise the actual native file input, real CSV worker, preview, explicit confirmation, IndexedDB, binder, reload, unchanged/updated re-import, partial success, problem download/review, storage failure/retry, enrichment cache, imported normal filters and Commander Colors. Axe scans cover upload, preview and success in addition to the frozen binder scans. Screenshots were reviewed for mobile upload/preview/success and desktop layouts. Headless Chromium emulation is not a claim of physical iPhone Safari validation.

## Separate live Scryfall check

A separate Playwright session exercised a real ManaBox-format export for **Opt (Dominaria #60)**, a printing outside the bundled sample cache:

1. Selected CSV → real API matching → recognized preview → confirmed import.
2. Real card artwork loaded with a nonzero natural width.
3. Reload restored the saved collection from IndexedDB.
4. A later export changed owned quantity from 1 to 2 without another record.
5. Importing that identical export again retained exactly one record with two copies.
6. One metadata API request total; no page errors. Canonical metadata came from the live Scryfall response, not a test fixture.

Cloud Chromium cannot directly verify this environment proxy's certificate. Automatic approval review rejected installing the proxy CA into Chromium's persistent trust store because that would affect all browser HTTPS traffic. That change was not pursued. Instead, this live check forwarded only the two public Scryfall API/artwork hosts through the environment's existing TLS-verified `curl` transport. No certificate checks were disabled, browser trust was not changed, and all returned metadata/artwork was live. This is a validation-only adapter, not shipped application code. Direct browser-to-Scryfall access from a deployed origin remains unverified here; Scryfall's real HTTP response confirmed public CORS support for GET/POST/OPTIONS.

The deterministic automated enrichment case uses a captured metadata fixture and explicit request interception. Its purpose is repeatable cache/flow assertions, not a claim of external service availability.

## Sync contract and beta limitations

- Identity is the resolved printing's set + collector number, finish, language, condition and binder/list location. Duplicate rows sum inside one export; the grouped sum replaces saved totals. Filename and row order do not create new inventory records.
- A group containing a recognized problematic duplicate row is held for correction; its previous total is retained rather than replaced by the valid subset.
- Re-import is a non-destructive upsert. Omitted records stay; source moves/renames/condition/finish/language changes are not inferred. Zero quantities hide a known record. Overlapping split files use the last confirmed total for the shared identity. These rules are stated before confirmation and in README.
- All original fields and problem rows are retained. A preview is not a save. Only confirmed writes change inventory; failures leave it intact.
- Storage is local to the browser profile and origin, with no cross-device sync, server backup or account recovery. Clearing/evicting site storage can remove it. Keep original ManaBox exports.
- Imported artwork remains remote; offline artwork is not guaranteed. Normal browsing uses cached canonical metadata and no card API requests.
- Limits are 50 MB / 100,000 rows per export. A binder initially renders 120 records and offers Show more; search/filter/sort operate on the full collection.

## Files

- `src/import/`: parser, worker bridge, canonical Scryfall resolver/cache, pure synchronization plan and preview orchestration.
- `src/workers/csv.worker.ts`: off-main-thread parsing.
- `src/storage/collectionRepository.ts`: versioned IndexedDB access, atomic save, revision/storage safeguards.
- `src/models/collection.ts`, `src/models/card.ts`: canonical metadata, ownership, import state/provenance and frozen-UI adapter.
- `src/components/ImportCollection.tsx`: premium import states, preview and problem review/download.
- `src/app/App.tsx`: persisted collection loading, import action, demo separation and return to binder.
- `CardDetail`, `CardImage`, `Dialog`, `CardGrid`, `app.css`: compact ownership provenance, absent-art handling, safe focus/commit behavior and progressive large-grid rendering within the existing design.
- `tests/unit/import.test.ts`, `tests/browser/import.spec.ts`, `tests/importFixtures.ts`, `tests/fixtures/scryfall-opt.json`: new deterministic tests and fixture data.
- Package/lock version, README, CHANGELOG and ROADMAP updated to v0.2.0. Existing frozen tests and sample source data remain intact.

## Deployment

The code is prepared for and pushed to GitHub `main`. No Cloudflare infrastructure or bindings were changed; the existing static Pages build settings remain `npm run build` → `dist`. This environment has no authenticated Cloudflare deployment tool or deployment status connection. A connected Git integration may deploy on push; a public Cloudflare deployment/URL has not been verified. Do not confuse local production validation or GitHub push success with a confirmed deployment.

Stop at v0.2.0. No v0.3.0 features are implemented.
