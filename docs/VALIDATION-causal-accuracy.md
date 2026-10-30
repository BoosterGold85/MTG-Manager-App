# Recommendation causality patch

Baseline: `main` at **339b7e2**, v0.6.14. This patch preserves the current site and its existing Brew lens; it does not merge the older unpublished v0.6.9 research prototype. The older prototype's 41.7% hidden-gem / 16.7% obvious recall figures are not measurements of v0.6.14 and must not be presented as current production accuracy.

## Confirmed defects and corrections

1. **Self-only counters counted as external suppliers.** The old shared counter regex accepted Adapt, Evolve, Outlast, enters-with counters, proliferate and counter doubling indiscriminately. Eight self-only creatures could therefore appear to support counter-triggered recursion on a different card. The new helper distinguishes actual placement on a compatible recipient from self-only placement. A candidate can still count its own Adapt as one setup source. Receiving counters, replacements, doubling and proliferate are not initial placement sources. A global observer still sees self-only counter events on compatible creatures, while another-card recipients cannot borrow them. Target restrictions, opponent effects, mass placement, entry placement, moving counters, multi-target placement and distribution are handled conservatively. Unknown qualifiers do not default to any creature.
2. **Supply-cache contamination across recipient types.** Counter predicates now encode recipient type and self/board scope in their key; an artifact-creature-only source cannot be reused as evidence for an ordinary creature. The tests query both conditions through the same index.
3. **Blink credited for someone else's entry.** The previous `[^,]{0,40}` pattern accepted “Whenever another creature enters” as this card's own ETB. A self-entry matcher normalizes the card/face name and requires its own entry subject, retaining ability words and the “this creature or another…” case. Reverse-face-only entry text is not assumed repeatable by blinking the front.
4. **Low-confidence candidate labeled Hidden Gem in a confident deck.** The displayed label now uses the combined card/deck confidence already reported by the result, rather than deck confidence alone. A candidate cannot simultaneously say Low confidence and Hidden Gem.

No scoring weights or bands were changed. Expected scores/rankings may change where prior evidence was invalid; the existing production golden upgrade fixture remains unchanged. CONDITION/BREW implementation versions are now 1.0.1.

## Data safety and scope

All changes are to pure derived scoring. No storage repository, schema, collection quantities, decklist entries, assignments, import/sync behavior or metadata persistence changed. No database is cleared and no re-import is required. No card-name scoring conditions, live lookups, popularity/price provider, new tab, new feature or v0.7.0 work was added. The site/package remains v0.6.14; this is a focused patch, recorded under Unreleased in the changelog.

## Validation

- `npm run lint`: passed.
- `npm run test:unit`: **544 passed**, including **18 new** causality regressions. Existing storage recovery, 4,421-card importer, synchronization, ownership, Commander Colors and upgrade golden tests remain green.
- `npm run build`: passed. Existing Vite large-chunk advisory remains; it is not a build failure.
- `npm audit --json`: **0 vulnerabilities**.
- `AUDIT_OUT=/workspace/accuracy-holdout-final.json npx vitest run tests/audit/holdout.audit.test.ts`: ran the current real-card holdout corpus, **13 of 14 semantic checks pass**. H3/Breya still omits Artifacts from its primary plan, the same known limitation already documented in v0.6.12. It is not hidden by the audit test runner's successful exit. [Complete results](causal-accuracy-holdout-results.json).
- Evolution Witness still leads the A3 counters/recursion holdout at Brew 81, with the Counters → Graveyard bridge. Existing positive/negative calibration tests pass without rewriting their thresholds.
- `CI=1 TEST_PRODUCTION=1 npm test`: **390 passed** across 360×800, 390×844, 430×932, 768×1024 and 1440×1000 (Chromium mobile emulation/tablet/desktop). The Brew flow additionally checks that its supplier explanation excludes the old self-only/replacement examples and that inspecting/sorting/filtering recommendations leaves saved ownership and decks unchanged.

## Limits

This is not a full Magic rules engine. Supply counts compatible cards, not guaranteed activation frequency, board state or target quality. Counter amplifiers are conservatively omitted as initial enablers; a future bounded dependency model can credit them only after a real seed is established. Complex unrecognized target restrictions may be undercounted. The holdout corpus is not independent human sign-off or a measured accuracy rate across all player decks. Physical iPhone/Android testing and a genuinely distinct 4,421-card real collection are not claimed here.

Deployment must be reported separately: a GitHub push does not establish that Cloudflare completed deployment. No Cloudflare credentials are configured in this environment.
