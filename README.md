# MTG Manager · v0.2.1

A mobile-first, artwork-forward Magic binder with a preview-first **ManaBox CSV import**. The approved v0.1.1 binder, filters (including Commander Colors), sorting, card details and responsive layouts remain the foundation. Until the first confirmed import, the app shows the original clearly marked 32-card sample binder. Sample quantities are never mixed into your collection.

## Manage your local collection

Use **Select** to toggle records with a tap or keyboard. Selections use stable inventory IDs and survive search, filtering, sorting and loading more cards. **Select all** adds every current search/filter result, including unrendered records; changing results never silently changes your selection. Hidden selections count too. Clear selection or Cancel to reset them.

**Remove** requires confirmation and removes entire selected inventory records, including all their physical copies. Card Detail also offers **Remove from Collection**. Your ManaBox collection and original CSV files are unaffected. A later confirmed ManaBox export containing a locally removed record may recreate it; there are no tombstones or suppression rules. Untouched records retain the existing absolute-quantity synchronization behavior.

**Manage Collection** shows stored unique records (including zero-quantity records), owned/assigned/unassigned copies, the most recent successful import and local storage status. **Export Backup** downloads `mtg-manager-backup-YYYY-MM-DD.json` with version, timestamp, inventory, canonical metadata and provenance. The backup reflects persisted data, not sample cards. It can contain original purchase/binder information: keep it private. Backup restore is not implemented in this release.

**Clear Collection** displays the full stored scope and requires typing `CLEAR` before confirmation. It atomically empties records, canonical caches, import history and unresolved rows, resets selection/search/filters and saves an empty binder across reload. It does not return to sample data. Removal and clear use the existing revision-checked repository; failed writes leave cards and selection intact and offer retry. If another tab changed the collection, reload before retrying.

Data is stored only in this browser on this device, with no server backup, accounts or cloud sync. Keep your original ManaBox exports and download local backups. Browser data clearing or switching origins/devices does not preserve local storage.

## Develop

Use Node.js 24 (pinned in `.node-version`) and npm. Node.js 22.12+ is also supported.

```sh
npm ci
npm run dev
```

Vite listens on port 5173. No credentials, environment variables, backend or accounts are required. Uncached printing enrichment during import needs Internet access to `api.scryfall.com`. Imported artwork is served by `cards.scryfall.io`. Browsing reads saved metadata locally and never queries the card API per tile or render. Sample artwork and fonts remain bundled locally.

## Import a ManaBox collection

1. Export your collection as CSV from ManaBox. Keep your original exports as your backup.
2. Choose **Import Collection** in the collection toolbar, then **Choose CSV file**.
3. Review recognized rows, new/updated/unchanged inventory records, combined duplicate rows, and problem rows. No inventory is changed during parsing or preview.
4. Confirm the import. Successful records, metadata and unresolved source rows are saved in one transaction.
5. Return to the same binder. An import with some unresolved rows reports partial success. Open Import Collection later to review/download the saved unresolved rows as JSON.

Problem rows are never silently dropped. Their original fields and a correction message are retained. You can inspect original source fields (including purchase data) in a card detail's collapsed **Original import fields** section. This is imported provenance, not card pricing or analysis.

### Matching rules

Matching uses these strict priorities:

1. **Scryfall ID**, when supplied. An invalid/unknown ID is an error; it is not silently replaced with a name-based guess.
2. **Set code + collector number**, when no ID is present.
3. **Exact normalized name + printing information**. A name with a set code or exact set name is searched against Scryfall's printing list. It must identify exactly one printing. An incomplete local cache is never treated as evidence of uniqueness. Alternate printings require a collector number or ID.

Conflicting supplied names/set codes/collector numbers are flagged for correction. Name normalization trims and collapses whitespace, normalizes Unicode and apostrophes, and ignores case; it does not use fuzzy matching. `colorIdentity` comes from Scryfall `color_identity`, never the visual `colors` property.

Unknown matches, ambiguous printings and temporary network failures remain reviewable. Retrying a corrected export replaces issues for the same source identity. Older issues from source identities not included in the new export are retained.

### CSV fields and defaults

Recognizes ManaBox headers such as `Name`, `Set code`, `Set name`, `Collector number`, `Quantity`, `Foil`, `Scryfall ID`, `Language`, `Condition`, `Binder Name` and `Binder Type`. Common casing, spacing and underscore variations are accepted, as are `Finish`, `Card name`, `Count`, and list/binder aliases. All original columns—including purchase price/currency, ManaBox IDs, notes, altered/misprint flags and unfamiliar optional columns—are retained verbatim per source row.

- UTF-8/BOM, CRLF, quoted commas, escaped quotes and multiline fields are supported. Delimiters are detected by Papa Parse.
- Missing optional finish/language/condition/binder values default to nonfoil / English (`en`) / unspecified / no binder. Original values remain preserved.
- A missing Quantity column defaults to one per row with an explicit preview warning. An empty or malformed value in an existing Quantity column is a problem, not an assumed quantity.
- `normal`, `nonfoil`, `false` and `no` mean nonfoil; `foil`, `true` and `yes` mean foil; `etched` / `etched foil` mean etched. Unknown finishes are flagged. Finish variants remain distinct records.
- Duplicate headings and competing field aliases are rejected rather than silently overwriting a column.
- Limits: 50 MB / 100,000 rows per file; each quantity must be an integer between 0 and 1,000,000,000. Larger exports should be split while keeping each variant's rows together.

### Deterministic re-import contract

This release performs a **non-destructive upsert**, not an additive import or a destructive mirror:

- Inventory identity is `(set code, collector number, finish, language, condition, binder type, binder/list name)`, based on the resolved printing. Filename and row order are not identity. Scryfall IDs remain the preferred match identifier and are stored canonically; using set/number later does not add another copy of the same record.
- Multiple rows for that same identity **sum within this export**. The preview labels the extra rows as combined duplicates. Identical repeated rows also contribute their exported quantities; they are not discarded because they may represent separate physical copies/lots.
- If one row in a recognized printing/variant group is problematic, that entire group is held for correction and its saved total stays unchanged. A partial success cannot replace a known holding with only the good half of a broken duplicate group.
- That sum **replaces** the saved quantity for that identity. A later export of 2 Sol Rings updates a saved quantity of 1 to 2. It does not add 2 more. Re-importing an identical file leaves inventory and source rows unchanged; only the last-import summary/revision is refreshed.
- Different printings, foil/nonfoil/etched finishes, languages, conditions or binder locations stay separate. Purchase changes update the same record and retain all source lots.
- Records absent from an export are kept. Moving/renaming a binder, or changing a condition/language/finish, changes the identity; this release does not infer a physical move or delete the old record. Use zero quantities for known records you want hidden. Split exports must not independently overlap the same identity: the last confirmed total for it wins.
- A zero quantity is stored and hidden from the binder, rather than deleting provenance.
- Imported records start with `quantityAssigned = 0`, `quantityUnassigned = quantityOwned`. No deck assignments are created—even if ManaBox labels a list as a deck. The model preserves future assigned counts and rejects imports below an assigned quantity.

New/updated/unchanged counts refer to grouped records; recognized/problem/duplicate counts refer to source rows. These units are labeled separately in the preview.

## Persistence and privacy

The simplest static-Cloudflare-compatible beta solution is **IndexedDB**, behind `CollectionRepository`. The versioned snapshot stores ownership records, normalized card metadata, proven name-match resolutions, unresolved rows and the latest import summary. Writes are atomic; stale previews from another tab are rejected using a revision check. Storage failures keep the previous collection intact and allow retry. Unsupported/corrupt snapshots produce an error instead of being overwritten. The app makes a best-effort browser persistence request after a successful save.

Data belongs to this **browser profile and site origin**. It is not synced between devices, Cloudflare preview URLs or domains. Clearing site data, private browsing, browser eviction or changing origins can remove local data. No server backup or account recovery is claimed. Keep the ManaBox export as the authoritative backup. No CSV contents or purchase/binder fields are sent to a server; Scryfall receives only matching identifiers/names and set information.

Parsing runs in a Web Worker. Large binders initially render 120 records, with a Show more cards action; searching, filtering and sorting always operate on the complete saved collection. This keeps first render bounded without changing the frozen card grid. Scryfall ID/set-number requests are deduplicated and batched up to 75 identifiers, paced sequentially at least 120 ms apart. Successful canonical metadata and unique name resolutions persist on confirmation. Opening the binder, filtering, sorting, opening details and re-importing already cached identifiers require no card API calls. Remote artwork still needs network/cache availability; missing art retains the named fallback.

`src/models/collection.ts` separates physical ownership from `CardMetadata`. `collectionCards()` adapts persisted inventory to the frozen binder's existing card interface. A future authenticated provider can replace the repository without replacing the binder UI. No accounts, automated tags, deck management or v0.3.0 capabilities are implemented.

## Validate

```sh
npm run lint
npm run test:unit
npm run build
TEST_PRODUCTION=1 npm test
npm audit
git diff --check
```

`npm test` runs the same browser suite against a Vite development server. `TEST_PRODUCTION=1` requires an existing production build and uses preview instead. Playwright manages port 4173; set `CI=1` to require a fresh server. Browser tests use `/usr/bin/chromium` in this cloud environment; elsewhere set `CHROMIUM_PATH` to a compatible Chromium executable.

The complete frozen v0.1.1 suite is retained unchanged. Added coverage includes valid/malformed/minimal ManaBox CSV, duplicates, repeated imports, changed totals, foil/nonfoil, different printings, missing IDs, ambiguous/unknown/conflicting metadata, purchase fields, storage/revision failures, ownership invariants, 10,000 parsed rows, 1,000 distinct batched printings, 5,000-row browser imports, imported filters and Commander Colors. Browser tests run at 360×800, 390×844, 430×932, 768×1024 and 1440×1000, with axe checks on the binder and import states.

Deterministic browser tests intercept remote metadata for the external-enrichment case; known printings use the bundled canonical cache. They do not depend on Scryfall availability. See [v0.2.0 validation](docs/VALIDATION-v0.2.0.md) for the separate live-API check and its cloud-browser transport limitation. Reports and screenshots are generated under ignored `playwright-report/` and `test-results/`.

Management adds stable-ID selection, filtered select all beyond rendered tiles, confirmed atomic deletion/clear, JSON backups, re-import and write-failure regression coverage. See [v0.2.1 validation](docs/VALIDATION-v0.2.1.md) for all 72 unit and 140 browser results, responsive review and release limitations.

## Deploy to Cloudflare Pages

The repository uses a static Vite build; no Cloudflare infrastructure, functions, database bindings or secrets are added:

- Build command: `npm run build`
- Build output: `dist`
- Root: repository root
- Node.js: 24 (pinned), or compatible 22.12+
- Environment variables / bindings: none

Push the chosen production branch to the connected GitHub repository. A configured Cloudflare Pages Git integration can build automatically. Local production validation is not proof of a Cloudflare deployment; deployment status is reported separately. `npm run preview` serves a local production check.

## Binder behavior preserved

- Immediate case-insensitive name search, combined normal color/type/mana/rarity/set/finish filters and four sort modes.
- **Commander Colors** remains independent: a card matches only if every Scryfall identity color is included in the selected Commander identity. All 32 identities are available; colorless cards match every identity. This is color-identity compatibility, not every format legality rule.
- Drawer edits apply only on confirmation; cancel discards them; clear/reset remains one action.
- Native card dialog focus, keyboard/backdrop/browser-back dismissal, reduced motion, safe-area padding and responsive 2/4/6-column layouts remain intact.
- Imported cards have no generated sample tags. Card Intelligence stays a restrained future preview.

## Sample assets

`src/data/sampleCards.json`, `public/cards/` and `sampleCollectionSource` remain a demo and a small canonical metadata cache, never real ownership. Optional maintainer refresh (not startup/build):

```sh
python3 scripts/fetch-sample-data.py
```

Magic card images/text are © Wizards of the Coast. Metadata and image references are provided by [Scryfall](https://scryfall.com). This project is unofficial and not endorsed by Wizards or Scryfall. Font/icon licenses are in `public/licenses/`.

See [CHANGELOG.md](CHANGELOG.md), [ROADMAP.md](ROADMAP.md), the original [v0.1.0 brief](docs/v0.1.0-executable.md), and [historical foundation validation](docs/VALIDATION.md). Stop at v0.2.0; intelligence and Commander management remain later roadmap layers.
