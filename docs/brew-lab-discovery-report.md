# Brew Lab automatic discovery pass — task report

Date: 2026-11-16. Feature commit 7b071f8 (from `claude/commander-brewing-lab-1d7x8y`), validated on `claude/vibrant-davinci-vjqzaw`. No PR, no merge, no deployment.

## Scope

Read-only, opt-in discovery inside the existing Brew Lab. For one candidate card it tests the card beside the commander and each deck card, re-runs without it, and reports only what the combination adds beyond each side alone. Candidates are owned, nonland, inside the commander's colour identity and not already in the deck. Runs in an isolated worker with timeout, cancel and stale-reply guard. Nothing feeds Plan Fit, Brew Score, upgrade ranking, confidence, deck changes or storage.

Files: `src/experimental/universal/{discovery,discovery.worker,discoveryClient,discoveryInput}.ts`, `src/components/BrewLabDiscovery.tsx`, `src/components/BrewLab.tsx` (two mounts), `playwright.brew-lab.config.ts`, `tests/unit/brewLabDiscovery.test.ts` (11), `tests/browser/brewLabDiscovery.spec.ts` (2).

## Validation (2026-11-16)

| Command | Result |
|---|---|
| `npm run lint` | clean |
| `npx vitest run tests/unit tests/prototype` | 63 files, 1,200/1,200 passed |
| `npm run build` (default mode) | passed |
| `CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test -c playwright.analyzer.config.ts --trace off` | 10 passed, 20 skipped (harness/production-gated by design), 0 failed; includes same-origin old/new storage preservation and Lab disabled by default |
| Brew Lab suite (`playwright.brew-lab.config.ts`, earlier run with `PRE_ANALYZER_DIST`) | 10/10 passed, mobile-390 and desktop |

Chromium emulation only; no physical-device test. Not deployed.

## Observed result

Test Tails deck: Aeronaut Admiral + Tails found unprompted ("+1 cards drawn", Tails required, 4 Vehicles), about 2 s for 15 candidates. Unreadable cards shown as "Unknown, not weak".

## Known limits

- Engine coverage is the bottleneck: 38 of 47 deck cards were untestable partners (mana abilities with other unsupported text, Crew, attack triggers, tutors).
- Token-only chains surface only when another trigger fires in the same scenario.
- Unfixed: removal preview shows no visible result; Lab card picker still lists off-colour cards and duplicate printings.

## Follow-up 2026-11-16: picker, removal preview, coverage step 1

**Picker.** The Lab card picker now uses the same eligibility as discovery (`discoveryInput`): one printing per Oracle card, owned nonland candidates, commander colour identity enforced. A note shows how many owned cards were hidden for colour identity. The removal list is also one entry per Oracle card. Owned quantities and assignments are untouched.

**Removal preview.** Before this change, choosing "Without X" only re-keyed the panels below, so nothing visible changed until a rerun. A new `RemovalPreview` panel now shows the hypothetical card count straight away (before → after, copies left out, whether a commander is among them). A button then runs the selected card's discovery on both decks in the worker and lists chains that disappear and chains that lose X as a completing partner. Unreadable partners are reported as Unknown, not absent. The comparison is read-only.

**Coverage step 1** (compiler `phase4-browser.3`, generalized rules only, no named cards):
- Mana/activated costs of the form `{N}, {T}: …` (e.g. Signets).
- `Add {A} or {B}.` as a two-option mana choice; `SELF deals N damage to you.` as life loss.
- Set aside instead of blocking: attack/block triggers for any subject, combat-damage-to-player triggers, and their modal bullets. Combat is never simulated, so these can't fire. Also `Cycling`, `Ward` and `Equip` costs, which only under-report when skipped.
- Cast triggers over type lists ("an Aura, Equipment, or Vehicle spell") and one negated type ("a noncreature spell").
- Negative controls stay unsupported: P/T anthems (they change power, which triggers read), noncombat damage triggers, forced-attack effects, commander-identity mana, modal spells, targeting-cast triggers.

Census (`scripts/coverageCensus.test.ts`; development decks in `tests/data` only, frozen holdouts never read): 438 nonland cards, blocked 398 → 384. Miles Tails deck nonland: fully readable 9 → 17 of 61.

Biggest remaining families, by cards blocked: other spell text (replacement effects, "enters with counters", board wipes, counterspells), other triggers, static anthems/keyword grants (21), cost reductions (14), search-library tutors (15), commander-identity mana (2 on Miles).

### Validation

| Command | Result |
|---|---|
| `npm run lint` | clean |
| `npx vitest run tests/unit tests/prototype` | 65 files, 1,208/1,208 (adds `brewLabPicker` 2, `coverageRules` 6) |
| `npm run build` | passed |
| `CHROMIUM_PATH=… npx playwright test -c playwright.analyzer.config.ts --trace off` | 10 passed, 20 gated skips, 0 failed |
| `VITE_ANALYZER_TEST_HARNESS=1 CHROMIUM_PATH=… PRE_ANALYZER_DIST=<default build of 7b071f8+docs> npx playwright test -c playwright.brew-lab.config.ts --project mobile-390 --project desktop --trace off` | 10/10 passed |

Note: Brew Lab browser tests need `VITE_ANALYZER_TEST_HARNESS=1`; the analyzer suite must run without it, since it checks the default gate. Chromium emulation only.
