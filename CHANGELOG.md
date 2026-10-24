# Changelog

## 0.4.1 — ManaBox Deck Import

- Added Decks → Import Deck with ManaBox deck file upload or pasted text, preview-first; nothing is saved before explicit confirmation. No account connection, scraping or Cloud Sync.
- Added a tolerant ManaBox/MTGA text parser: quantity, name, optional set code and collector number, blank lines, Commander/Deck/Sideboard/Maybeboard/Companion/About headings, category headings, `SB:` and commander markers, split/double-faced name normalization. Malformed and non-imported rows are retained with reasons.
- Added offline-first resolution (saved/bundled metadata → Scryfall printings → exact names) on the existing paced/retrying/cached client. Exact printings are preferred; a missing or conflicting printing falls back to the name with a visible note. Lookup outages offer Retry rather than producing problem rows.
- Commander detection uses an explicit section/marker when canonically eligible; otherwise the user must select among canonical candidates. Up to two commanders (Partner/Background, not validated); more are refused.
- Ownership reconciliation classifies exact, alternate printing, owned-but-allocated, missing and ambiguous cards. It auto-assigns exact available copies, visibly suggests a single available alternative, requires choices for multiple printing groups, and never takes copies from other decks. Summary shows cards, exact, alternate, owned-unassigned, missing and needs-review counts.
- Introduced `DecklistEntry` separate from `DeckCardAssignment` (linked by `entryId`), optional commander copy references, retained `importIssues` and import source. Missing cards are imported without fake ownership or Collection changes. Color identity conflicts are surfaced and receive no copy. Duplicate deck names are never overwritten (Import as new deck / Cancel).
- Deck editor shows owned/assigned/missing counts, a Missing / Unassigned section with reasons, and retained import problem rows (copy/download). Add Cards fills matching missing entries. Validation, backup and collection clear handle entry decks. Legacy v0.4.0 decks are unchanged.
- Importer reliability fix: one unexpected Scryfall card no longer stalls a whole lookup batch. Reversible cards use face type line/mana value/oracle ID; malformed metadata and mismatched answers become problems for their own rows; a migrated Scryfall ID is accepted only for an exact set/collector-number/name match. Short or failed responses still interrupt, and the interruption message now names the underlying cause.
- Added 18 unit tests and 2 browser workflows across all five sizes. All v0.4.0, v0.3.2 and v0.3.1 suites remain green. No v0.5.0 features.

## 0.4.0 — Commander Library

- Added artwork-first Decks navigation/library, name → owned commander creation, saved editor, basic composition, rename and confirmed deletion.
- Added canonical commander eligibility and color-identity subset enforcement; reused collection search, tags, Keywords and filters for owned-card additions. Full format validation remains explicitly limited.
- Introduced Deck/DeckCommander/DeckCardAssignment references and a DeckRepository boundary using the existing revision-checked IndexedDB transaction. Commander reservations and printing-level assignments derive assigned/available quantities atomically; no automatic copy movement or over-allocation.
- Added per-printing owned/assigned/available captions, exhausted-copy deck usage, release actions and subordinate Collection Card Detail Deck Usage.
- Preserved assignments across ManaBox re-import/recalculation. Reduced quantities produce visible recoverable conflicts rather than deleted assignments; zero-owned deck records remain manageable. Allocated collection removal/clear is guarded to prevent dangling references.
- Extended JSON backup with decks, commander references and assignments without removing existing fields. Added allocation/re-import/storage regressions and five-size production browser flows. Preserved v0.3.2 intelligence/brand/PWA and v0.3.1 importer systems. No v0.5.0 features.

## 0.3.2 — Intelligence Polish & Tagging Accuracy

- Formalized the approved visual identity into centralized palette/semantic tokens for surfaces, text, borders, focus, selection, disabled/destructive states, spacing, radii, typography and shadows. Existing layout and functionality are retained.
- Added temporary diamond SVG/ICO/PNG app icons, Apple touch asset and PWA/maskable manifest references, generated from token colors. Added brand/asset validation; no naming change, offline service worker or rebrand.

- Fixed self-type Oracle references being mistaken for Artifacts/Enchantments Matter; require actual strategic references.
- Replaced capitalized-word subtype inference with a bundled Scryfall creature-type catalog, validated dynamic IDs and explicit payoff/enabler detection. Fixed Éowyn Human synergy and rejected Eachs Matter/other junk types.
- Separated generic Death Triggers from Sacrifice Payoff while retaining valid aristocrats drain classification.
- Distinguished self-exile graveyard resources from Graveyard Hate, added token-copy reanimation, tightened self-cast versus Recursion, and recognized optional discard outlets.
- Added waived equip costs as Cost Reduction; protected Doubling Season, Diregraf Colossus, Desecrated Tomb and Ghirapur Orrery results with canonical fixtures.
- Added canonical Keywords filtering/detail metadata as a separate layer from strategic tags, plus optional Name/Oracle Text/All search across faces.
- Bumped ruleset to 0.3.2 for one-time recalculation with manual overrides preserved. Added ten real-card snapshots, rule-quality/unit/browser regressions and accessibility checks. Card tile names use natural text with printing/quantity descriptions, preserving visuals and action names even when art is unavailable.
- Preserved v0.3.1 importer reliability and all collection-management behavior. No v0.4.0 functionality.

## 0.3.1 — Importer Reliability

- Fixed service/batch failures being converted into one false Problem Row per card. Interrupted lookups now block preview and offer Retry unresolved with retained parsed input and successful lookups.
- Added conservative exponential retries for timeouts, 429, 5xx and network/CORS failures; honored full numeric/date Retry-After and slowed request pacing to at most four starts/second, further reduced after 429.
- Added per-batch persistent canonical metadata checkpoints outside ownership storage, with session fallback if cache persistence fails. Reopening/re-importing reuses successful metadata without restarting lookups from zero.
- Require explicit identifier-level not_found for missing collection results; incomplete/failed batch responses remain service interruptions. Printing IDs stay authoritative.
- Added a 4,421-row deterministic regression interrupted after 1,839 successes, full recovery across resolver recreation, stale-problem cleanup, cache reuse and unchanged re-import assertions. Added transport/backoff/cancellation tests and browser interruption/retry coverage.
- Preserved collection quantities, confirmed-import atomicity, management and existing Card Intelligence. No further intelligence features or v0.4 work.

## 0.3.0 — Card Intelligence & Auto-Tags

- Added a centralized 78-tag taxonomy and dynamic creature-type synergy signals, with 13 explainable rule modules and canonical-identity deduplication.
- Added structured assignments with evidence, face/field provenance, confidence heuristics and ruleset version; retained richer Scryfall metadata where available.
- Added worker-based import/upgrade/recalculation lifecycle, progress, persisted auto-tag caches and canonical-input fingerprint invalidation. No model API, API key or new network provider.
- Added searchable ANY/ALL synergy filtering and restrained quick-tag browsing, combined with all approved binder filters and Commander Colors.
- Replaced sample intelligence previews with real grouped tags, keyboard-accessible evidence, manual add/hide/restore and preserved automatic evidence. Corrections survive reload, re-import and recalculation.
- Added Recalculate Auto-Tags to management; backups include intelligence and clear resets it through the existing atomic repository. Existing inventory behavior is preserved.
- Added curated/negative/multi-face/lifecycle/filter/performance fixtures and browser tests. Updated only obsolete sample-preview expectations and strengthened evidence focus checks in prior tests.
- Fixed detail-shell scrolling when focusing the expanded tag editor, keeping the close control reachable.
- No Commander Library, deck assignment, Deck DNA, recommendations, accounts, cloud sync or v0.4+ features.

## 0.2.1 — Collection Management & Multi-Select

- Added stable-ID multi-select, selected indicators, hidden-selection retention and a safe-area-aware sticky action bar. Select all includes every filtered/searched result, beyond rendered tiles.
- Added confirmed bulk and Card Detail removal through the existing atomic, revision-checked repository. Local removals can return on later ManaBox import.
- Added Manage Collection with stored-record and physical-copy statistics, last successful import, persistence guidance and JSON backup export.
- Added deliberate full clear requiring typed confirmation, persistent empty state, and reset of import/problem/selection/filter state. Failed writes retain the existing UI and support retry.
- Added management persistence, browser, accessibility, backup and re-import regression tests across all five approved viewports. Preserved v0.2.0 tests and import architecture.
- No backup restore, accounts, cloud sync or v0.3.0 functionality.

## 0.2.0 — Real Collection Foundation

- Added a premium ManaBox CSV upload → parse → preview → confirm → binder flow with success, partial-success and error states.
- Added deterministic ID / printing / exact-name matching, explicit ambiguity handling and retained original problem rows.
- Added non-destructive absolute-quantity re-imports, duplicate-row aggregation and distinct printing/finish/language/condition/binder records. Groups with problematic duplicate rows retain their old totals until corrected.
- Added atomic IndexedDB persistence behind a repository interface, revision conflict protection and saved canonical metadata.
- Added quantityOwned / quantityAssigned / quantityUnassigned, original source and purchase-field preservation, and compact ownership details.
- Added worker-based CSV parsing, deduplicated Scryfall batches and persisted unique-name resolutions; no API calls while browsing.
- Preserved the approved v0.1.1 binder, Commander Colors and original tests. Added import, sync, persistence, large-collection and accessibility tests.
- No accounts, automated tagging, AI, Commander management, recommendations or v0.3.0 work.

## 0.1.1 — Binder Polish

- Added a separate Commander Colors collection filter covering all 32 color identities, including colorless. Cards match only when their Scryfall color identity is a subset of the selected identity; colorless cards always qualify.
- Preserved the normal Color filter and combined-filter, apply/cancel, active-state and reset behavior.
- Added subset-rule unit tests and responsive browser coverage. No later roadmap features added.

## 0.1.0 — Digital Binder Foundation

- Added a premium, dark mobile-first collection binder with 32 sample printings and 82 copies.
- Bundled real Scryfall artwork and local fonts; no runtime API calls.
- Added immediate name search, combined color/type/mana/rarity/set/finish/sample-tag filters and four sort modes.
- Added accessible card details, preview-only curated tags, modal focus management and natural browser-back dismissal.
- Added responsive shell, mobile bottom navigation, future Commanders placeholder, loading skeletons, empty states and broken-image fallbacks.
- Added unit and five-viewport browser acceptance tests and static Cloudflare Pages build instructions.
- No accounts, imports, persistence, deck management, recommendations or automated intelligence.
