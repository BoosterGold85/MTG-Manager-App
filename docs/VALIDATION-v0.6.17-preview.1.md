# v0.6.17-preview.1 — manual-testing preview

The user requested publishing the current work to main for testing. This preview exposes the completed worker integration. It is **not the completed v0.6.17 Real-Deck Generalization pass**. No generalization, downside or package-priority scoring fixes are claimed. Ranking and semantic versions remain unchanged from v0.6.16; no new Brew feature is implemented.

## Changes available to test

- Recommended Build/Improve analysis, including its existing relationship scores, runs in a module worker.
- Search, filters, expansion and scrolling operate on complete worker results. They do not trigger another analysis.
- Changing goal/deck or leaving the workspace terminates the pending worker. Request IDs, content revisions and an effect-lifetime guard reject stale responses.
- Previous results are shown only within the same deck and goal, clearly marked updating. Old results remain non-actionable until fresh results arrive, including when refresh fails. Retry is available after an error.
- The worker has no storage/repository writer or network client. Existing atomic app actions remain responsible for ownership and assignments.
- All ten blind source exports and canonical records are preserved for future offline evaluation. Zada replaces Feather; Feather is excluded. The candidate pool and expectations are hashed before any blind ranking run.

## Validation

- `npm run lint`: passed.
- `npm run build`: passed, including TypeScript. Existing main-bundle size warning remains (~667kB; worker ~243kB before compression).
- `npm run test:unit`: **635 passed**, 40 files. Includes worker parity/cloneability/no saved-data mutations, cancellation/stale/wrong-revision responses, errors/retry, and frozen ten-deck source/hash/canonical coverage.
- `RECALL_OUT=<path> npx vitest run tests/audit/recall.audit.test.ts`: passed offline. All twelve constructed top-20 candidate names, orderings and ranking scores match v0.6.16 exactly. Previously measured metrics remain 75% obvious recall, 83.3% hidden recall, 100% trap rejection, desk precision 79.2%@10 / 71.7%@20; these are not new real-deck measurements.
- `TEST_PRODUCTION=1 npm test`: **395 passed**, all five approved viewports, 16.9 minutes.
- Added production-browser coverage starts a real worker with 3,000 fresh candidate identities, types into search, changes availability, expands a control and changes goal while analysis remains pending. It asserts one worker (no reanalysis on controls), cancellation and no stale candidate list after goal change. Interaction artifact records elapsed control time. The focused 390×844 run passed before the full suite.
- `npm audit --json`: 13 moderate development lint-toolchain findings, no high/critical (existing minimatch advisory propagation).
- `npm audit --omit=dev --json`: zero production vulnerabilities.
- `git diff --check`: passed.

## Known limitations and remaining work

The new blind holdouts have **not been ranked**. Real-deck precision/recall, general downside recognition and generic-engine crowding work remain unfinished. Do not treat this preview as proof that the documented Isshin/Sythis/Kwain/Giada issues are resolved. No Brew readiness gate is passed.

A 3,000-candidate test proves specific interactive controls remain usable during background work; it is not physical iPhone/Safari testing or a new 6,000-candidate latency benchmark. Per-card details, Saved candidates and Swap Review still perform smaller synchronous computations. Worker startup and structured-cloning large inventories also incur main-thread overhead. The complete v0.6.17 responsiveness/performance audit remains pending.

## Deployment

The existing live address is https://mtg-manager-app.lhauswirth15.workers.dev . The current enforced environment policy excludes that hostname, and no Cloudflare credential binding is configured. The GitHub main push can be verified; Cloudflare build/deployment and live content cannot currently be verified here. A successful push alone does not prove deployment. `/version.json` identifies this preview as `0.6.17-preview.1`, with `rankingVersion: 0.6.16`.

## Full browser outcome

**395/395** full-suite production browser cases passed across 360×800, 390×844, 430×932, 768×1024 and 1440×1000. The added failure/retry regression then passed separately across all five viewports (`TEST_PRODUCTION=1 npx playwright test tests/browser/recommendation.spec.ts -g "failed refresh"`): **5/5**. Total distinct cases covered: **400**. The retry test injects one worker error after a saved-state revision, verifies old Saved/Review Swap buttons remain disabled, retries successfully and verifies no further stored collection/deck changes. No production code changed between these two runs.

An additional unit regression covers a full imported deck's Improve payload: nonempty upgrade results, structured-clone safety and unchanged ownership/assignments. The complete unit suite is rerun after that addition. Main publish is explicitly authorized by the user; the commit SHA and verified GitHub remote status are reported at completion. Live Cloudflare content remains unverified for the reason above.
