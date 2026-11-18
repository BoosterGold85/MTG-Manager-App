# MTG Manager · Brew Lab handoff (2026-11-18)

Start a fresh chat with: "Read AGENTS.md, PROJECT_MEMORY.md and docs/HANDOFF.md, then continue."

## Goal
Make the experimental **Brew Lab** genuinely useful on real decks (test deck: **Reign of Dragons**, mono-red, commander Lathliss, Dragon Queen):
it should automatically find real card-to-card chains among cards you own, explain them, and abstain honestly ("Unknown, not weak") when it can't read a card.
Hard rules (AGENTS.md): read-only. Nothing feeds Plan Fit, Brew Score, rankings, deck edits or storage. Only generalized rules with negative controls, never named-card exceptions. Never tune against frozen holdouts.

## Branches and PRs
| Branch | State |
|---|---|
| `claude/vibrant-davinci-vjqzaw` | All Brew Lab work. Cloudflare preview: https://claude-vibrant-davinci-vjqzaw-mtg-manager-app.lhauswirth15.workers.dev (Lab enabled, lookups working) |
| `claude/fix-scryfall-redirect` | PR [BoosterGold85/MTG-Manager-App#4](https://github.com/BoosterGold85/MTG-Manager-App/pull/4): lookup fix only, for `main`. **Not merged yet.** |
| `main` | No Brew Lab discovery work yet. Live site imports likely still fail (502) until PR #4 merges. |

**Warning:** commit `bb16b56` on the work branch switches `wrangler.jsonc` to `npm run build:brew-lab`. That is branch-only and must **not** be merged into `main`.

## Done
1. **Automatic discovery pass** (`src/experimental/universal/discovery*.ts`, `src/components/BrewLabDiscovery.tsx`). Tests each owned, in-identity, nonland candidate beside the commander and each deck card in an isolated worker (timeout, cancel). Reports only what the combination adds. At most 300 cards per pass, alphabetical.
2. **Card picker** uses the same eligibility: one printing per Oracle card; off-colour cards hidden, with a count.
3. **Removal preview** (`RemovalPreview`). Shows before → after card count straight away. A button compares the selected card's chains with and without the cut card.
4. **Coverage step 1** (compiler `phase4-browser.3`): `{N}, {T}:` costs, `Add {A} or {B}`, self-damage as life loss, combat-only triggers / Cycling / Ward / Equip set aside, type-list and "noncreature" cast triggers.
5. **Lookup fix**: Cloudflare Workers doesn't support `fetch(..., {redirect:"error"})`, so every Scryfall lookup returned 502. Changed to `redirect:"manual"` (from `experimental/synergy-browser`).
6. Report: `docs/brew-lab-discovery-report.md`. Coverage census script: `scripts/coverageCensus.test.ts`.

## Done: creature-type entry trigger (compiler `phase4-browser.4`)
- Reads "Whenever [another] [nontoken] <Type> you control enters, …" (Lathliss's trigger, Dragon's Hoard, Spit Flame, Sarkhan…). Negative controls stay unsupported (changeling, "SELF or another", non-type words).
- Root cause of the 0-proof bug: `discover()` kept only chain events of kinds cast/draw/counter/damage/move/copy/gain-life. A trigger's token arrives as an `enter` event, so it was dropped. Fix (engine.ts): an `enter` counts as a link only when another object's ability caused it (`source !== subject`). A spell's own entry is not a chain by itself.
- `tests/unit/coverageRules.test.ts`: 9/9 pass, including "no loop" (the token does not retrigger) and the Goblin negative control.

## Protected-hash failures (need your decision; NOT refreshed)
1. `wrangler.jsonc`: expected from the branch-only build override (bb16b56). Do not merge it into main.
2. `src/import/scryfall.ts`: the client now reads upstream `details` from the Worker's error body (commit dd7e376; test `lookupTransport.test.ts` pins it). That changes a file whose hash is pinned to main, so `universalRemediated` and `browserUniversalRemediated` fail the byte-for-byte check. Choose one: (a) accept a deliberate hash refresh with this rationale, or (b) revert to main's client and drop that test's detail expectation. Either way it must be an explicit, documented decision.

Last validation (2026-11-18, this commit):
- `npm run lint`: clean. `npx tsc -b`: exit 0.
- `npx vitest run tests/unit tests/prototype`: 1,210 passed, 3 failed (the protected-hash checks above, plus `experimentalAnalyzer` wrangler check).
- Brew Lab browser suite (`VITE_ANALYZER_TEST_HARNESS=1`, `PRE_ANALYZER_DIST` = default build): 10/10 on mobile-390 and desktop.
- Default-gate analyzer browser suite: 10 passed / 20 skipped.

## Reign of Dragons test results (user, on the branch preview)
4 of 300 candidates had chains: Ashnod's Altar (+2 mana, real), plus 3 "noncreature spell cast" pingers (shallow). 276 unreadable; **54 of 61 deck cards unreadable**.

## Next coverage priorities (for this deck)
1. (done) Type entry trigger.
2. "X damage where X is the number of <Type>s you control" (Scourge of Valkas, Dragon Tempest).
3. "<Type> spells you cast cost {N} less" (Dragonlord's Servant, Dragonspeaker Shaman, Nogi).
4. Type anthems "+N/+N", modelled so power changes correctly (Crucible of Fire, Lathliss pump).
5. "Enters with +1/+1 counters" (Dragonstorm Globe, Shivan Devastator); commander-identity mana (Arcane Signet, Commander's Sphere).
Also: let a pass test the next 300 cards, or narrow the candidate list by type/name.

## How to validate
- `npm run lint`, `npx tsc -b`, `npx vitest run tests/unit tests/prototype` (last full run: 1,210 passed, 3 protected-hash failures, see above)
- Default-gate browser suite (must run **without** the harness flag): `CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test -c playwright.analyzer.config.ts --trace off` → 10 pass / 20 skip
- Brew Lab browser suite: `VITE_ANALYZER_TEST_HARNESS=1 CHROMIUM_PATH=/opt/pw-browsers/chromium PRE_ANALYZER_DIST=<default build of HEAD> npx playwright test -c playwright.brew-lab.config.ts --project mobile-390 --project desktop --trace off` → 10/10
- Cloud environment network allowlist now includes api.scryfall.com and the branch preview host.
