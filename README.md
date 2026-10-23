# MTG Manager · v0.1.0

A mobile-first, artwork-forward digital Magic binder. Built with React, TypeScript, Vite, modern CSS and Lucide. This release is a front-end prototype with **32 sample printings / 82 owned copies**, not a connected personal inventory.

## Develop

Use Node.js 24 (pinned in `.node-version`) and npm. Node.js 22.12+ is also supported.

```sh
npm ci
npm run dev
```

Vite listens on port 5173. No environment variables, accounts, backend or credentials are needed. All card metadata, card images and fonts are bundled locally. The normal app workflow makes no external API calls.

## Validate

```sh
npm run lint
npm run test:unit
npm test
npm run build
npm run preview
```

Browser tests use `/usr/bin/chromium` in the cloud environment. Elsewhere install a compatible Chromium and set `CHROMIUM_PATH` to its executable, for example `CHROMIUM_PATH=/path/to/chromium npm test`. Playwright starts and stops its own Vite server on port 4173. Avoid running another service there during CI. Run with `CI=1` to require a fresh test server.

Tests cover search, filters, sorting, reset, modal focus/closing, browser back, image failures and navigation at 360×800, 390×844, 430×932, 768×1024 and 1440×1000. Unit tests cover combined filter semantics, data invariants, all sort modes, and absent optional detail metadata. Screenshots and failure traces are written to ignored `test-results/`; an HTML report is in `playwright-report/`.

```sh
TEST_PRODUCTION=1 npm test
```

This runs the same browser suite against the previously built `dist/` using Vite preview. Build first. Reduced-motion preferences are honored; safe-area padding is provided for phones with home indicators. Actual iPhone Safari / physical-device testing remains a release review step.

## Deploy to Cloudflare Pages

This repository started empty; there was no existing deployment configuration to modify. The output is a static site compatible with a normal GitHub → Cloudflare Pages integration:

- Framework preset: Vite
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: repository root
- Node.js: 22.12+ (24 recommended)
- Environment variables / bindings: none

Connect this repository and your chosen production branch in the existing Cloudflare Pages project, or use those settings when creating its Git integration. Cloudflare builds after the code is pushed. No infrastructure, credentials or deployment were created by this build. No deployed URL is claimed. `npm run preview` serves a local production check, not a public deployment.

## Binder behavior

- Search matches names immediately, ignoring case and outer whitespace.
- Quick chips toggle filters. Selected colors match **any** selected identity (including multicolor cards containing that color); types match **any** selected type. Different categories combine with **AND**.
- Drawer edits are drafts until Apply. Cancel discards them. Clear all clears the drawer draft; Reset all above the grid resets applied search and filters in one action.
- Mana limits are inclusive. An inverted range naturally returns no cards.
- Sorting supports name, mana value, W/U/B/R/G → multicolor → colorless, and set code, with alphabetical ties.
- Card details use a native modal dialog: focus stays inside, Escape/backdrop/close dismiss it, and focus returns to the opened card. Browser back closes an open overlay.
- Card Intelligence is explicitly a preview of manually authored sample tags. Commanders is a future-release placeholder.

## Architecture and sample assets

`src/models/` defines prototype records and the collection-source interface. `src/data/sampleCollection.ts` is the asynchronous source boundary; replacing it with a later persistence adapter does not require rewriting the binder. `src/utils/` contains pure filtering and sorting; `src/components/` owns tiles, images, dialogs, details, filters and states. UI state is intentionally in memory.

`src/data/sampleCards.json` contains canonical Scryfall printing IDs and normalized metadata. Each record resolves to `https://scryfall.com/card/<id>` and references cached artwork in `public/cards/`. Tiles use normal-size 488px images; details use 672px images. Images are lazy-loaded with reserved aspect ratios and named fallbacks. Artwork occupies roughly 8.6 MB on disk; the browser only loads visible thumbnails and the opened detail image.

A maintainer can explicitly refresh the sample fixture:

```sh
python3 scripts/fetch-sample-data.py
```

This requires `api.scryfall.com` and `cards.scryfall.io` access. It makes one metadata collection request and downloads missing image files with a polite delay; it is **never** part of app rendering, normal installation, or the production build. Quantities, foil ownership and strategy tags are authored sample data, not a claim about a real collection. No pricing or automated intelligence is present.

Magic: The Gathering card images and text are © Wizards of the Coast. Data and image references are provided by [Scryfall](https://scryfall.com). This project is unofficial and not endorsed by Wizards of the Coast or Scryfall. Bundled fonts are distributed by Fontsource under their included open font licenses; icons are from Lucide (ISC).

See [the implementation brief](docs/v0.1.0-executable.md), [ROADMAP.md](ROADMAP.md), [CHANGELOG.md](CHANGELOG.md), and [validation results](docs/VALIDATION.md).
