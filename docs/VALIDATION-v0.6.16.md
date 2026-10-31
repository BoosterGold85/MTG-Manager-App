# v0.6.16 validation

Baseline: `919407a`, branch `ranking-v0.6.16`. No frozen Oracle/deck/candidate/expectation/holdout source files were changed. See [ranking report](RECOMMENDATION-RANKING-v0.6.16.md) for metrics, diagnosis, policy, limitations and final recommendation B.

## Commands and evidence

- `npm run lint` — passed.
- `npx tsc -b` — passed.
- `npm run build` — passed. Vite reports the existing >500kB application chunk warning (about 666kB before gzip); no build error.
- `npm run test:unit` — final isolated result recorded below. New ranking reliability coverage includes canonical facts/capabilities/tags parity for all 72 frozen expectations; subtype reuse; inaccessible optional same-name tutors; independent primary effect; sufficient real copies; renamed/negative controls; mandatory hand loss; metadata/version/content cache changes; bounded causality; real seven-card secondary packages; strategic redundancy; one strong edge versus weak overlap and duplicate edges.
- `TEST_PRODUCTION=1 npm test` — full production browser suite, two workers, five viewports: 360×800, 390×844, 430×932, 768×1024, 1440×1000. Final result recorded below. Includes binder navigation, Commander Colors, ownership, assignments, swaps, storage-read recovery and 4,421-row transient import recovery. Chromium emulation is not actual iOS Safari/Android device verification.
- `RECALL_OUT=<path> npx vitest run tests/audit/recall.audit.test.ts` — passed, 12/12 decks, 72 expected occurrences, 379 candidates, zero missing/rejected canonical records. The test throws if evaluation attempts network access. Primary ordering is unchanged.
- `RECALL_HOLDOUT_OUT=<path> npx vitest run tests/audit/recall.holdouts.test.ts` — passed, eleven 100-card frozen decks, offline. Completed after ranking rules were defined; no subsequent holdout tuning.
- `RANKING_ABLATION_OUT=<path> npx vitest run tests/audit/ranking.ablation.test.ts` — passed, four policy variants; report includes exact intervention metrics and per-deck ranking evidence.
- `RECALL_PERF_OUT=<path> npx vitest run tests/audit/recall.performance.test.ts` — final isolated run recorded below. Earlier equivalent policy measured 1.84s/6.22s/8.92s at 1k/4k/6k; fresh synthetic identities cycle 1,401 canonical templates. No real-device performance claim.
- `npx vitest run tests/unit/upgradesGolden.test.ts --update` — generated separate v0.6.16 golden, preserved v0.6.15. Explicit comparison: Build and Improve arrays identical in all twelve fixtures. Main unit suite subsequently checks the generated file without update mode.
- `npm audit --json` — **13 moderate development-toolchain findings**, no high/critical. Root advisory: minimatch globparts amplification, GHSA-g3hv-75wg-m249 (`<11.0.1`), propagated through ESLint/TypeScript ESLint tooling. Audit reports no complete available fix. No forced incompatible dependency override was applied as part of this ranking release.
- `npm audit --omit=dev --json` — **zero production vulnerabilities**.
- `git diff --check` — passed.

An earlier unit run alongside production browsers hit the existing 5s synthetic-candidate timing assertion at 6.49s under contention. Its limit was not relaxed. The full unit suite is rerun alone after browsers finish, and that isolated outcome is recorded below. An initial reporting invocation mistakenly supplied precision labels to the failure-review argument; it failed explicitly, was corrected, and did not alter scoring or any labels. Final reporting separates pairwise precision review from failure classification.

## Deployment

Live URL supplied by the user: https://mtg-manager-app.lhauswirth15.workers.dev . Both ordinary and approved escalated requests previously failed CONNECT 403. The enforced managed network policy still excludes this hostname; adding it to a saved environment draft has not activated it. Runtime inspection shows no Cloudflare credential binding. Therefore the prior main deployment (`919407a`) and the new live deployment cannot currently be verified from this environment. This is an unmet verification item, not evidence that Cloudflare is down or up to date.

The existing Cloudflare Git integration is the intended deployment path after main is pushed. No separate production deployment or credentials are fabricated. `/version.json` now exposes release `0.6.16` for a later live check; compare the served application asset with the production build as well. Main push and live verification status are recorded below. Do not claim successful deployment solely from successful Git push.

## Final results

- **630/630 unit tests**, 38 files; the existing 5s synthetic-candidate timing assertion passes without browser contention.
- **390/390 production browser tests**, five viewports, 16.4 minutes.
- **4/4 offline audit tests**: recall, holdouts, ablation variants, performance. No network-dependent corpus lookup.
- Final cold benchmark: 1,000: **2.31s**, 4,000: **6.44s**, 6,000: **9.45s**. The 6k result meets the 10s acceptable limit; the preferred 8s limit remains unmet.
- Lint, type check, production build, golden review and diff whitespace check pass. Production dependency audit is clean; 13 moderate dev-toolchain findings remain as described above.
- Main fast-forward push is explicitly authorized by the user and occurs after this validation commit. The resulting commit and verified remote SHA are reported at completion. Cloudflare deployment remains **unverified** because live-host access is blocked; no separate deployment was executed.

Final recommendation: **B. ANOTHER RANKING/INTELLIGENCE PASS REQUIRED.** No Brew Score work has begun.
