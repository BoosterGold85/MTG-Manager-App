# MTG Manager · v0.4.0

A mobile-first, artwork-forward Magic binder with a preview-first **ManaBox CSV import**. The approved v0.1.1 binder, filters (including Commander Colors), sorting, card details and responsive layouts remain the foundation. Until the first confirmed import, the app shows the original clearly marked 32-card sample binder. Sample quantities are never mixed into your collection.

## Commander Library (v0.4.0)

Open **Decks → New Deck**, name it, then choose an owned commander. Candidates use canonical legendary-creature types or explicit “can be your commander” Oracle text, never strategic tags. The selected printing reserves one owned copy. Sample cards remain a demo and cannot be assigned.

The artwork-first library shows commander, identity, count, allocation status and last modified date. Open a deck to view its Commander and Deck sections, add/remove owned copies, rename it or explicitly confirm deletion. Basic composition is secondary and collapsed by default; average mana value excludes lands. The commander list is modeled as an array for future multiple-commander support, but this release creates one commander per deck.

**Add Cards** reuses the binder card grid, Name/Oracle Text/All search and filter drawer (tags, Keywords, normal Color, Commander Colors, type, mana and printing filters). Candidates are always restricted to the commander's canonical color-identity subset. Colorless cards remain compatible. Changing Commander Colors can further narrow candidates but cannot bypass the deck boundary. Other Commander rules, singleton limits, banned lists and Partner combinations are not fully validated; the editor states that limitation.

Tiles show **Owned · Assigned · Available** for each actual inventory printing/variant. Tap one to allocate a copy. Exhausted inventory shows **No unassigned copy available** and the decks using those copies. Nothing silently moves from another deck. Removing one deck copy releases that assignment only; deleting a deck releases all its assignments, including the commander. Collection ownership and ManaBox are unchanged. Collection Card Detail adds a subordinate **Deck Usage** section with per-deck navigation.

### Deck storage and reconciliation

`DeckRepository` is a separate data-access boundary implemented by `LocalDeckRepository` over the existing IndexedDB `CollectionRepository`. Decks, commander references, card assignments and derived physical counts commit together in one revision-checked snapshot. The additive optional `decks` field preserves schema-version-1 compatibility. A deck stores stable inventory IDs and canonical identity/printing references rather than duplicating complete card metadata. Finish, language, condition, binder and source fields stay on the collection item.

For every record, assigned count is the sum of commander reservations and deck-card assignments; available is `max(0, owned - assigned)`. A normal re-import preserves these relationships and replaces exported owned quantities as before. If ownership drops below assignments, **all assignments remain**, available becomes zero and both preview warnings and the binder/deck UI flag an allocation conflict. Explicitly remove excess deck copies (or delete the deck), or correct inventory and re-import, to resolve it. Zero-owned conflicting records remain visible inside decks even though the binder normally hides zero ownership. Omitted export records retain the approved upsert behavior; changes to binder/variant fields create distinct inventory keys and are not guessed to be copy transfers.

Removing or clearing allocated collection records is blocked with an explanation: release their deck assignments first. This prevents dangling deck references. Once assignments are released, the existing removal/typed-clear flow works normally. Deleting decks never deletes collection cards.

**Export Backup** retains all prior collection/metadata/import/intelligence/source fields and now includes decks, commander selections, assignments and printing references under `collection.decks`. Backup restore, server persistence, accounts, cloud sync, deck history, full rules validation and all v0.5.0 Deck DNA features remain unimplemented. Data survives browser restarts on this origin/device; clearing site storage removes it. See [v0.4.0 validation](docs/VALIDATION-v0.4.0.md).

## Visual identity

The approved binder language is formalized in [design-system tokens](src/styles/tokens.css) and the [visual identity guide](docs/DESIGN-SYSTEM.md). Components share the Obsidian Olive/Parchment/Antique Gold palette, neutral surfaces, subtle borders, accessible focus/selected/disabled states, spacing, radii and dark shadows. Geometry and behavior remain unchanged. Functional Magic mana/rarity colors stay distinct from brand accents.

The temporary diamond app icon has SVG, ICO, 16–1024px PNG, Apple touch and maskable PWA assets with matching manifest/favicon/theme references. `npm run icons:generate` recreates them from palette tokens using the existing Chromium toolchain. This adds installation identity metadata, not an offline service worker or a product rebrand. See [visual validation](docs/VALIDATION-VISUAL-IDENTITY.md).

## Intelligence polish (v0.3.2)

Ruleset **0.3.2** automatically refreshes older saved analysis once, using the existing worker and atomic repository path. Manual additions/suppressions remain intact. The importer matching, retry/cache/backoff and intelligence architecture remain unchanged; v0.4.0 integrates deck allocations and explicit quantity conflicts.

The rules now distinguish permanent type from strategic interest in that type, recognize waived equip costs, separate generic death triggers from explicit Sacrifice Payoff, distinguish self-graveyard exile from graveyard disruption, recognize token-copy reanimation, and exclude a spell's self-only graveyard-cast permission from generic Recursion. Optional self-discard choices count as outlets. Ten named-card snapshots protect both the corrected and strong existing results.

Dynamic typal intelligence uses a bundled **366-type Scryfall creature-type catalog** (`src/intelligence/data/creatureTypes.json`) and parsed subtype/ability signals. Arbitrary capitalized words no longer generate tags. Token creation alone records a type reference, not a typal payoff. Cards such as Éowyn and Diregraf require actual Human/Zombie conditions or payoffs. No new runtime catalog calls or intelligence providers are introduced.

### Keywords and text search

**Filters → Keywords** is a searchable multi-select built from canonical `keywords` metadata on cards and faces in the current collection. It matches **any** selected keyword and combines with Tags/Synergy, Commander Colors, normal color/type/printing filters and sorting. Clear keywords, cancel, Clear all and Reset all retain the existing draft/apply interaction. Card Detail shows Keywords separately from strategic Card Intelligence. New mechanic names appear automatically when supplied in canonical metadata; there is no fixed list of the example keyword names.

Keywords describe named mechanics; tags describe strategic/function meaning. Mayhem can be a canonical keyword without becoming a new taxonomy tag named Mayhem. This patch does not add Discard Matters/Cast From Graveyard taxonomy entries. Older cache entries with no keyword fields are not guessed from Oracle prose or silently refreshed through thousands of API calls: the filter explains when keyword data is absent. Existing metadata caching remains intact.

The search control now offers **Card Name** (unchanged default), **Oracle Text**, and **All** (name + Oracle text). Text search includes every available face, supports ordinary case-insensitive substring queries, and combines with semantic/keyword filters. It does not replace strategic tagging. Reset all returns to Card Name.

## Import reliability patch (v0.3.1)

A service outage is not a bad ManaBox row. Timeouts, rate limits, server errors, network/CORS failures and incomplete collection batches stop preview with an interruption count and **Retry unresolved**. Confirm import is unavailable until lookup completes. The parsed file stays in memory while the dialog is open; retry keeps successful matches and queries only remaining identities. After closing/reloading, choose the CSV again; successfully fetched canonical metadata is still cached on this device.

Requests are sequential, at least 250 ms apart (at most four starts/second per client before response latency). Transient requests get four attempts with exponential backoff. Numeric and HTTP-date `Retry-After` are respected without a five-second cap, including cooldown before a manual retry. A 429 slows subsequent pacing further. Cancellation aborts fetches and waiting.

A separate IndexedDB metadata cache checkpoints each successful batch/search before inventory confirmation. It stores canonical public card metadata and successful exact-name proofs, never CSV rows, purchases, quantities or ownership. Cache storage failure falls back to the in-memory session cache; it never writes or clears the collection. Clearing the collection can retain this public lookup cache; clearing browser site data removes it. Existing confirmed collection metadata also avoids redundant lookups. Current print metadata can remain cached until site data is cleared.

Scryfall IDs remain the primary authoritative printing identifiers. Only confirmed identifier-level `not_found`, invalid IDs, ambiguous matches or genuine identifier conflicts become Problem Rows; a missing identifier in an incomplete batch is not proof of a missing card. If an earlier version saved transient failures as problem rows, re-import the original export with this patch, complete lookup, review the preview and confirm. Successfully resolved rows replace those old problems using the existing safe absolute-quantity synchronization. No automatic deletion or quantity repair is applied without confirmation.

## Manage your local collection

Use **Select** to toggle records with a tap or keyboard. Selections use stable inventory IDs and survive search, filtering, sorting and loading more cards. **Select all** adds every current search/filter result, including unrendered records; changing results never silently changes your selection. Hidden selections count too. Clear selection or Cancel to reset them.

**Remove** requires confirmation and removes entire selected inventory records, including all their physical copies, after deck assignments are released. Card Detail also offers **Remove from Collection**. Your ManaBox collection and original CSV files are unaffected. A later confirmed ManaBox export containing a locally removed record may recreate it; there are no tombstones or suppression rules. Untouched records retain the existing absolute-quantity synchronization behavior.

**Manage Collection** shows stored unique records (including zero-quantity records), owned/assigned/unassigned copies, the most recent successful import and local storage status. **Export Backup** downloads `mtg-manager-backup-YYYY-MM-DD.json` with version, timestamp, inventory, canonical metadata and provenance. The backup reflects persisted data, not sample cards. It can contain original purchase/binder information: keep it private. Backup restore is not implemented in this release.

Allocated records must first be released from decks. **Clear Collection** displays the full stored scope and requires typing `CLEAR` before confirmation. It atomically empties records, canonical caches, import history and unresolved rows, resets selection/search/filters and saves an empty binder across reload. It does not return to sample data. Removal and clear use the existing revision-checked repository; failed writes leave cards and selection intact and offer retry. If another tab changed the collection, reload before retrying.

Data is stored only in this browser on this device, with no server backup, accounts or cloud sync. Keep your original ManaBox exports and download local backups. Browser data clearing or switching origins/devices does not preserve local storage.

## Card Intelligence & Auto-Tags

Cards are automatically analyzed locally after import and when an existing collection first upgrades. No re-import, API key or AI service is required. Use the restrained **Explore** chips or **Filters → Tags / Synergy** to find what your cards do. Search the tag list and select **Match ANY** (default: at least one) or **Match ALL** (every selected tag). Tags combine with search, normal color, type, printing/finish, mana, sorting and the unchanged Commander Colors subset filter.

**Card Intelligence** replaces the old sample preview. Tags are grouped by category and marked **Auto** or **Added by you**. Open a tag to inspect its rule, confidence heuristic, field, face where available, and concise evidence. Confidence is a rule-strength indicator, not a calibrated probability or a deck recommendation.

**Edit Tags** lets you add a taxonomy tag manually, hide an automatic tag, or restore automatic behavior. Hidden tags retain their original evidence and are marked **Hidden by you**. Corrections are saved atomically and survive reload, re-import, recalculation and ruleset upgrades. Changes apply to the canonical card across printings, not to individual physical copies. **Manage Collection → Recalculate Auto-Tags** reports canonical-card progress and preserves corrections.

### Taxonomy and engine

`src/intelligence/taxonomy.ts` centralizes **78 built-in tags** across strategy, mechanic, role, resource, payoff, enabler and interaction. This covers the executable's full named list (Go Wide is defined once), which exceeds its approximate 50–70 target. Dynamic creature-type tags such as **Elves Matter** are structured `typal:Elf` identifiers, not hundreds of top-level constants. Own creature types, ability references and actual synergy signals are stored separately; merely being an Elf is insufficient.

Thirteen testable rule modules cover counters, lands, tokens, graveyard, sacrifice, card advantage, mana, interaction, permanents, creatures, spells, life and miscellaneous mechanics. The central tagger deduplicates assignments, merges evidence and keeps strongest confidence. Canonical keyword/type fields supplement Oracle text; multi-face evidence retains its originating face. Structured assignments contain canonical identity, tag ID, source, heuristic confidence, evidence and ruleset version.

Canonical Scryfall Oracle IDs are preferred; normalized canonical English names provide a fallback for the v0.2.x cache that predates Oracle IDs. If a later import supplies an Oracle ID, name-based corrections migrate to it. New metadata retains keywords, faces, produced mana, layout and characteristic fields where available. Existing cards use their saved text without requiring network enrichment; missing face/keyword data limits inference until richer metadata arrives through import.

Analysis runs in a dedicated module Web Worker, once per canonical card rather than per printing, record or physical copy, with progress and yielding batches. Versioned results and separate user overrides live inside the existing repository snapshot. Current-rule results are reused; stale versions or changed canonical-input fingerprints are recalculated. Import previews prepare tags without writing; confirming import commits inventory and analysis together. Existing-collection upgrade and explicit recalculation also use revision-checked atomic writes. Backup includes analysis and corrections; full clear removes them. The schema remains an additive, backward-compatible version 1 extension. `IntelligenceProvider` defines a future extension boundary; no remote semantic provider is shipped or invoked.

### Tagging limits

Rules are conservative English-text heuristics, not complete Magic rules interpretation. Unusual wording, cross-face dependencies, complex antecedents, token copies and rare creature-type phrasing can be missed; incidental references can sometimes be over-tagged. Ambiguous death triggers do not automatically imply Aristocrats, ordinary lands are not Ramp merely for producing mana, and draw/life restrictions are excluded. Inspect evidence and correct imperfect results. Tag coverage describes card functionality, not format legality, synergy scores or deck optimization.

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
- Imported records start with `quantityAssigned = 0`, `quantityUnassigned = quantityOwned`. No deck assignments are created—even if ManaBox labels a list as a deck. Re-import preserves existing deck assignments; a reduced owned quantity below those assignments becomes an explicit allocation conflict, with availability clamped to zero.

New/updated/unchanged counts refer to grouped records; recognized/problem/duplicate counts refer to source rows. These units are labeled separately in the preview.

## Persistence and privacy

The simplest static-Cloudflare-compatible beta solution is **IndexedDB**, behind `CollectionRepository`. The versioned snapshot stores ownership records, normalized card metadata, proven name-match resolutions, unresolved rows and the latest import summary. Writes are atomic; stale previews from another tab are rejected using a revision check. Storage failures keep the previous collection intact and allow retry. Unsupported/corrupt snapshots produce an error instead of being overwritten. The app makes a best-effort browser persistence request after a successful save.

Data belongs to this **browser profile and site origin**. It is not synced between devices, Cloudflare preview URLs or domains. Clearing site data, private browsing, browser eviction or changing origins can remove local data. No server backup or account recovery is claimed. Keep the ManaBox export as the authoritative backup. No CSV contents or purchase/binder fields are sent to a server; Scryfall receives only matching identifiers/names and set information.

Parsing runs in a Web Worker. Large binders initially render 120 records, with a Show more cards action; searching, filtering and sorting always operate on the complete saved collection. This keeps first render bounded without changing the frozen card grid. Scryfall ID/set-number requests are deduplicated and batched up to 75 identifiers, paced sequentially at least 120 ms apart. Successful canonical metadata and unique name resolutions persist on confirmation. Opening the binder, filtering, sorting, opening details and re-importing already cached identifiers require no card API calls. Remote artwork still needs network/cache availability; missing art retains the named fallback.

`src/models/collection.ts` separates physical ownership from `CardMetadata`. `collectionCards()` adapts persisted inventory to the frozen binder's existing card interface. A future authenticated provider can replace the repository without replacing the binder UI. v0.4.0 adds the separate deck repository boundary on this same atomic snapshot. Accounts, deck optimization and cloud synchronization remain future scope.

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

All prior regression cases are retained, with obsolete sample-preview expectations updated for real intelligence and stronger focus checks. Added coverage includes valid/malformed/minimal ManaBox CSV, duplicates, repeated imports, changed totals, foil/nonfoil, different printings, missing IDs, ambiguous/unknown/conflicting metadata, purchase fields, storage/revision failures, ownership invariants, 10,000 parsed rows, 1,000 distinct batched printings, 5,000-row browser imports, imported filters and Commander Colors. Browser tests run at 360×800, 390×844, 430×932, 768×1024 and 1440×1000, with axe checks on the binder and import states.

Deterministic browser tests intercept remote metadata for the external-enrichment case; known printings use the bundled canonical cache. They do not depend on Scryfall availability. See [v0.2.0 validation](docs/VALIDATION-v0.2.0.md) for the separate live-API check and its cloud-browser transport limitation. Reports and screenshots are generated under ignored `playwright-report/` and `test-results/`.

Management adds stable-ID selection, filtered select all beyond rendered tiles, confirmed atomic deletion/clear, JSON backups, re-import and write-failure regression coverage. See [v0.2.1 validation](docs/VALIDATION-v0.2.1.md) for all 72 unit and 140 browser results, responsive review and release limitations.

See [v0.3.0 validation](docs/VALIDATION-v0.3.0.md) for intelligence fixtures, lifecycle, manual overrides, worker performance, accessibility and current release results. Prior sample-preview assertions now verify real tags and evidence keyboard access; import and management suites remain unchanged.

See [v0.3.2 validation](docs/VALIDATION-v0.3.2.md) for the exact named-card expectations, keyword/text-search behavior, regression coverage and historical results. See [v0.4.0 validation](docs/VALIDATION-v0.4.0.md) for current release results.

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
- Real deterministic tags replace the sample intelligence preview; demo artwork/ownership separation remains intact.

## Sample assets

`src/data/sampleCards.json`, `public/cards/` and `sampleCollectionSource` remain a demo and a small canonical metadata cache, never real ownership. Optional maintainer refresh (not startup/build):

```sh
python3 scripts/fetch-sample-data.py
```

Magic card images/text are © Wizards of the Coast. Metadata and image references are provided by [Scryfall](https://scryfall.com). This project is unofficial and not endorsed by Wizards or Scryfall. Font/icon licenses are in `public/licenses/`.

See [CHANGELOG.md](CHANGELOG.md), [ROADMAP.md](ROADMAP.md), the original [v0.1.0 brief](docs/v0.1.0-executable.md), and [historical foundation validation](docs/VALIDATION.md). v0.3.2 is approved; v0.4.0 Commander Library is current. Work stops before v0.5.0.
