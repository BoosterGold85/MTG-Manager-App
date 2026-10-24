# v0.3.0 — Card Intelligence & Auto-Tags

Baseline: approved v0.2.1 commit `9f283d8`. Scope: supplied `MTG_Manager_v0.3.0_Card_Intelligence_Auto_Tags_Executable.md`. Commander Library and all v0.4+ capabilities remain unimplemented.

## Implementation

- Central taxonomy: **78 built-in definitions**, unique IDs/labels, category, description, plus dynamic `typal:<creature type>` tags. The executable's named initial set contains more than its approximate 50–70 target; the named concepts are covered, with Go Wide defined only once. No unrelated features were added.
- Thirteen rule modules: counters, lands, tokens, graveyard, sacrifice, cardAdvantage, mana, interaction, permanents, creatures, spells, life and misc. Helpers handle positive instructions separately from restrictions and trigger premises. Typal signals have their own module.
- Automatic assignments store canonical identity, tag ID, rule/derived source, heuristic confidence, concise field/face evidence and ruleset version. Deduplication merges evidence and retains the strongest confidence. Confidence is not a probability claim.
- Canonical inputs retain Scryfall Oracle ID, keywords, faces, produced mana, characteristic fields and layout when available, in addition to existing text/types/identity/mana. All faces are analyzed, retaining face-level evidence. Existing caches work without network refresh.
- Card Intelligence replaces preview/sample content, groups real tags by category, exposes evidence with keyboard-accessible disclosures and labels Auto/Added by you/Hidden by you in text.
- Searchable tag multiselect supports ANY/ALL, combines with all existing filters/sort, and powers restrained quick synergy chips. Select all and bulk removal still operate on the complete filtered inventory result.
- Edit Tags persists manual add/suppress/restore. Automatic evidence remains saved and inspectable for suppressed tags. Manual assignments have explicit source/provenance; manual additions retain precedence even if future rules also assign that tag.
- Manage Collection includes Recalculate Auto-Tags with canonical count, progress and completion/error feedback. No paid AI service, API key, remote semantic provider or new per-card browsing request. A provider interface is defined for future extension only.

## Storage and lifecycle

Optional intelligence data is an additive extension to repository schema version 1; old snapshots do not require a destructive migration. The collection snapshot stores canonical auto results separately from overrides. Existing records, quantities, import sources and purchase/binder data are not rewritten by tagging.

New imports prepare tags off-thread before preview; only confirmation commits inventory and analysis together. Existing collections automatically process missing/stale results on upgrade, with progress and an atomic revision-checked save. Current results are reused on subsequent loads. Canonical input fingerprints invalidate changed metadata without reprocessing unchanged cards. Explicit recalculation forces current canonical cards through the engine but preserves overrides.

Oracle identity is preferred. For the older cache without Oracle IDs, normalized English canonical name is a fallback; later Oracle-ID enrichment migrates name-keyed corrections. Printings/finishes/binders/copies share analysis. A worker receives unique printing metadata, groups by canonical identity, yields in batches of 40 and reports progress. No full rule evaluation runs during rendering or normal browsing.

Repository writes remain atomic and revision checked. Failed manual writes retain original tags and permit retry; failed recalculation does not replace saved results. Concurrent changes require reload rather than overwriting another tab. Backup JSON includes analysis and corrections. Record removal preserves cached canonical analysis/corrections, allowing a later ManaBox re-import to recreate the record consistently. Clear removes inventory, intelligence, corrections, metadata and import/problem state together and retains the approved persistent empty binder.

## Automated validation

Final results: **lint passed; 159 unit tests passed; 180 production browser tests passed across all five viewports; TypeScript/Vite production build passed; dependency audit found 0 vulnerabilities; whitespace checks passed.** No skipped tests. This adds 87 unit cases and 40 browser cases to the prior suite. The full production run completed in 5.5 minutes.

A transient import-footer contrast failure found during validation was corrected in CSS rather than disabling the accessibility assertion. After the final face-keyword provenance adjustment, lint and all 159 unit tests passed again, production assets were rebuilt, all eight intelligence browser smoke cases passed at 390px, and audit/whitespace checks passed again. The multi-face unit fixture explicitly verifies that a combined root keyword is not incorrectly attributed to the front face.

Commands:

```sh
npm run lint
npm run test:unit
npm run build
TEST_PRODUCTION=1 npm test
npm audit --cache /workspace/.npm-cache
git diff --check
```

Unit coverage includes unique taxonomy IDs/categories, curated mechanics/roles/payoffs, deliberate negative cases, multi-tag deduplication/evidence/confidence, face-origin evidence and canonical fields, save/reload, current/stale rulesets, changed text, add/suppress persistence, manual precedence, name-to-Oracle migration, 6,000 printing records sharing 100 canonical identities, asynchronous yielding/progress/cancellation, re-import/unresolved safety, and ANY/ALL composition with existing filters and sort.

Browser coverage adds eight workflows per viewport: first-upgrade persistence/current-rule cache reuse, quick tags and searchable ANY/ALL with combined search/color/type/sort/Commander Colors, evidence/manual add/hide/restore through reload/re-import/recalculate, new imports and repeated import deduplication, stale version refresh, 4,000 inventory records sharing canonical analysis while the main thread continues a heartbeat, axe checks/layout screenshots, and injected manual-write quota failure with retry.

All previous test cases remain. Import and management test files are unchanged. Prior sample-preview assertions are intentionally updated to real automatic tags: the combined filter still finds exactly Hardened Scales; the empty basic-land intelligence check still verifies graceful optional metadata; real evidence replaces the old manually curated preview. Detail focus checks are strengthened to reach evidence and wrap both directions instead of assuming the obsolete preview had no focusable controls. No checks were skipped or assertions weakened to conceal failures.

## Responsive and accessibility review

Viewports: 360×800, 390×844, 430×932, 768×1024, 1440×1000. Review includes tag filtering/long names, ANY/ALL and zero results, evidence, editing/override labels, recalculation feedback and the artwork-first binder. Screenshots are generated in ignored `test-results/` and reports in `playwright-report/`.

Axe checks cover new filter, editing/evidence and recalculation views in addition to all prior binder/import/management checks. Tag chips and matching controls expose pressed state. Evidence disclosures are keyboard operable, status messages announce progress, and auto/manual state uses text rather than color alone. Existing reduced-motion and safe-area behaviors remain. Import footer color interpolation is suppressed across phase changes to avoid transient low-contrast labels. The detail shell uses `overflow: clip` so focusing the expanded editor scrolls its internal region rather than moving the close control offscreen; this is asserted in browser tests.

Physical-phone hardware and the user's real ManaBox collection were not available. A separate production-browser smoke flow uploaded a real ManaBox-format sample CSV, opened Edit Tags and scrolled its options at all five sizes: editing options and close control were visible, with zero page errors (local evidence in `/workspace/mtg-v030-qa/`). Mobile evidence is Chromium emulation; Safari/native download/virtual-keyboard behavior is not claimed verified.

## Files/components

- `src/intelligence/`: taxonomy, types/provider interface, tagger, canonical processing/lifecycle, worker client, creature-type signals and 13 rule modules plus helpers.
- `src/workers/intelligence.worker.ts`: off-thread analysis/progress.
- `src/components/CardIntelligence.tsx`: evidence, grouped tags, editor and hidden-evidence view.
- `src/components/CardDetail.tsx`, `FilterDrawer.tsx`, `ManageCollection.tsx`, `src/app/App.tsx`: integration, filters, startup upgrades, manual-save/recalculation orchestration and quick chips.
- `src/models/card.ts`, `collection.ts`: normalized canonical fields, optional persisted intelligence and binder projection.
- `src/import/scryfall.ts`, `prepare.ts`, `plan.ts`: richer normalization, prepared analysis and preservation of corrections during upserts.
- `src/storage/collectionRepository.ts`, `collectionManagement.ts`: validation of optional intelligence and current backup version; existing transaction semantics preserved.
- `src/utils/filters.ts`, `src/styles/app.css`: composable tag filtering and responsive presentation.
- New `tests/fixtures/intelligence.ts`, `tests/unit/intelligence.test.ts`, `tests/browser/intelligence.spec.ts`; narrow intentional real-intelligence updates to prior binder/unit detail tests.
- Version manifests, README, CHANGELOG, ROADMAP and this report. No dependencies added.

## Known inference limits

This is an English-text rule engine, not a full Magic interpreter. Rare wording, unusual creature-type inflections, complex antecedents, cross-face dependencies and token-copy phrasing can cause missed tags. Incidental references or mixed effects can cause false positives. Existing metadata without structured faces retains combined text but cannot recover missing face-origin provenance. Text fingerprints are lightweight cache invalidation, not a security hash. Users can inspect evidence and correct tags; corrections persist independently of rules.

No deck assignment, deck creation/imports, Deck DNA, optimization, recommendations, EDHREC, accounts, cloud sync, pricing or model calls were implemented. Backup restore remains outside scope. Data remains browser/origin-local.

## Publication

GitHub `main` is the authorized push target. Existing Cloudflare static build settings remain `npm run build` → `dist`. No Cloudflare deployment connector, CLI, configured public URL or credential variables are available in this environment. A configured Git integration may deploy on push; public deployment cannot be verified here and is not claimed successful.
