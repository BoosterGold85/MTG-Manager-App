# v0.4.2 — Deck Browsing & Card Navigation

Baseline: `9dfb0a7` (v0.4.1 ManaBox Deck Import plus the importer reliability fix, now **Approved**). v0.4.2 is **Current**. No Deck DNA, synergy, theme filters, price sorting or other v0.5.0 work.

## Architecture

- `src/decks/deckBrowse.ts` (pure): `deckRows` builds browsable rows. There is one row per assignment (exact printing group with real ownership) and one row per decklist entry's unassigned remainder (canonical card, no ownership). `sortDeckRows`, `filterDeckRows` and `visibleDeckRows` produce the single sequence used by both the grid and Previous/Next. `deckCardAnalysis` reuses saved collection intelligence when current. Otherwise it analyzes an unowned canonical card once per identity/ruleset/fingerprint and caches it in memory.
- `src/components/CardDetail.tsx`: the shared component gains optional `deck` context (a Deck entry section, and "Ownership: Not currently owned / Owned elsewhere" instead of "In your binder" for unassigned rows) and optional `navigation` (sticky Previous / position / Next bar and arrow keys). Without these props, Collection rendering is identical. Content swaps in place; the dialog stays open; scroll resets per card; Card Intelligence and artwork remount per card so state never leaks.
- `src/components/DeckLibrary.tsx`: sort/filter controls, a unified artwork grid with only the active-sort metric, and commander detail without navigation. Manual tag edits use the existing collection save path for owned cards.
- Sort defaults to Card Type → Mana Value → Name. Type groups use the front face: Creature, Instant, Sorcery, Artifact, Enchantment, Planeswalker, Battle, Land, then Other. Color orders mono WUBRG, then multicolor by size and combination, then colorless. The final tie-break is Name A–Z, then set, collector number and row key.

## Tests

- Unit (`tests/unit/deckBrowse.test.ts`, 8): assigned vs. unassigned rows; no fabricated ownership; owned-elsewhere counts; missing-card intelligence analyzed once; Name, Mana Value, Card Type, Color and Set sorts; deterministic order for reversed input; type/ownership/name filters forming the visible sequence.
- Browser (`tests/browser/deckNavigation.spec.ts`, 3 × 5 sizes):
  - Full detail (Oracle text, Card Intelligence, Keywords, Deck Usage, assigned printing); Next/Previous on the same open dialog element; arrow keys; boundaries; missing card ("Physical assignment: None", "Not currently owned", no binder quantity); Axe and overflow checks; Escape.
  - Card Type, Name A–Z and Mana Value High → Low navigation orders; type and ownership filters controlling sequence and position.
  - Commander detail without navigation; unchanged Collection detail.

## Validation results

**Passed:** lint; **236 unit tests** (228 + 8); production build; `TEST_PRODUCTION=1 npm test`: **255 browser tests** across 360×800, 390×844, 430×932, 768×1024 and 1440×1000 (240 + 15, 7.9 min); `npm audit`: **0 vulnerabilities**; `git diff --check`. Existing suites ran unchanged except the backup version string (`0.4.2`).

## Known limitations

- Deck sort/filter choices last for the session, not across reloads.
- Rows are per assigned printing group, so an entry split across two printings appears as two tiles.
- Swipe navigation is not implemented; explicit arrows and keys are.
- Manual tag edits from deck detail are available for owned cards only (same rule as Collection).
- Cloudflare deployment is not verifiable from this environment.
