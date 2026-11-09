# Browser adapter engineering report

Latest product milestone: [Brew Lab developer release](../../docs/BREW-LAB-RELEASE.md).
The report below describes the preceding frozen research/adapter revision.

Base: main `a3c20b374dd457de1903a9a3b1ab9a61d1ff3523` (v0.6.26).
This extends the already merged browser fork; the original research engine,
evaluation labels, production scoring and storage modules are unchanged.

**Decision: keep production execution disabled.** Local engineering gates passed;
independently adjudicated correctness and proof quality have not been established.
This branch is not deployed, merged or released. It does not change the live site.

## Delivered

- A separate, bounded browser-worker client. It clones inputs, terminates workers
  on cancellation, supersession, unmount, timeout and failure, and rejects stale
  versions/revisions, malformed replies and unresolved required checks.
- Limits: 500 distinct cards, 1 MiB request/response envelopes, 8 second deadline,
  three participants, depth three, 200 states per search, 12 branches/proofs and
  48 automatic steps. Counterfactual runs rebuild both searches, at most 400
  total states. Candidate indexing has separate 64-context/4,000-comparison caps.
  Truncated output is explicitly incomplete; finishing does not imply exhaustive
  rules coverage.
- Resource payment evidence for mana, tap, counter, sacrifice, discard and life,
  with pre-transition object identities, exact Oracle/printed-cost sources and
  a terminal reconciliation check. Resolution choices are distinguished from
  action costs. Gross payoff events and terminal net holdings are separate.
- Required legality checks are distinguished from false optional branch outcomes.
  Token creation, permanent-spell resolution and zone-return rules receive
  different citations. Unsupported source layouts abstain as Unknown before
  deriving legality from a combined type line.
- Generic targeted destruction/exile, including controller life from last-known
  power, and draw/put-back with ordered known library identities. Returning to
  library is not discard; anonymous cards cannot become invented enablers.
- A semantic producer/consumer pair and relay-triple candidate index. It uses
  interpreted effects/events rather than names, partners, archetypes or desired
  payoff labels. Every surfaced path is executed by the strict core. Redundant
  mana-to-cast candidates are skipped when supplied mana already pays the cost.
- Read-only UI with hypothetical placements, prerequisites, proofs, costs, net
  resources, unsupported/deferred cards, copy-weighted coverage and fresh
  counterfactual removal. No numerical synergy, strategy verification, win rate,
  recommendation or whole-deck claim is generated.
- Production UI and worker both refuse execution. The test override requires a
  development build and `VITE_ANALYZER_TEST_HARNESS=1`; URL/storage settings cannot
  enable a production build. Formal rollout gates remain pending review.

## Evidence and limitations

The preserved **exposed** regression corpus has 318 cases (104 positive, 214
negative). Inputs and labels are copied byte-for-byte into `regression-data/`;
their original research checkout remains unchanged. Input SHA-256:
`a3a5db1a79ddee9f27b3fc7461169b70350fafc1c4276195e503271abd8bc820`.

| Measure | Result | Descriptive 95% Wilson interval |
| --- | --- | --- |
| Supported-claim precision | 42/42, 100% | 91.6–100% |
| Mechanical recall | 42/104, 40.4% | 31.5–50.0% |
| False positive on negative cases | 0/214 | 0–1.76% |
| Autonomous discovery on positives | 41/104, 39.4% | 30.6–49.0% |
| Unknown/abstention | 110/318, 34.6% | Not a supported-claim success |

There are 62 missed positives, 160 explicit Invalid rejections and zero
Conditional predictions in this particular pack. All misses remain in
`results/regression-failures.json`; none are removed from the denominator.
Cases are clustered by family and previously exposed to development. These
intervals do **not** establish accuracy on unseen interactions, and the precision
lower bound does not establish a 95% population-precision guarantee.

The structural proof audit found zero issues in 194 observed Verified outcomes
(61 unique): required predicates, causal-parent closure and exact Oracle-line
fidelity. This is not independent adjudication of the semantic accuracy of those
proofs. Independent explanation accuracy remains null. Returning Unknown for an
unsupported MDFC is intentional; it does not constitute a coverage gain.

### Complete public decks in real browser workers

Thirty unfiltered public lists: ten 100-card Commander decks and twenty 60-card
declared Legacy decks. Public source URLs and all canonical metadata are retained
in `public-decks.json`. These are not the user's saved decks; format legality was
not newly adjudicated. No collection data was exported or imported.

The same corpus and denominator were used for coverage before/after this branch:

| Copy-weighted nonland coverage | Merged main | Generic removal expansion | Plus ordered draw/put-back |
| --- | --- | --- | --- |
| Commander | 53/633 (8.4%) | 57/633 (9.0%) | 57/633 (9.0%) |
| Legacy | 76/760 (10.0%) | 92/760 (12.1%) | 104/760 (13.7%) |

The added fully parsed cards in this corpus are Swords to Plowshares (4 Commander,
16 Legacy copies) and Brainstorm (12 Legacy copies). Interpretation is based on
generic Oracle clauses; neither card name is matched. Coverage means no
unsupported noncombat clauses, not complete understanding. Deferred combat may
remain. Saved type lines containing Land are excluded from this denominator;
special layouts are explicitly reported. This corpus differs from earlier Phase
4 coverage samples, so those older percentages are not a direct baseline.

Both desktop and mobile-390 Chromium runs found **30 paths in 6/30 decks**, across
39 attempted hypothetical contexts; four decks hit a search bound. Results agree
across those two runs. Each context contains only two/three cards with supplied
mana (six of each symbol) and a 40-card library; this is not an actual opening
hand, legal assembled game state, assembly probability or whole-deck proof.

Examples from the actual worker output:

- Birds of Paradise in hand + Beast Whisperer on battlefield: pay {G}, cast
  creature, draw one, creature enters. Net hand zero, creature +1, mana G −1.
- Etali, Primal Storm in hand + Garruk's Uprising on battlefield: pay {4}{R}{R},
  enter with sufficient power, draw one. Deferred attack mechanics are not used.
- Wall of Omens + Prosperous Innkeeper: creature entry produces draw and life;
  net hand zero, creature +1, life +1, mana W −1/C −1 under supplied resources.
- Ashnod's Altar + Elvish Mystic: sacrifice the actual creature, record death,
  produce {C}{C}. Net creature −1. This conversion is not automatically beneficial
  or evidence of Synergy Surplus.

Median/max end-to-end per-deck worker times were **120.95/236.70 ms** on mobile
emulation and **126.65/247.60 ms** on desktop. Renderer lifetime RSS high-water was
270.4/281.0 MiB respectively; this includes app and workers and is **not isolated
worker peak heap**. Both are Chromium on this host, not physical-device or
cross-browser benchmarks. Stored resources were unchanged after every full run.

### Verification

- TypeScript application and research checks, ESLint, production build and diff
  whitespace checks passed. Build retains the existing large-chunk warning.
- Unit/prototype suites: **1,184 tests across 61 files passed**. This includes
  original frozen production-boundary checks and browser-core regressions.
- Local QA browser suite: **10 passed, 2 intentionally skipped** across desktop
  and mobile (the production-only gate test is skipped in development).
- Production browser suite: **6 passed, 6 intentionally skipped** (execution-only
  QA tests are skipped when production gates are closed).
- Same-origin baseline-to-branch update checks compare complete application
  state, every IndexedDB database/store/key/value, localStorage and sessionStorage,
  including an unrelated database sentinel. Commander/Legacy deck assignments and
  collections survive without reimport. No storage schema or key changes exist.
- Earlier QA work had one desktop stuck-worker test fail because the open panel
  disappeared. Its cause was not conclusively established; shared Vite caches
  were a suspected contributor. The unchanged test passed in isolation and in
  the final full suite after separating QA/research caches. The failure log is
  retained, not converted into a pass. A broad `vitest run` invocation mistakenly
  collected Playwright suites and was stopped; the explicit unit/prototype command
  above is the applicable completed suite.

## Exact blockers before first safe in-app execution

1. **Independent correctness/proof gate:** freeze this revision, collect genuinely
   unseen cases and labels from an independent rules adjudicator, then score once.
   Preserve the agreed ≥95% supported-claim precision target and zero false Verified
   claims in the dedicated negative gate. There is no newly independent label set
   or adjudicator available in this session. Do not describe the exposed pack or
   public-worker load test as blind validation.
2. **Limited scope/usefulness:** only 9.0%/13.7% nonland-copy coverage. Strategy,
   transformative value and whole-deck conclusions remain blocked. Review the
   first experimental rollout as a supported-subset inspector, not a deck-quality
   analyzer; validate representative actual saved Commander/Legacy decks before
   claiming usefulness. Unsupported stack, opponent, layers, delayed timing,
   special layouts and modal mechanics must continue to abstain.
3. **Review and deployment:** review source/freeze/evidence, record gate decisions,
   and authorize a same-origin deployment to the existing main application URL.
   This branch has not been deployed. Changing hostnames or using a branch preview
   accesses a different browser-storage origin and is not an acceptable substitute.
4. **Live/device smoke check:** the current environment's HTTPS CONNECT to
   `mtg-manager-app.lhauswirth15.workers.dev/api/health` is rejected with HTTP 403.
   The live hostname and the user's browser-local decks were not verified here.
   After approved deployment, verify update/open/cancel/removal with the user's
   saved decks on that same origin, and compare storage before/after.

No import or migration is required for an approved same-origin update. Plan Fit,
Brew Score, upgrade rankings, recommendation worker, collection data paths and
deck-assignment storage are unchanged. Synergy Surplus, Transformative Fit and
Marginal Deck Value remain future work; no numerical weights are introduced.

## Most effective next coverage work

The captured unsupported clauses provide priorities, not permission to approximate
rules: special-layout face semantics (32 copies), prowess/cast triggers (21),
equipment/attachment costs and state (39 equip-clause occurrences), modal choices
(18), and stack targeting/counterspells (17). These need reusable representations
and adversarial tests. Alternative costs, mass damage and modular also recur.
Equipment/layers and stack interactions are substantial semantic gaps; adding a
keyword to the parser without executing its rules is not coverage. Continue
conservative abstention while expanding these families.

## Reproduce / hand off

```sh
npm ci
npm run lint
npm run build
node node_modules/vitest/vitest.mjs run tests/unit tests/prototype
node research/browser-adapter/run-regressions.mjs
npx tsc --noEmit -p research/browser-adapter/tsconfig.json
```

To reproduce the storage update test, extract baseline commit `a3c20b3` into a
separate directory, install/build it, and pass its `dist` directory:

```sh
VITE_ANALYZER_TEST_HARNESS=1 ANALYZER_TEST_HARNESS=1 PRE_ANALYZER_DIST=/absolute/baseline/dist npx playwright test -c playwright.analyzer.config.ts --project=mobile-390 --project=desktop
TEST_PRODUCTION=1 PRE_ANALYZER_DIST=/absolute/baseline/dist npx playwright test -c playwright.analyzer.config.ts --project=mobile-390 --project=desktop
node research/browser-adapter/compare-coverage.mjs /absolute/baseline
```

Install Playwright Chromium first if missing. The QA override must not be used as
production activation. Public-deck results are runtime measurements and are
overwritten on rerun; preserve a copy before subsequent experiments. The frozen
exposed inputs/labels are regression material, never a new holdout.
