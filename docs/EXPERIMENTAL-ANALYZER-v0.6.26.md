# v0.6.26 — Experimental Synergy Analyzer

## Integration and authorization

The user explicitly approved a dormant merge followed by a limited opt-in browser
analyzer on the existing production origin, without production recommendation
integration or data resets. Limited coverage and no discovered chains are
acceptable if disclosed honestly. This supersedes the earlier dormant-only scope,
not the requirement to abstain on unresolved mechanics.

- Production baseline: v0.6.25 `65be471`.
- Exact reviewed dormant module: `b2bbdeb`. It was fast-forward pushed to main
  first after 1,051 tests and lint/build passed. This step changed no production
  source, scoring, storage, configuration or application version.
- `feature/deck-intelligence` is already merged in the baseline. Older recall and
  Claude branches and the separate Phase 1 review branch remain intact; their
  unrelated changes were not silently merged. Dirty existing checkouts were left
  untouched; feature work is isolated in its own integration worktree/branch.

## Access and behavior

Use the existing site and browser profile:
`https://mtg-manager-app.lhauswirth15.workers.dev`.

**Decks → existing Commander or Legacy deck → Overview → Experimental Synergy
Analyzer → Open experimental analyzer.** Scan supported mechanics reads saved
canonical metadata. Nothing is downloaded, reimported, reassigned or saved.
Standard decks retain their existing behavior; this experimental panel is for
Commander and Legacy only. Main deck and Commander are included; sideboard is not.

For a targeted scenario, expand the scenario selector, choose up to three existing
deck cards, assign hand/battlefield/graveyard starting zones, and explicitly supply
starting mana/library resources. Battlefield cards are assumed untapped and ready;
starting life is 40 each, one modeled opponent, main phase/priority/empty stack and
no intervening responses. Each selected distinct card supplies one hypothetical instance; deck quantities do not automatically add extra objects. These are hypothetical inputs, not estimates of the
actual board or deck's available resources. Unselected cards are excluded from
this scoped experiment, not asserted irrelevant to a real game.

Results show modeled ability counts, unsupported/deferred clauses, missing-data
counts, selected scenario objects, witnessed paths/checks, required participants,
Oracle/rules evidence, gross payoff events and separate terminal holdings. Unknown,
conditional and rejected actions are separated. No chain is a valid outcome.
Parsing is not complete card understanding or an accuracy measurement. A zero-
selection scan compiles metadata only and attempts zero game-state searches.

“Verified within this hypothetical supported subset” is an engine status for a
finite modeled path, not a whole-deck certificate, independent precision claim,
real-game executable line, infinite-loop proof, tournament strength or win rate.
Alternative search limits and incomplete coverage remain explicit.

## Browser compatibility and correctness repairs

The frozen Node research module and manifest remain unchanged. A separately
versioned browser fork replaces Node crypto with synchronous UTF-8 SHA-256.
Identity parity is tested against Node hashes for canonical data, Unicode and
block-boundary lengths. No dependency was added.

Additional sacrifice costs retain the actual Oracle line; payment/death events
cite that cost rather than synthetic cast evidence. Ordinary permanent entries
now carry explicit CR608.3/CR400.7 rules references in addition to any source
Oracle evidence. Rule text is labeled as a rules reference, not an Oracle quote.
Depth exhaustion with further legal modeled actions marks search truncation.
Missing canonical Oracle text and multi-face/special layouts (including token-printing cards) abstain explicitly. Missing-data/layout cache keys cannot reuse a supported blank/normal record after metadata changes; valid normal identities retain Node parity.
The same 89 mechanical regressions also run against the browser fork without
rewriting the frozen original expectations.

The independent correctness targets from the earlier research review remain
unmet. Unsupported combat, delayed/stack interactions, continuous layers,
multiplayer/opponent sequencing and many other rules remain out of scope. The
release does not claim those coverage gaps are repaired.

## Isolation, bounds and data preservation

- Separate module worker and request/revision/version identity. No changes to the
  existing CSV, intelligence or recommendation workers.
- At most 500 distinct input cards / 1 MiB serialized input and result, 3 selected
  participants, depth 3, 200 explored states, 12 branches/proofs, 48 automatic steps.
- Eight-second hard UI deadline terminates the worker. Cancel, close, navigation,
  deck revision change and unmount terminate it; stale responses cannot replace a
  current result. Worker errors/oversize results fail closed without storage writes.
- No persistent analyzer preference, cache or game-state settings. No API calls,
  accounts, paid services or server transmission of deck data.
- Existing database names, database versions, object stores, storage keys,
  collection/deck IDs, quantities, assignments, metadata, concurrency checks and
  backup formats are unchanged. **No schema migration is necessary.**
- Storage/model/Plan Fit/Brew/upgrade/Standard/Legacy source files and deployment
  configuration are pinned byte-for-byte to the production baseline in an added
  integration safety test. Existing golden/protection hash JSON is not refreshed.
- The broad historical prototype guard transparently normalizes only the exact
  newly authorized DeckLibrary import/mount and package-version strings, plus the stale lookup test’s release-version assertion, before
  comparing its old hashes. Every other protected byte must still match. This is
  an explicit activation exception, not replacement of hashes with modified files.

## Validation

- Dormant merge: 1,051 tests / 54 files passed; lint/build passed; production diff
  to v0.6.25 was empty before publication of the dormant commit.
- Integration unit/prototype suite: **1,149/1,149 passed**, 57 files, 17.54 seconds on the final hardened implementation.
- TypeScript production build and lint passed. Existing main-chunk size warning
  remains; no scoring/dependency/security workaround was introduced.
- Focused real-worker browser run: **4/4 mobile-390 passed** in 18.6 seconds.
  Includes an actual same-origin update from built v0.6.25 assets to the .26 app
  for both Commander and Legacy. The same browser context retains the exact saved
  collection/deck/assignment state, database names/versions and localStorage
  values, with no import step. The old build is served under the same test origin,
  then replaced by the new build; this does not test a different preview origin.
- Targeted browser proof uses two synthetic generalized fixture cards, explicitly
  supplied mana and starting zones, and the real module worker. It checks cited
  entry evidence and no saved-data change. Stuck-worker cancel/timeout also retain
  saved state. These are isolated test profiles, not access to the user's device.
- Full browser regression run: **575 passed / 5 failed** (580 total), 24.3 minutes. The five failures are the same pre-existing health-test assertion hardcoded to v0.6.23, one per screen size. It now checks the current package version. After the version-test fix and cache/output-bound hardening, the final analyzer + lookup run passed **35/35** across all five sizes in **1.3 minutes**, including the five corrected cases and all 20 analyzer checks. All 580 distinct browser cases are covered across these runs; this is not a claim of a single final 580/580 run. The Node JSON import in the version test uses an explicit JSON import attribute.
- Production dependency audit: zero findings. Full audit: seven inherited moderate development lint-toolchain findings, zero high/critical; no dependencies changed.

## Deployment

The unchanged Cloudflare Workers configuration builds the SPA and deploys Worker
plus assets to the same existing Worker hostname. No new origin, routes, bindings
or database service is required. A branch preview URL has separate browser storage
and must not be used as a substitute for this same-origin release.

All required local validation is complete; .26 publication is authorized by the user. The environment's
current enforced network policy blocks the live app hostname (fresh CONNECT 403)
and has no Cloudflare credentials. The saved network draft includes the hostname
but has not been applied to this runtime. Git-linked deployment can be triggered
by main publication; a successful push alone is not proof of a completed live
release. Final publication/deployment observations will be recorded explicitly.

Publication: feature commit `a7bf02cc20050e685a1588281adc6d08c8876749` was
fast-forward pushed to main after validation. The remote ref, public GitHub commit
and exact-commit `/public/version.json` confirm v0.6.26 publication. The current
environment still cannot inspect the live app origin; Cloudflare build completion
and physical-device behavior are not asserted as verified. The Git-linked main
build must serve .26 at the existing hostname before hands-on access is confirmed.
