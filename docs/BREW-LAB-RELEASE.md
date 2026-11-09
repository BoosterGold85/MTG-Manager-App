# Brew Lab: limited developer release candidate

This supersedes the earlier research-only rollout priority. The user explicitly
accepts low coverage and incomplete independent adjudication for a read-only,
provisional comparison. No independent correctness gate is marked passed and no
required mechanical predicate is relaxed. No deployment, merge or activation is
authorized by this document.

## User-visible deliverable

Existing deck → Upgrades → Brew Lab → Open Brew Lab → choose a saved deck card or
owned upgrade candidate. Commander and Legacy use the existing application's deck
and collection, not a second database or import. The panel shows existing Plan Fit
and Brew values and the existing explanations. When the existing Legacy candidate
catalog has no eligible score, the panel explicitly reports that instead of making
one up. Commander Plan Fit uses the existing deck-relative Synergy/fit scorer.

The same candidate is preselected for mechanical analysis; choose up to two
partners, starting zones and resources. Inspect named dependencies, prerequisites,
source clauses, actual resource costs, gross payoffs and net holdings. Candidate
searches are scoped to that card; unrelated chains are not presented as evidence
for it. Current supplied mana defaults to zero and is always hypothetical.

All displayed successful findings are **provisional mechanical evidence**. The
core retains its strict internal Verified requirements, but the interface does
not claim independent proof. Unsupported clauses are Unknown, not negative value.
Zero discovered chains is not evidence of no synergy. Coverage, deferred mechanics,
uninterpreted clauses and search bounds are displayed. Whole-deck strategy,
assembly probability, win rate and numerical Brew Score 2.0 remain unclaimed.

Removal of a participant reruns the bounded engine and reports affected/surviving
paths. The context selector also supports a hypothetical replacement by excluding
a deck card (all copies) and making the selected candidate available instead.
Reset the selector to compare against the original context. Existing production
scores remain the original baseline, not a claim of the replacement's value.
Entry-linked and older assignment-only decks are supported by the ephemeral
projection. No projection is saved. Close the Lab to terminate its worker and
return to the regular application.

## Release controls and rollback

- Normal `npm run build` keeps execution disabled.
- `npm run build:brew-lab` produces an opt-in developer release candidate. Its
  explicit `brew-lab` build mode permits read-only execution with provisional
  labels, without asserting independent adjudication has passed. It is not yet
  deployed. There is no persistent enablement key or URL bypass.
- A same-origin deployment is required to access existing browser-local decks.
  A branch-preview hostname does not share that data. No schema, storage key,
  collection, assignment, deck ID, scoring module or recommendation ranking changes
  are part of this release.
- Roll back by serving the previous approved assets on that same origin. No data
  migration or reversal is needed. Browser tests exercise baseline → developer
  candidate → baseline and compare every database/store/key/value, localStorage
  and sessionStorage, including unrelated sentinels.

## Review and verification

The original Upgrades components and protected scorers are byte-identical. Brew
Lab mounts alongside them in DeckLibrary. Existing frozen hashes are not refreshed;
the production-boundary helper recognizes only the exact new UI import/mount and
build-command insertion. Every other protected byte remains checked. Worker
limits, request/response validation, stale-reply rejection, termination and failed
required-check rejection are retained. The new protocol version invalidates stale
transport identities.

Run:

```sh
npm run lint
node node_modules/vitest/vitest.mjs run tests/unit tests/prototype
npm run build:brew-lab
TEST_PRODUCTION=1 PRE_ANALYZER_DIST=/absolute/approved-baseline/dist npx playwright test -c playwright.brew-lab.config.ts --project=mobile-390 --project=desktop
npm run build
TEST_PRODUCTION=1 PRE_ANALYZER_DIST=/absolute/approved-baseline/dist npx playwright test -c playwright.analyzer.config.ts --project=mobile-390 --project=desktop
```

The Brew Lab browser tests compare displayed scores with the original functions,
exercise named chains/payoffs, dependency removal, context exclusion, close,
cancel/timeout, and full update/rollback storage snapshots. Public/synthetic test
profiles are not the user's private Tails, Jackal or Carnage decks or an iPhone
Safari test. A final same-origin phone smoke check with those saved decks is still
required after the specific release is approved. Earlier browser failures were a
case-sensitive assertion (`Net life` versus rendered `net life`); the observed
chain itself executed correctly. A frozen UI-source check caught the initial
mount; moving the mount into DeckLibrary preserved the original Upgrades source.

Final developer-build results: 1,189 unit/prototype tests in 62 files passed;
all six mobile-390/desktop Brew Lab browser tests passed; the normal-production
UI/worker gate and storage suite also passed six checks (six intentional skips
for execution-only tests); TypeScript, ESLint and
build checks passed (existing large-chunk warning remains). These are Chromium
runs, not a physical iPhone/Safari certification. Exact logs and the new source
freeze are in `research/browser-adapter/brew-lab/`; the earlier freeze and
regression artifacts remain historical and unchanged. For an outside-deck
candidate, interpretation coverage includes one hypothetical candidate copy.

Implementation self-review checked read-only inputs, selected-card provenance,
identity/removal handling, stale replies and unchanged score paths. Independent
human PR approval has not been recorded; this remains a draft for review.

## Smallest remaining steps to hands-on testing

1. Review this exact PR revision and its browser/storage evidence.
2. Obtain separate user approval to merge and deploy this developer build to the
   existing application origin. Do not deploy a normal build and expect the Lab
   to execute; the approved artifact must use the explicit build mode above.
3. Confirm saved Tails/Jackal/Carnage decks and assignments remain intact on the
   phone, open Upgrades/Brew Lab, inspect a card, cancel/close, and return normally.
   The environment has previously received proxy HTTP 403 for the live hostname;
   do not substitute a claim of live verification for the local same-origin tests.

Low coverage and independent adjudication remain limitations, not prerequisites
to exposing this explicitly limited developer comparison. They remain gates for
stronger correctness claims and future numerical scoring.

## Path to Brew Score 2.0

Use this visible comparison to identify missing reusable mechanics. Next measure
net resource payoffs and Synergy Surplus against isolated-card baselines, then
Transformative Fit through enabled capabilities, then Marginal Deck Value through
removal/replacement counterfactuals. Independently validate those measurements
before introducing a separately labeled experimental numeric ranking. Keep the
current production Brew Score authoritative until a separately approved change.
