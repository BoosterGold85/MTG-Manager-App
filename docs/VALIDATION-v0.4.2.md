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

**Passed:** lint; **236 unit tests** (228 + 8); production build; `TEST_PRODUCTION=1 npm test`: **260 browser tests** across 360×800, 390×844, 430×932, 768×1024 and 1440×1000 (255 existing + 5 large-import cases, 10.0 min); `npm audit`: **0 vulnerabilities**; `git diff --check`. Existing suites ran unchanged except the backup version string (`0.4.2`).

## Known limitations

- Deck sort/filter choices last for the session, not across reloads.
- Rows are per assigned printing group, so an entry split across two printings appears as two tiles.
- Swipe navigation is not implemented; explicit arrows and keys are.
- Manual tag edits from deck detail are available for owned cards only (same rule as Collection).
- Cloudflare deployment is not verifiable from this environment.

## Release integration and large-import recheck

The release branch `claude/adoring-rubin-mcl0j1` at `da1eb9a` was reviewed and integrated as a fast-forward from `main` at `9dfb0a7`. This retains the v0.4.1 deck-import implementation, the unexpected-card importer fix and all v0.4.2 browsing/deletion commits.

`tests/browser/importReliability.spec.ts` adds one workflow at all five viewports: upload a generated 4,421-row CSV through the real file input, simulate a 503 after 1,800 successful lookups, and return malformed canonical metadata for one printing later in the file. Preview must finish with **4,420 recognized / 1 problem**, not thousands of false problem rows. Confirm, reload, correct the simulated card response and re-import: only that one ID is requested; all **4,421** rows are recognized, **4,420 unchanged / 1 new**, with no remaining problem rows. A third identical import makes **zero requests** and reports **4,421 unchanged**. Successful IDs are asserted not to be requested again. The existing unit regression still verifies interruption at **1,839 / 4,421**, durable-cache resume, full recovery and cleanup of old false problems.

These are deterministic tests with generated CSV data and intercepted Scryfall responses. The original private ManaBox CSV was not supplied, so this is not a claim of testing that exact file or the live service.

Integration validation: **260 production browser tests passed** across all five approved sizes in **10.0 minutes**, with no skips. The targeted mobile importer run also passed both tests. Lint, **236 unit tests**, production build, dependency audit (**0 vulnerabilities**) and `git diff --check` pass on the integrated code.

Cloudflare deployment remains **unverified**. No Cloudflare deployment connector/CLI is configured, and the GitHub commit-status API returns `Forbidden`; a Git-triggered Cloudflare deployment cannot be confirmed from this environment. No v0.5.0 code was added.
