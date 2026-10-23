# v0.1.0 validation and handoff

The supplied [executable](v0.1.0-executable.md) defines this release. The repository began with no files, commits or deployment configuration; all application files below are new. No future-roadmap capabilities were implemented.

## Prepared workflow

React + TypeScript + Vite static front end, with 32 sample printings representing 82 owned copies. Real Scryfall artwork and fonts are cached locally. No backend, credentials or network requests are needed for normal browsing. Development was also started and functionally verified on port 5173; the live process is not a deployment.

## Commands and results

Validated with Node 24.19.0, npm 11.9.0 and system Chromium.

| Command | Result |
| --- | --- |
| `npm ci --cache /workspace/.npm-cache` | Passed; clean, lockfile-based dependency installation. |
| `npm run lint` | Passed. |
| `npm run test:unit` | 8 tests passed, no skips. |
| `npm run build` | TypeScript compilation and optimized Vite production build passed; static output in ignored `dist/`. |
| `TEST_PRODUCTION=1 npm test` | 55 browser tests passed across the five viewports below, no skips. Includes axe checks on collection, filter drawer and card detail. |
| `npm audit` | Zero known vulnerabilities, including development dependencies. |
| `npm run dev -- --port 5173 --strictPort` | Started successfully; a separate Playwright smoke verified 32 cards, real artwork, detail open/close, and no page errors against this actual service. |

An explicit Python/Pillow check also verified the integrity of all 64 cached JPEGs (normal and large versions of 32 cards). Scryfall sample generation used `python scripts/fetch-sample-data.py` and is not part of normal startup/build.

Browser coverage includes exact/partial/case-insensitive search, clearing search, no results, color and type filtering, filter + search + sort, multiple drawer filters, cancel/apply/clear, all sort modes, first/last detail opening, explicit/backdrop/Escape/browser-back closing, focus trapping/restoration, long detail scrolling, broken-image fallback, absent sample tags, future Commander state, loading skeletons and reduced motion. A separate unit case renders details with all optional metadata absent. Initial runs exposed focus, accessible-label, contrast and keyboard-scroll issues; these were fixed rather than disabling assertions. Screenshots and accessibility scans wait for the entrance/image transitions to finish.

## Responsive review

| Viewport | Layout and checks |
| --- | --- |
| 360 × 800 | Two-column grid; touch controls, modal and scrolling checks passed. |
| 390 × 844 | Primary phone target; two-column grid, readable drawer, bottom navigation. |
| 430 × 932 | Two-column grid with more artwork space. |
| 768 × 1024 | Four-column grid; desktop shell and bounded card dialog. |
| 1440 × 1000 | Six-column grid; side-by-side artwork and metadata in a bounded dialog. |

Collection screenshots were reviewed at every size. Mobile and desktop detail screenshots and the mobile filter sheet were also reviewed. Automated checks confirm no page-level horizontal overflow, no page/console errors during normal loading, no runtime external requests, image loading, and that the final card can be scrolled above bottom navigation. Safe-area insets and reduced-motion CSS are implemented. Headless Chromium emulation does not establish physical iPhone Safari behavior; a real-device review remains necessary.

Screenshots are generated under ignored `test-results/`; the complete current test report is in ignored `playwright-report/`. Do not commit generated test outputs or `dist/`.

## Files created

| Files | Responsibility |
| --- | --- |
| `src/main.tsx`, `src/app/App.tsx` | React entry, navigation shell, collection header/search/chips/sort, state and browser-back dismissal. |
| `src/components/CardGrid.tsx` | Responsive binder grid, tiles, skeletons and empty state. |
| `src/components/CardImage.tsx` | Reserved image proportions, lazy loading and graceful failure state. |
| `src/components/Dialog.tsx` | Native modal, focus management, Escape and backdrop handling. |
| `src/components/CardDetail.tsx` | Artwork, metadata, oracle text and explicitly curated sample-tag preview. |
| `src/components/FilterDrawer.tsx` | Draft filter controls, apply and clear. |
| `src/models/card.ts`, `src/models/collection.ts` | Prototype data types and replaceable asynchronous collection-source contract. |
| `src/data/sampleCards.json`, `src/data/sampleCollection.ts` | Canonical Scryfall records and local data-source adapter. |
| `src/utils/filters.ts`, `src/utils/sorting.ts` | Pure, independently tested collection operations. |
| `src/styles/app.css` | Visual system, responsive layout, safe areas, motion and focus styles. |
| `public/cards/` | 64 real artwork JPEGs. |
| `public/favicon.svg`, `public/licenses/` | Original app mark and redistributed font/icon license notices. |
| `scripts/fetch-sample-data.py` | Explicit maintainer-only sample fixture refresh. |
| `tests/unit/collection.test.tsx`, `tests/browser/binder.spec.ts`, `playwright.config.ts` | Unit, browser, accessibility and responsive verification. |
| `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `index.html`, `.node-version`, `.gitignore` | Reproducible toolchain, build, lint, app document and generated-file exclusions. |
| `README.md`, `CHANGELOG.md`, `ROADMAP.md`, `docs/v0.1.0-executable.md`, `docs/VALIDATION.md` | Development/deploy instructions, release history, future plan, acceptance source and handoff evidence. |

## Limitations and deployment

- Sample quantities, foil ownership and tags are authored fixtures; inventory and UI state are not persisted. This is intentional v0.1.0 scope.
- Commanders is a clearly marked future-release screen. Imports, accounts, AI, automatic tagging, optimization, EDHREC and all later roadmap features are absent.
- Actual iOS safe-area/Safari and physical-device testing remain unverified; Chromium checks and screenshots are complete.
- The source is deployable as a static Cloudflare Pages site. No existing Cloudflare workflow/configuration was available to exercise, and no public deployment or preview URL was created. README documents the GitHub → Cloudflare settings. Code has not been pushed.
- Reusable `install_script` and `start_skill`, plus optional sample-refresh network domains, were saved to the cloud environment draft. Saving is not publication. Review/save those environment settings and publish the environment to activate its reusable snapshot/configuration; current-instance setup and startup have already been verified.

## Deviations

No functional scope deviations. Local bundled artwork was chosen within the executable's allowed sample-data approach, eliminating runtime Scryfall dependency. Explore was omitted as explicitly optional. The proposed component structure was kept simple, grouping small shell controls in App and tile/states in CardGrid. Deployment and physical iPhone verification are limitations, not claims of completed acceptance work.
