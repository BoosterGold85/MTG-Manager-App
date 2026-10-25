# MTG Manager · v0.6.1

A mobile-first, artwork-forward Magic binder with a preview-first **ManaBox CSV import**. The approved v0.1.1 binder, filters (including Commander Colors), sorting, card details and responsive layouts remain the foundation. Until the first confirmed import, the app shows the original clearly marked 32-card sample binder. Sample quantities are never mixed into your collection.

## Deck-aware scoring rebuild (v0.6.1)

Synergy now uses a cached **DeckStrategyProfile** built from the actual conceptual decklist and separately analyzed Commanders. It measures explicit Commander interactions (30), primary archetype fit (25), unmet role needs (15), established packages (10), local efficiency (10), generic overlap (5), and curve/mana fit (5), then subtracts signed penalties and clamps the result to 0–100. Scores are integers, not forced into five-point steps or an artificial distribution. Card Intelligence tags and the existing descriptive Deck DNA percentages remain intact.

**Upgrades I Own sorts by final score first**, with available copies breaking ties. **Recommended** contains scores ≥70; **Worth Considering** contains 50–69; **Other Legal Cards** contains scores below 50 and is collapsed by default. Those lower scores explicitly say Weak Fit, Poor Fit or Not Recommended and use subdued styling. Color compatibility is enforced as before; the existing full-Commander-legality limitations remain.

Every candidate has a collapsed **Score breakdown** with all seven components, exact raw/clamped totals, role counts/targets, matching packages, printed Commander evidence and negative reasons. The same model powers deck-relative Card Detail and comparison. Off-archetype bodies, absent Commander interaction, redundant roles, curve congestion, low impact for mana value and concrete anti-synergy can subtract points. Generic value alone cannot produce a primary recommendation. No price, rarity rank, popularity or owned quantity contributes to the score. Efficiency is a transparent local heuristic, not a universal power rating.

Strategy profiles and card scores are cached independently of physical ownership. Semantic deck/Commander changes, metadata, manual corrections and model/ruleset versions invalidate the relevant results; scrolling, search and availability changes reuse them. No database migration, collection reset, automatic swaps or moves are introduced. See [the executable](docs/v0.6.1-scoring-executable.md) and [validation / limitations](docs/VALIDATION-v0.6.1.md).

## Synergy Explorer — Upgrades I Own (v0.6.0)

Open a saved deck and choose **Explore Synergy**. The read-only explorer searches your owned collection, groups printings/finishes of the same canonical card, excludes every card already in the conceptual decklist (including missing entries and Commanders), and enforces the Commander's canonical color-identity subset. Colorless cards remain eligible.

Candidates rank by final deck-aware Synergy score, with available copies breaking ties, then name. Fully assigned candidates remain visible with **Used in** deck names and quantities. Scores remain ownership-neutral: availability changes ordering, not fit. Expand printing/variant details for exact owned and available counts; zero-owned cards are excluded.

Choose **Compare [card]**, then explicitly choose a card currently in the deck. Both use the same Deck DNA scoring model and expose theme, Commander, role and source evidence. Card details remain available for both owned and missing deck cards. Candidate evaluation uses the unchanged saved deck's DNA; candidates cannot promote their own themes by being temporarily inserted into it. All analysis stays local, with no card lookup calls during exploration.

This release makes **no swaps, additions, assignments or physical-copy moves**. “Upgrades I Own” describes candidates to consider, not guaranteed upgrades, power ratings or cuts. Scores use the v0.6.1 integer model and signed breakdown. Existing Commander legality limitations still apply. Search, available/fully-assigned views, empty results and progressive candidate rendering keep the existing binder visual language. No schema migration or persisted recommendation cache is added. See [v0.6.0 validation](docs/VALIDATION-v0.6.0.md).

## Audit fixes (v0.5.2)

- **Multiple tabs:** when another tab or window saves, this tab shows “Your collection changed in another tab or window” with **Load latest**. It never swaps data under an open preview, and stale writes are still refused.
- **Links and history:** Decks is `?view=decks`, and a deck is `?view=decks&deck=<id>`. Reload, Back/Forward and bookmarks return to the same screen; the browser tab title names the deck.
- **Units:** a *record* is one printing/finish/language/condition group; *copies* are physical cards. Deck summaries separate decklist cards from copies assigned.
- **Safari/iPhone:** default browser tests use Chromium. Run `TEST_WEBKIT=1 TEST_PRODUCTION=1 npx playwright test --project=webkit-iphone` after `npx playwright install webkit`, and follow [the iPhone smoke checklist](docs/IPHONE-SMOKE-CHECKLIST.md) on a device before releases.

## Storage reliability hotfix (v0.5.1)

Closing IndexedDB connections are invalidated, reopened and retried once when a transaction cannot start. Revision checks and atomic writes remain unchanged; a write already in progress is never replayed. Deck import now verifies saved collection ownership with a fresh storage read. If it fails, ownership results are withheld and Confirm import stays disabled; **Retry ownership check** reuses the retained decklist. Storage failure never means “you own zero cards.” No collection reset or ManaBox collection re-import is required for this connection recovery. See [hotfix validation](docs/VALIDATION-v0.5.1.md).

## Deck DNA Core (v0.5.0)

Each saved deck now explains its **Deck DNA**, **What This Deck Does** and **Core Plan** above the existing Basic Composition and card browser. Primary themes are normalized descriptive weights, not probabilities, power levels, card quality or raw tag-count percentages. Usually four to seven themes are shown; sparse evidence produces fewer themes instead of invented filler. Open **How these themes are weighted** for contributing subthemes, cards, Commander reinforcement and original Card Intelligence evidence.

Analysis includes the entire conceptual decklist, including missing cards and unassigned commanders. Related tags are grouped into presentation families (Graveyard, Counters, Tokens, Sacrifice/Death Payoffs and others); the universal taxonomy is unchanged. Repeated strategies and explicit payoffs carry more weight than characteristics. Commander reinforcement is amplified but capped; unsupported Commander themes cannot replace the actual decklist's strategy. Summaries use deterministic evidence-led templates and do not invent win conditions or turn sequences.

**Synergy High → Low / Low → High** sorts each non-Commander card by its fit within this deck. Only these sort modes emphasize a Synergy metric on tiles. Open a card's **In This Deck** section for theme connections, Commander links, roles, source evidence and a coarse score breakdown. Card Intelligence continues to describe the card generally; deck-relative reasoning stays separate. v0.6.1 replaces the original five-point theme-overlap score with contextual components and penalties; a low score means limited fit in this deck rather than a universal judgment of the card. No price, popularity, external rankings or LLM/API analysis is used.

Select a displayed DNA theme or use **Deck DNA theme** in the existing controls to browse its contributors. Search, type and ownership filters still combine with sorting, and Previous/Next follows the exact visible sequence and position. Missing cards remain fully browsable.

Derived DNA uses a bounded in-memory cache keyed by deck ID, stable conceptual-content revision, DNA version and Card Intelligence ruleset. Add/remove/Commander/metadata/manual-tag changes invalidate it; browsing and ownership-only changes reuse it. An unchanged deck reopens from cache; reload safely rebuilds it locally. No database migration or persisted derived data is needed, and backups retain their existing collection/deck/source/correction fields with the current application version.

See [v0.5.0 validation and methodology](docs/VALIDATION-v0.5.0.md) for weights, regression decks, limitations and commands. v0.4.2 is approved. The v0.5.0 engine remains the scoring foundation; automated cuts, optimization and new-set work remain unimplemented.

## Deck Browsing & Card Navigation (v0.4.2)

Tap any card in a deck to open the same Card Detail used in Collection: artwork, mana cost and value, type line, Oracle text, color identity, set, collector number, rarity, finish, Keywords, Card Intelligence with auto tags, manual overrides and “Why this tag?” evidence, and Deck Usage. A **Deck entry** section keeps the decklist and the physical copy separate. It shows the exact assigned printing, or "Physical assignment: None", plus whether copies are owned elsewhere or the card is not currently owned.

- **Previous / Next** stay inside the open detail (`← 3 of 9 →`). The card content swaps in place and starts at the top. Previous is disabled on the first card and Next on the last; there is no wraparound. Left/Right arrow keys work while the detail is focused, but not while typing. Escape closes.
- **Sort deck:** Card Type → Mana Value → Name (default), Name A–Z / Z–A, Mana Value Low → High / High → Low, Color (mono WUBRG, multicolor, colorless), or Set & Collector Number. Ties always fall back to Name A–Z, then printing. Tiles show only the metric for the active sort.
- **Filter:** search this deck, card type, and (for imported decks) owned/assigned vs. missing/unassigned.
- Previous/Next follow exactly the filtered and sorted cards shown, and the position counts only visible cards. Commanders open without deck navigation.
- Missing cards open with canonical card data. Their Card Intelligence is computed locally once per card and cached; browsing never reanalyzes cards or calls the network.

## ManaBox Deck Import (v0.4.1)

**Decks → Import Deck** brings an existing Commander deck in from ManaBox without rebuilding it. Upload the text file ManaBox's deck **Export** produces, or paste decklist text. No ManaBox account connection, scraping or Cloud Sync is involved.

- **Formats:** `1 Sol Ring`, `1x Sol Ring`, `1 Arcane Signet (CMM) 380`. Blank lines are ignored. Section headings such as `Commander`, `Deck`/`Mainboard`, `Sideboard`, `Maybeboard`, `Companion` (with optional `//`, `#`, `==` or `:` decoration and `(n)` counts), MTGA `About`/`Name …`, `SB:` prefixes, category headings (`Creatures (30)`), and the `*CMDR*`, `[Commander]`, `*F*` markers are understood. `Fire / Ice` and `Delver of Secrets /// Insectile Aberration` become `A // B`.
- **Preview first:** nothing is saved until **Confirm import**. Lookups use saved/bundled canonical metadata first, then Scryfall printings, then exact names, with the same pacing, retries and cache as collection import. A lookup outage offers **Retry lookup**; no rows are marked bad.
- **Printings:** set + collector number matches the exact printing. If it is not found, or belongs to a different card, the row falls back to the card name with a visible note.
- **Commander:** an explicit Commander section or marker is used when canonical metadata allows it. Otherwise eligible cards are listed and you must choose (one, or two for Partner/Background; pairing rules are not validated). Three or more commanders are refused, not truncated.
- **Ownership:** each card is shown as exact owned copy, different printing available, owned but fully assigned (with the decks using it), missing, or needing a printing choice. Exact available copies are assigned automatically. A single available alternative is suggested visibly. Multiple possible printing groups need your choice (or **Leave unassigned**). Copies are never taken from another deck.
- **Missing cards are imported** as decklist entries with no physical copy assigned. Collection quantities, source rows and existing metadata are never changed. Canonical metadata for unowned cards is added only where it is absent. Cards outside the commander's color identity stay in the decklist, flagged, with no copy assigned.
- **Problem rows** (unrecognized card, malformed quantity, ambiguous name, sideboard/maybeboard rows) are kept with their reasons on the saved deck and can be copied or downloaded.
- **Same name:** an existing deck is never overwritten. Choose **Import as new deck**, rename, or **Cancel**.

The deck model separates `DecklistEntry` (what the deck contains) from `DeckCardAssignment` (which owned printing group supplies a copy, linked by `entryId`). The deck editor shows `100 cards · 94 copies assigned · 6 missing` and a **Missing / Unassigned** section. Adding an available copy from **Add Cards** fills a matching missing entry first. See [v0.4.1 validation](docs/VALIDATION-v0.4.1.md).

## Commander Library (v0.4.0)

Open **Decks → New Deck**, name it, then choose an owned commander. Candidates use canonical legendary-creature types or explicit “can be your commander” Oracle text, never strategic tags. The selected printing reserves one owned copy. Sample cards remain a demo and cannot be assigned.

The artwork-first library shows commander, identity, count, allocation status and last modified date. Open a deck to view its Commander and Deck sections, add/remove owned copies, rename it or explicitly confirm deletion. Basic composition is secondary and collapsed by default; average mana value excludes lands. The commander list is modeled as an array for future multiple-commander support, but this release creates one commander per deck.

**Add Cards** reuses the binder card grid, Name/Oracle Text/All search and filter drawer (tags, Keywords, normal Color, Commander Colors, type, mana and printing filters). Candidates are always restricted to the commander's canonical color-identity subset. Colorless cards remain compatible. Changing Commander Colors can further narrow candidates but cannot bypass the deck boundary. Other Commander rules, singleton limits, banned lists and Partner combinations are not fully validated; the editor states that limitation.

Tiles show **Owned · Assigned · Available** for each actual inventory printing/variant. Tap one to allocate a copy. Exhausted inventory shows **No unassigned copy available** and the decks using those copies. Nothing silently moves from another deck. Removing one deck copy releases that assignment only; deleting a deck releases all its assignments, including the commander. Collection ownership and ManaBox are unchanged. Collection Card Detail adds a subordinate **Deck Usage** section with per-deck navigation.

### Deck storage and reconciliation

`DeckRepository` is a separate data-access boundary implemented by `LocalDeckRepository` over the existing IndexedDB `CollectionRepository`. Decks, commander references, card assignments and derived physical counts commit together in one revision-checked snapshot. The additive optional `decks` field preserves schema-version-1 compatibility. A deck stores stable inventory IDs and canonical identity/printing references rather than duplicating complete card metadata. Finish, language, condition, binder and source fields stay on the collection item.

For every record, assigned count is the sum of commander reservations and deck-card assignments; available is `max(0, owned - assigned)`. A normal re-import preserves these relationships and replaces exported owned quantities as before. If ownership drops below assignments, **all assignments remain**, available becomes zero and both preview warnings and the binder/deck UI flag an allocation conflict. Explicitly remove excess deck copies (or delete the deck), or correct inventory and re-import, to resolve it. Zero-owned conflicting records remain visible inside decks even though the binder normally hides zero ownership. Omitted export records retain the approved upsert behavior; changes to binder/variant fields create distinct inventory keys and are not guessed to be copy transfers.

Removing or clearing allocated collection records is blocked with an explanation: release their deck assignments first. This prevents dangling deck references. Once assignments are released, the existing removal/typed-clear flow works normally. Deleting decks never deletes collection cards.

**Export Backup** retains all prior collection/metadata/import/intelligence/source fields and now includes decks, commander selections, assignments and printing references under `collection.decks`. Backup restore, server persistence, accounts, cloud sync, deck history and full rules validation remain unimplemented. Data survives browser restarts on this origin/device; clearing site storage removes it. See [v0.4.0 validation](docs/VALIDATION-v0.4.0.md).

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

Parsing runs in a Web Worker. Large binders initially render 120 records, with a Show more cards action; searching, filtering and sorting always operate on the complete saved collection. This keeps first render bounded without changing the frozen card grid. Scryfall ID/set-number requests are deduplicated and batched up to 75 identifiers, paced sequentially at least 250 ms apart (slowing further after HTTP 429), the same contract as the importer reliability section. Successful canonical metadata and unique name resolutions persist on confirmation. Opening the binder, filtering, sorting, opening details and re-importing already cached identifiers require no card API calls. Remote artwork still needs network/cache availability; missing art retains the named fallback.

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

See [v0.3.2 validation](docs/VALIDATION-v0.3.2.md) for the exact named-card expectations, keyword/text-search behavior, regression coverage and historical results. See [v0.5.0 validation](docs/VALIDATION-v0.5.0.md) for DNA results, [v0.4.2 validation](docs/VALIDATION-v0.4.2.md) for browsing, [v0.4.1 validation](docs/VALIDATION-v0.4.1.md) for deck import and [v0.4.0 validation](docs/VALIDATION-v0.4.0.md) for the Commander Library baseline.

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

See [CHANGELOG.md](CHANGELOG.md), [ROADMAP.md](ROADMAP.md), the original [v0.1.0 brief](docs/v0.1.0-executable.md), and [historical foundation validation](docs/VALIDATION.md). v0.4.2 is approved; v0.5.0 Deck DNA Core is approved; v0.5.1 storage reliability and [v0.5.2 audit fixes](docs/VALIDATION-v0.5.2.md) are preserved; v0.6.0 Synergy Explorer is preserved; v0.6.1 deck-aware scoring is current. Work stops before v0.7.0.
