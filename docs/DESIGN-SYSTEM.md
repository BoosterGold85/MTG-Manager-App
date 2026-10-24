# MTG Manager visual identity

The approved direction is a premium digital Magic binder: understated, collectible, archival, dark, warm and editorial. This formalizes the existing UI, not a rebrand. The product remains **MTG Manager**. Artwork is the visual center; interface chrome should support it.

## Source of truth

`src/styles/tokens.css` owns all interface color primitives, semantic roles, typography families, spacing, radii, shadows and interaction-state tokens. `src/main.tsx` imports it before component styles. `src/styles/app.css` contains no hard-coded hex/RGB colors. Component styles consume roles rather than inventing their own near-identical shades.

| Palette primitive | Value | Use |
| --- | --- | --- |
| Obsidian Olive | `#151713` | Application background / icon field |
| Panel Charcoal | `#1D201A` | Panels, drawers, dialogs, inputs |
| Elevated Surface | `#232720` | Raised controls, evidence cards, overlays |
| Soft Border | `#34382F` | Quiet structural boundaries |
| Parchment White | `#F4F1E8` | Primary text; no pure-white UI text |
| Muted Sage | `#9DA39A` | Secondary text |
| Dusty Sage | `#7A8478` | Subdued decorative/status base |
| Antique Gold | `#D0C098` | Brand accent / existing compact primary actions |
| Highlight Gold | `#D8B058` | Focus, important selected/interactive highlights |
| Muted Rose | `#B57C72` | Destructive actions only |

Dusty Sage is retained as the exact primitive, but by itself has insufficient normal-text contrast on the panel/elevated colors. `--text-muted` mixes 85% Dusty Sage with 15% Parchment for readable functional labels; `--text-subtle` retains the exact Dusty value for decoration. Danger text receives a small parchment lift too. Do not override these with low-contrast component-specific values.

Magic mana identity and rarity colors are functional data markers, not extra brand accents. Their existing muted values are centralized separately (`--mana-*`, `--rarity-*`); artwork itself is never recolored.

## Semantic roles

| Concern | Tokens |
| --- | --- |
| Background / surfaces | `--background-app`, `--surface-panel`, `--surface-elevated`, `--surface-hover`, `--surface-overlay` |
| Borders | `--border-soft`, `--border-subtle`, `--border-strong`, `--border-accent` |
| Text | `--text-primary`, `--text-secondary`, `--text-muted`, `--text-subtle`, `--text-on-accent` |
| Accent | `--accent`, `--accent-hover`, `--accent-soft` |
| Destructive | `--danger`, `--danger-text`, `--danger-soft` |
| Focus | `--focus-color`, `--focus-width`, `--focus-offset` |
| Selection | `--selected-surface`, `--selected-border`, `--selected-text` |
| Disabled | `--disabled-opacity`, `--text-disabled` |
| Shadows | `--shadow-lift`, `--shadow-badge`, `--shadow-dialog`, `--shadow-artwork`, `--shadow-navigation`, `--shadow-indicator`, `--shadow-selection` |
| Typography | `--font-body` (DM Sans), `--font-display` (Libre Caslon Display), `--font-symbol` |
| Spacing | `--space-4`, `--space-8`, `--space-12`, `--space-16`, `--space-24`, etc.; `--space-section`, `--space-control-x`, `--space-control-y` |
| Radius | `--radius-control`, `--radius-panel`, `--radius-dialog`, `--radius-circle`; exact optical values such as `--radius-7` |

Existing 1px optical adjustments and all prior spacing/radius measurements remain available as numeric tokens. Do not round the existing layout to a new spacing scale during unrelated work. New surfaces should normally use the shared semantic radius/spacing aliases. Compatibility aliases `--surface`, `--border` and `--muted` keep established styles readable.

```css
.panel {
  color: var(--text-primary);
  background: var(--surface-panel);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-panel);
  padding: var(--space-section);
}
```

Use gold sparingly: a focused control, selected chip edge, small icon or existing compact primary action. Never use it as a large panel/page background. Selected surfaces mix only 8% accent into a dark panel; accent-soft is a 5% transparent tint. Keep shadows dark and quiet; do not add gold glows, saturated gradients, fantasy frames or new ornamentation. Destructive rose belongs to Remove/Clear controls, not ordinary navigation or status decoration.

## Current application coverage

Navigation, Collection headings/counts, search/scope/sort controls, filters and chips, Keywords, Card Intelligence/evidence/editor, dialogs/drawers, selection bar, collection management and destructive actions all consume shared roles. Focus uses Highlight Gold, including a keyboard ring around the combined search field. Disabled controls share opacity. Typography, artwork, dimensions, density, breakpoints, spacing, rounded shapes, safe areas and all functionality remain the approved design.

## Temporary app icon and installation metadata

The icon is the existing diamond idea reduced to Antique Gold outline on opaque Obsidian Olive. No text, naming change, extra emblem, baked-in iOS rounding or major logo work. The centered diamond fits the maskable safe circle.

Assets:

- `public/favicon.svg` and `public/icons/app-icon.svg`: scalable master mark.
- `public/favicon.ico`: PNG-compressed 16/32/48 frames.
- `public/icons/icon-16.png`, `icon-32.png`, `icon-48.png`: small browser assets.
- `public/icons/icon-180.png`: Apple touch / iOS home screen.
- `public/icons/icon-192.png`, `icon-512.png`: web/PWA icons; 512 is also maskable.
- `public/icons/icon-1024.png`: future thumbnail/source export.
- `public/manifest.webmanifest`: MTG Manager name, same-origin start/scope, standalone display, theme/background colors and icon references.

`index.html` references SVG/ICO/PNG favicon, Apple touch icon and the manifest; theme color matches the application. Installation metadata adds no service worker, offline cache, account or application feature. Actual installation prompts depend on browser/platform/HTTPS policy; offline operation is not promised.

Regenerate assets after changing the two icon palette primitives:

```sh
npm run icons:generate
```

The maintainer script reads the colors from `tokens.css`, renders the SVG with the existing Playwright Chromium dependency, builds ICO frames, and updates the manifest/HTML theme color. Set `CHROMIUM_PATH` if needed. Generated outputs are committed; ordinary production builds need no icon renderer or new dependency. Static HTML/manifest/SVG/PNG colors necessarily embed values, but they are generated from the same token source.
