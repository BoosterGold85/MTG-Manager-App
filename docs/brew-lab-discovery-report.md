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
