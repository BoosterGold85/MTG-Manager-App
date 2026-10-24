# v0.3.2 — Intelligence Polish & Tagging Accuracy

Baseline: `a377fd4` (v0.3.1). Scope: the user's pasted v0.3.2 request. Existing intelligence architecture, importer reliability and collection management are preserved. No v0.4+ features.

## Exact named-card regressions

Canonical public Scryfall snapshots are stored in `tests/fixtures/intelligence-polish.json`; tests never fetch live card data. Source: Scryfall named-card API, each card's exact English name. Card faces and keyword metadata are retained. The snapshots preserve current Oracle phrasing, including self-references such as “this enchantment”.

| Card | Protected / added tags | Excluded tags |
| --- | --- | --- |
| All Will Be One | Counter Payoff | Enchantments Matter |
| Bruenor Battlehammer | Equipment, Voltron, Cost Reduction | Typal, Eachs Matter |
| Éowyn, Shieldmaiden | Tokens, Card Draw, Typal, Humans Matter, Go Wide | Junk creature types |
| Skullclamp | Card Draw, Death Triggers, Equipment | Sacrifice Payoff |
| God-Pharaoh's Gift | Graveyard, Reanimator, Tokens | Graveyard Hate |
| Leave // Chance | Card Draw, Looting / Rummaging, Discard Outlet, Graveyard | Recursion |
| Doubling Season | Counter Payoff, Token Payoff | Generic +1/+1 Counters, Enchantments Matter |
| Diregraf Colossus | Graveyard, +1/+1 Counters, Typal, Zombies Matter, Graveyard Payoff, Tokens | Junk types |
| Desecrated Tomb | Graveyard Payoff, Tokens | Recursion, Artifacts Matter |
| Ghirapur Orrery | Card Draw, Extra Land Drops, Lands Matter | Artifacts Matter |

God-Pharaoh's Gift's optional Graveyard Payoff was not added: its explicit operation is resource use and token reanimation, not a payoff for graveyard quantity/events. Éowyn's Go Wide is supported by its six-Human board condition, using generic recognized-type count rules.

## Rule changes

- Permanent themes: Oracle's “this artifact/enchantment” self-reference does not establish a theme. Strategic triggers, counts, modification and search interactions remain positive evidence. Own card type remains distinct from meaning.
- Typal: a bundled canonical Scryfall catalog contains 366 creature types, sourced from `https://api.scryfall.com/catalog/creature-types`. Parsed own subtypes, referenced types and actual synergy signals remain separate. Ordinary capitalized words are never subtype candidates. Dynamic taxonomy IDs validate against the catalog. Each/Another/Target/Creature/Permanent/Player/Card are explicitly rejected. Common irregular plurals are handled; multiword/hyphenated type identities come from the catalog. There are no runtime catalog requests.
- Sacrifice: only explicit sacrifice triggers assign Sacrifice Payoff. Generic death still assigns Death Triggers; a qualifying death/drain relationship can remain Aristocrats without falsely implying sacrifice-specific wording. The prior curated death-drain fixture keeps its strong positives and now excludes Sacrifice Payoff, per the requested semantic correction.
- Graveyard: self-exile is excluded from graveyard denial; opponent/targeted/global graveyard exile or restrictions remain hate. Copying a graveyard creature into a token is explicit token reanimation. Self-only cast permission such as Aftermath is Graveyard, not generic Recursion; recovering or replaying other graveyard cards remains Recursion. Optional discard choices are outlets; forced opponent discard is not.
- Mana/tokens: waived equip costs are Cost Reduction. Token copies require an explicit creature-graveyard antecedent. Wide-board conditions use validated creature types rather than a single named-card special case.
- Ruleset version is `0.3.2`: existing cached analysis refreshes through the existing worker/repository flow without re-import. User overrides are preserved, including deliberate manual additions that differ from the corrected automatic result.

## Keywords and optional Oracle search

Implemented. `src/utils/cardKeywords.ts` unions/deduplicates root and face keyword metadata. The searchable Keywords filter matches any selected canonical keyword, shows pressed state/selected count, and combines with strategic ANY/ALL tags, Commander Colors and all previous filters. Card Detail displays Keywords in a separate named section. A synthetic future-keyword fixture verifies the list is metadata-driven rather than hard-coded to the examples. Keywords are not inferred from prose and do not automatically become taxonomy labels.

Card Name remains the default search. Oracle Text and All (name + Oracle) are explicit options; all available faces are searched case-insensitively. Tests find “additional land” on Ghirapur Orrery and “discard any number” on the Chance half. Reset returns to the original default. No broad new data-access/provider architecture or network refresh was added.

Older metadata without keyword fields remains usable, with an explanatory empty-keyword state. Thousands of cached printings are not re-fetched just to populate the new filter. Keyword completeness therefore depends on saved canonical metadata.

## Validation

**Passed:** lint; 196 unit tests; 205 production browser tests across all five approved sizes; production TypeScript/Vite build; dependency audit (0 vulnerabilities); whitespace checks. No skipped tests. Full browser run: 6.5 minutes. This adds 27 unit cases and 20 browser cases to the preserved suite.

Commands:

```sh
npm run lint
npm run test:unit
npm run build
TEST_PRODUCTION=1 npm test
npm audit --cache /workspace/.npm-cache
git diff --check
```

New rule-quality cases protect all named cards, identity versus theme, own type versus payoff, junk rejection, generic death versus sacrifice, self-exile versus hate, self-cast versus recovery, true discard choices, split-face evidence, canonical/future keywords, combined filters/text search and upgrade/override persistence. Existing importer reliability tests include the 4,421-row interrupted/recovered import; they remain unmodified.

New browser workflows run at 360×800, 390×844, 430×932, 768×1024 and 1440×1000. Each size imports all ten real-card snapshots plus a synthetic keyword fixture, inspects every card's expected auto-tags, combines canonical keyword + strategic tag + Commander Colors, exercises Name/Oracle/All search including the back half, checks keyboard operation/axe and captures screenshots.

Full regression coverage includes all prior binder, importer, collection management and intelligence cases. The intentional removal of Sacrifice Payoff from a generic death fixture is paired with explicit positive sacrifice and negative generic-death assertions; no unrelated assertions were dropped. Card tiles now derive their unchanged View/Select names from natural hidden text, with printing/rarity/quantity in their accessible description and visual artwork/metadata presented once to assistive technology. This resolves label-content mismatches on broken-art fixtures without changing tile layout or weakening accessibility checks.

## Files / data boundary

Rule updates: `permanents.ts`, `sacrifice.ts`, `graveyard.ts`, `mana.ts`, `tokens.ts`; subtype/catalog extraction in `creatureTypes.ts`, `subtypes.ts`, `data/creatureTypes.json`; taxonomy validation/descriptions and ruleset version. The 78 built-in strategic tag IDs/categories remain unchanged.

UI/filter additions: `src/utils/cardKeywords.ts`, `filters.ts`, `FilterDrawer.tsx`, `CardDetail.tsx`, `CardGrid.tsx`, `App.tsx`, `app.css`. Version/backup labels and documentation updated. Deterministic snapshots and regression unit/browser files added; one prior curated fixture's expected sacrifice semantics corrected.

`src/import/scryfall.ts`, CSV parsing, `prepareImport`, import preview/confirmation, metadata cache, retry/backoff and the collection repository are unchanged. No schema migration or ownership mutation is introduced. Current keyword/face fields already flow through the existing metadata boundary; backup includes them as before. No new dependencies.

## Remaining limits and deployment

Rules are conservative English-text heuristics, not a full Magic parser. Complex antecedents, unusual count wording, novel creature types absent from the bundled catalog and new self-cast mechanics may need future fixtures. The catalog can be refreshed deliberately in a later release. Missing keyword/face fields cannot be reconstructed from absent metadata; keywords are not guessed. Manual corrections remain available and survive recalculation.

The user's actual collection was not uploaded for this task; evidence uses canonical snapshots of the reported cards and deterministic importer fixtures. Physical-phone hardware is unavailable, so responsive checks use Chromium emulation. No LLM/API tagging, Commander Library, assignments, Deck DNA, recommendations, EDHREC or cloud sync.

Push target: GitHub main. Cloudflare's static build remains `npm run build` → `dist`. Deployment tooling/credentials/public URL are unavailable here; a configured Git integration may deploy after push, but public deployment cannot be verified and is not claimed successful.
