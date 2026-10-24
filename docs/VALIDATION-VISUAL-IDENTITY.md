# Visual identity formalization validation

Baseline: v0.3.2 intelligence polish commit `236d4d3`. The new user directive formalizes the existing binder visual language; it adds no screen redesign or new application behavior.

## Delivered

- Central `src/styles/tokens.css` with the ten requested palette primitives and semantic surface, border, text, accent/hover/soft, danger/soft, focus, selected, disabled, spacing, radius, typography and shadow roles.
- Replaced 224 scattered hex references (190 distinct shades) in `app.css` with shared roles. No literal hex/RGB colors remain in component CSS/TSX. Functional muted mana/rarity colors remain centralized data-marker exceptions. Primary text uses Parchment, not pure white. Muted labels are contrast-lifted where exact Dusty Sage would fail against panels. Rose is reserved for destructive controls.
- Navigation, Collection, search, filters/chips, Keywords, Card Intelligence, dialogs/drawers, management/selection and Remove/Clear consume shared tokens. Existing typography, artwork, layout/density, measurements and interactions are preserved. Selected surfaces remain low-opacity gold on dark panels; existing dark shadow geometry is retained.
- Simple text-free outlined diamond on Obsidian Olive. SVG master/favicon, multi-frame ICO, 16/32/48/180/192/512/1024 PNGs, Apple touch and maskable web manifest references. The icon content fits the maskable safe area. Name remains MTG Manager.
- `npm run icons:generate` derives asset palette and manifest/HTML theme color from tokens using the existing Playwright Chromium toolchain; no dependency added. Ordinary production builds use committed assets. No service worker/offline feature or install prompt flow was added.

## Validation results

**All passed:** lint; 196 unit tests; 215 production browser tests at all five approved sizes; production build; dependency audit (0 vulnerabilities); whitespace checks. No skipped tests. The full browser run completed in 6.4 minutes. Ten new brand/asset browser cases supplement the preserved suite. Icon generation and independent image/ICO decoding also passed.

Commands executed: `npm run icons:generate`, `npm run lint`, `npm run test:unit`, `npm run build`, `TEST_PRODUCTION=1 npm test`, `npm audit --cache /workspace/.npm-cache`, `git diff --check`.

Two new browser cases per viewport verify palette values/focus/selected behavior and accessible controls, plus asset URLs, manifest identity/theme/start scope, Apple touch references, every PNG's native dimensions, SVG without text and all three ICO frame sizes. Existing axe checks cover collection/filter/detail/import/management/intelligence states. Original functionality tests remain intact.

Independent image decoding verified PNG dimensions, opaque RGB(21,23,19) corner backgrounds, and ICO frames {(16,16),(32,32),(48,48)}. No remote artwork was recolored or replaced.

## Geometry and visual evidence

A separate production-browser comparison applied the baseline `236d4d3` CSS against the current DOM and compared bounding boxes for `.app-header`, `.collection-heading`, `.toolbar`, `.search-bar`, `.card-grid`, first `.card-tile`, `.bottom-nav`, and `.app-footer`.

| Viewport | Maximum measured geometry difference | Overflow / page errors |
| --- | --- | --- |
| 360×800 | 0 px | None |
| 390×844 | 0 px | None |
| 430×932 | 0 px | None |
| 768×1024 | 0 px | None |
| 1440×1000 | 0 px | None |

Local QA evidence: `/workspace/mtg-brand-qa/layout-results.json` and screenshots of collection/detail at each width; pre-brand screenshots were retained under `/workspace/mtg-brand-before/`. Browser-run screenshots live in ignored `test-results/`. These are workspace evidence, not runtime product assets. Focus/outline color changes do not alter box geometry.

## Files and limits

`src/styles/tokens.css`, `src/styles/app.css`, `src/main.tsx`; `index.html`, `public/favicon.svg`, `public/favicon.ico`, `public/icons/*`, `public/manifest.webmanifest`; `scripts/generate-icons.mjs`, package script, brand browser tests and design/README/changelog/validation documentation. Version stays v0.3.2, with branding isolated in a follow-up commit. No data-model, importer, tag-rule or collection-management logic changed in this follow-up.

Physical iOS/Android installation and OS icon caching were not available for testing. Metadata/assets are browser-verified; platform-specific install promotion is not claimed. Public Cloudflare deployment remains unverified because no deployment connection or configured public URL is available. Git integration may deploy on push.
