# v0.6.18 — Standard and Legacy deck support

This is the separately requested Multi-Format Deck Support update. The v0.6.17 intelligence/generalization research remains unfinished; its scoring model is unchanged. Existing Commander decks and background recommendation analysis are preserved.

## What changed

Decks → New Deck and Decks → Import Deck now offer Commander, Standard and Legacy. Standard/Legacy drafts do not require a commander or apply Commander color identity restrictions. Existing decks without a format field still mean Commander; no migration removes commanders, entries or assignments.

ManaBox/MTGA-style text imports preserve main deck and Sideboard/SB rows for Standard/Legacy. Commander imports retain their original main/command-zone behavior; other sections continue to surface as import issues. Preview remains read-only and format warnings appear before confirmation. Missing cards remain in the decklist without fabricated ownership. Duplicate printings and both boards consume the same available physical-copy pool; nothing is taken from other decks.

Cards includes a board selector and Sideboard labels. Add Card lets the user choose Main deck or Sideboard. Removing a card from Card Detail uses its exact entry, so removing a sideboard copy cannot accidentally remove the main-deck copy of the same printing. Basic lands retain the approved shared decklist-resource policy (no exclusive assignments) and can be removed from the decklist without changing Collection quantities.

Standard/Legacy Overview shows:

- At least 60 main-deck cards, sideboard at most 15.
- Generally four copies across both boards and all printings, grouped by canonical card name.
- Basic-land and common Oracle-text copy exceptions (unlimited or explicit numeric limits).
- Scryfall legal/not-legal/banned/restricted states for the selected format.
- Missing legality data as **unverified**, never silently legal. Missing/old check dates warn after seven days.

Counts and legality are warnings: unfinished and illegal drafts can be saved. “Minimum size met” is a size indicator, not a certification of legality. Format changes are selected when creating/importing a new deck; automatic conversion of existing Commander decks is not implemented.

## Fresh legality checks

“Check format legality” explicitly requests fresh canonical metadata using `/cards/collection` in batches of up to 75 unique Scryfall printing IDs. It reuses the existing conservative pacing and transient-error retries. Browsing does not make one request per card. Stored success timestamps identify snapshot age; Standard rotation and ban changes come from Scryfall rather than inferred set codes.

All batches must succeed and match their requested IDs before any saved update. The repository updates only `legalities` and `legalityCheckedAt` on referenced metadata. It retains canonical IDs, images, purchases, quantities, assignments and user annotations. Revision checks still reject a stale concurrent save. On navigation away, the request is aborted. Failures preserve saved data and can be retried.

## Scope and limitations

- Only Commander, Standard and Legacy are selectable. This is not tournament registration or a Companion/restriction-rule engine.
- Commander DNA/Upgrades are not presented as calibrated recommendations for constructed decks. No new scoring, AI, Deck DNA or Brew feature was added.
- Legality is a saved Scryfall snapshot. A card can rotate or be banned after checking; run the explicit check before relying on it. Unmatched cards and unknown metadata remain visible as issues/warnings.
- Deck format is an additive optional field; old Commander data loads unchanged. Sideboards and commander-free decks require the updated app, so older open tabs should reload. Old readers fail closed rather than overwriting unsupported saved data.
- Standard/Legacy lists can contain missing cards. Owned quantities remain authoritative. Basic lands retain the existing nonexclusive model rather than inventing physical copies.
- Manual main↔sideboard changes use explicit remove/add actions; there is no automatic movement or stealing of copies.

## Validation

- `npm run build`: passed (TypeScript and production build); existing main-chunk size warning remains.
- `npm run lint` and `npx tsc -b`: passed.
- `npm run test:unit`: **642 tests passed**, 41 files. Seven new cases cover default format, unrestricted colors, preview-first 60/15 imports, missing copies, both-board browsing, cross-board copy limits, bans/unknown/stale data, generic exceptions, IndexedDB persistence, exact-board removal, incompatible saved command zones, fresh 75/75/1 batching/cache bypass, atomic errors and unallocated basic-land removal.
- New browser cases exercise Standard and Legacy imports, ownership preservation, explicit fresh legality lookup, bans/not-legal warnings, sideboard filtering, exact-board/basic-land removal, reload persistence, draft creation and no Commander requirement.
- `npm audit --omit=dev --json`: zero production findings. Full audit: 13 existing moderate dev lint-toolchain findings, zero high/critical; no incompatible dependency override.
- `git diff --check`: passed.
- Browser coverage spans all five approved viewports; details below. Chromium emulation is not physical iPhone/Safari validation.
- Frozen Commander recall evaluation passed offline; all twelve top-20 candidate names, orderings and ranking scores match v0.6.16 exactly.

## Browser outcome

The full production run passed all **400 existing browser cases** plus thirteen initial new-format cases. Two desktop cases reloaded before an asynchronous basic-land save completed (14 sideboard cards observed instead of the expected 13). The tests now await the saved count before reloading; assertions were not relaxed.

After that correction and final format-only UI polish, `TEST_PRODUCTION=1 npx playwright test tests/browser/formats.spec.ts tests/browser/deckNavigation.spec.ts` passed **35/35**, comprising all twenty new-format cases and fifteen existing navigation cases across 360×800, 390×844, 430×932, 768×1024 and 1440×1000. New coverage also proves a fresh device can create a Legacy draft without importing ownership, and checks horizontal overflow. Together the runs cover **420 distinct browser cases**. The final complete unit suite passed **642/642** after the cross-printing, stale-data and no-copy-stealing assertions were strengthened. Final lint, TypeScript/production build and whitespace checks pass.

Constructed formats hide Commander-only Synergy sort options, do not inherit Commander theme filters, and use the format label rather than Commander identity. Older Commander cards ignore a stale Sideboard filter. Library covers use the first main-deck card when no commander exists, with a format-label fallback for empty drafts.

GitHub main publication was explicitly requested by the user. The verified remote SHA is reported at completion; a successful Git push does not establish Cloudflare deployment.

## Deployment

The requested main push is authorized by the user’s ongoing publication preference. GitHub remote SHA is verified after push. Cloudflare deployment remains unverified from this environment: the enforced network policy excludes the Workers hostname and there is no configured Cloudflare credential. The existing Git integration is the deployment path. `/version.json` and the app header/footer now consistently report **0.6.18**; inspect the served version before manual testing at https://mtg-manager-app.lhauswirth15.workers.dev .
