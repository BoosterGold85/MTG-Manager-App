# v0.5.2 — Audit fixes

Baseline: `85e1480` (v0.5.1, now **Approved**). v0.5.2 is **Current**. Scope: findings 3–9 of the external audit. Findings 1–2 were not included in the supplied excerpt and are not addressed here. No new Deck DNA features; no v0.6.0 work.

| # | Finding | Resolution |
|---|---|---|
| 3 | No Safari/iPhone engine coverage | Opt-in `webkit-iphone` Playwright project (`TEST_WEBKIT=1`; needs `npx playwright install webkit`) and `docs/IPHONE-SMOKE-CHECKLIST.md`. **WebKit was not run for this release** (only Chromium is installed in the build environment). |
| 4 | Other tabs stay stale | `src/storage/collectionSync.ts`: BroadcastChannel notice after every committed save (tab id excludes self), plus a revision check when a tab becomes visible. A banner offers **Load latest**; nothing is replaced silently, and revision-checked writes still reject stale saves. |
| 5 | No URL/history for screens/decks | `?view=decks` / `?view=decks&deck=<id>` via pushState; popstate restores the screen; titles `MTG Manager — My Collection / Decks / <deck>`. Overlay Back is unchanged; opening a deck from Card Detail replaces the overlay entry; unknown deck links fall back to the library. Collection → Decks returns to the deck that was open (the approved v0.4 behavior); tapping Decks while on Decks shows the library. |
| 6 | Deck empty state contradicted Import Deck | Copy explains both paths. |
| 7 | "Cards" mixed records and copies | Results line and footer show records and copies; deck summaries say "copies assigned". |
| 8 | Very small mobile text | Tile names 12px (11px under 375px), subtitles/rarity 10px, bottom nav 11px, version/footer 10px, sample label 9px. Fit/overflow and axe checks pass at all five sizes. Physical-phone and large-text review remains recommended. |
| 9 | README pacing said 120 ms | Corrected to 250 ms. |

## Tests

- Unit `tests/unit/collectionSync.test.ts` (2): other-tab delivery, own-tab and malformed messages ignored; a committed save announces its revision, a rejected stale save does not.
- Browser `tests/browser/auditFixes.spec.ts` (3 × 5 sizes): URL/title/reload/Back/overlay/unknown-deck routing; a two-tab stale notice and Load latest; records/copies wording and empty-state copy.
- Updated expectations: deck summary wording (`copies assigned`) in `deckImport.spec.ts`; backup version `0.5.2`.

## Validation results

**Passed:** lint; **272 unit tests**; production build; `TEST_PRODUCTION=1 npm test`: **300 browser tests** across 360×800, 390×844, 430×932, 768×1024 and 1440×1000 (10.8 min); `npm audit`: 0 vulnerabilities; `git diff --check`.

## Still open

- Real iOS Safari/home-screen suspend, quota and eviction behavior need the device checklist.
- Cross-tab notice depends on BroadcastChannel (Safari 15.4+); older browsers still get the visibility check.
- Cloudflare deployment, response headers and live Scryfall availability are unverified from this environment.
