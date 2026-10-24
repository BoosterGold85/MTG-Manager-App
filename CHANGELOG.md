# Changelog

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
