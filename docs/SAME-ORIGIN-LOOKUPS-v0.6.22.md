# v0.6.22 — Same-Origin Lookup Reliability

## Evidence and scope

Real iPhone screenshots show legality stopping after 1,991/4,265 printings and a collection preview stopping after 1,689/4,497 rows with Safari's `Load failed`. The importer correctly stopped before confirmation, retained cached successes and did not convert the unqueried rows into invalid cards. Repeating the operation still encountered an opaque transport failure.

The user subsequently reported that the existing retry path recovered after three attempts, consistent with retained successes rather than a damaged CSV.

Both workflows used direct browser-to-Scryfall requests. Safari's message alone does **not** establish a particular CORS, HTTP 429, timeout, server or connectivity cause. This patch removes the browser's cross-origin API dependency and makes upstream failures readable HTTP responses. It cannot guarantee network availability or claim the phone's exact root cause has been reproduced.

## Implementation

- `src/import/transport.ts` maps the default client's canonical URLs to `/api/scryfall` on the existing app origin. All collection/deck lookup, explicit legality and strict selected-printing confirmation paths use this transport. Injected test clients retain their deterministic fetchers. Artwork URLs remain unchanged.
- `worker/scryfall.ts` relays only POST `/cards/collection` (1–75 identifiers, 64 KiB maximum input), GET `/cards/search` (bounded query and allowed uniqueness options), and GET `/sets` to the fixed HTTPS Scryfall host. Unknown paths, methods, parameters, inventory fields and cross-site origins are rejected. No arbitrary destination or redirects are permitted.
- The relay sends an identifying User-Agent and Accept header. Browser cookies, authorization and other incoming headers are not forwarded. It does not store CSVs, inventory, ownership or accounts, and adds no database binding. Only public matching identifiers/names/set information reaches Scryfall.
- Upstream network failures return JSON 502; the 15-second upstream deadline returns JSON 504. Canonical JSON, HTTP statuses, actual legality and Retry-After are preserved. Responses use `no-store`, so fresh legality checks cannot accidentally reuse edge-cached verdicts. The route's GET `/health` reports configuration/version only; it is not an upstream availability probe.
- The existing client still performs sequential 75-identifier batches at least 250 ms apart, exponential backoff, Retry-After handling and slower pacing after 429. The relay performs one upstream attempt per browser attempt; it does not multiply retries. Durable metadata checkpoints and remaining-only retry remain in place.
- `worker/index.ts` serves the API before asset fallback and delegates other routes to `ASSETS`. `worker/dev.ts` provides the same handler for Vite dev/preview. `wrangler.jsonc` deploys this Worker and the existing SPA assets together. HTML from an assets-only API route produces a controlled service-unavailable error and blocks import confirmation.

## Preserved boundaries

No ownership, assignment, source CSV fields, IndexedDB schema or revision/CAS logic changes. No database clearing, recreation, copy movement or collection re-import is required. No Commander, Standard or Legacy formulas, thresholds, scoring versions or frozen expectations change. Browser metadata fixtures are moved to the same-origin URL; their expected card lists/scores remain intact. The ten blind v0.6.17 holdouts remain unranked.

Wrangler 4.156.2 is pinned as development tooling. The lockfile adds its dependencies/platform entries; comparison against the parent lockfile finds **zero existing dependency version upgrades or removals**. Generated `.wrangler` output is ignored by Git and ESLint.

## Validation

- `npm run test:unit`: **683/683 passed**, 46 files, 18.45 seconds on the final logic. Includes the existing importer/storage/legality recovery and protected Commander checks.
- `CI=1 TEST_PRODUCTION=1 npm test`: **525/525 passed** in **21.8 minutes**, one full production-preview run at 360×800, 390×844, 430×932, 768×1024 and 1440×1000. All prior 510 browser cases remain; the transport adds 15 cases.
- Three additional mobile browser checks against the **actual local Workers runtime and built assets** passed **3/3** in 5.2 seconds: health/rejection routes, multi-batch same-origin import and assets-only fail-closed behavior. External metadata is mocked for the browser import case; this does not claim successful live outbound access from workerd.
- Final lint, production build, Worker dry-run packaging and `git diff --check` passed. The existing main-chunk size warning remains.
- The frozen offline twelve-deck recall audit passed. All **240 top-twenty positions/names/Brew/Synergy scores** match v0.6.16; all **27 protected Commander source hashes** match. No frozen corpus or Legacy expectations were edited.
- Dependency audit: **zero production vulnerabilities**; the full audit reports **12 moderate development lint-toolchain findings**, zero high/critical. No existing dependency versions were upgraded or removed.

- Added ten deterministic unit cases covering bounded routing, credential stripping, canonical legality and not-found, encoded names/sets, 429/Retry-After, upstream network/HTML/timeout, cancellation, static fallback, absent-service failure, and **4,497-row collection plus legality resolution** through the actual relay handler with a transient upstream failure. Direct external browser API requests are rejected in this simulation.
- Added three browser cases at all five existing sizes: running same-site service/configuration and invalid-request JSON, a three-batch import with direct external API access blocked, and an assets-only deployment failing closed without replacing the binder.
- Live read-only lookup through the local Vite same-site handler, using Node 24 with `NODE_USE_ENV_PROXY=1` and the environment's approved proxy/CA trust: HTTP 200, exact Sol Ring printing with actual Legacy-banned status, plus confirmed not-found for a valid-form unknown UUID. This checks real Scryfall response transport, not the production edge or physical phone.
- **Exact user-uploaded CSV**, tested in a fresh isolated Chromium mobile context against live Scryfall through the local same-site handler: **4,497 recognized rows, 4,496 new records, one combined duplicate row, zero problem rows**, **6,122 owned copies**. The file contains 4,273 distinct valid UUID-shaped IDs. Preview completed in **157.35 seconds**: 57 successful collection batches plus two HTTP 429 attempts recovered by the existing backoff policy (59 requests total). No browser request went directly to the Scryfall API. Confirming and reloading retained the same counts; repeating the file produced **4,496 unchanged records, zero new/updated/problem records and zero additional lookups**. These writes occurred only in a disposable test browser, not the user's device. The private CSV, metadata and purchase/binder data are not committed. This is a successful real-file local integration test, not an iPhone or deployed-edge test. The observed 429s do not establish the phone's original failure status.
- The local Workers runtime serves health/version JSON, deep SPA assets, unknown-API JSON 404 and invalid-batch JSON 400. With this environment's sidecar-only network configuration, its outbound attempt returned a controlled JSON 502. This is recorded as a local-runtime outbound limitation, not a successful edge/Scryfall integration test.
- Both `wrangler deploy --dry-run` and `wrangler deploy --assets=dist --dry-run` bundle the Worker and ASSETS successfully without publication or credentials.

## Publication, deployment and device acceptance

The user authorized publication to `main`. GitHub publication and Cloudflare deployment must be reported separately. This environment has no Cloudflare credentials and its enforced network policy does not allow the live Workers hostname; deployed-edge verification is unavailable here.

Cloudflare Workers Git builds should use `npm run build` followed by `npx wrangler deploy` (or the existing `npx wrangler deploy --assets=dist`) from the repository root. The checked-in `wrangler.jsonc` supplies the Worker entry and assets binding. A static-only `dist` upload is insufficient. Keep the existing `mtg-manager-app` Worker/site origin so the user's browser retains its saved collection.

After the build, verify `/version.json` **and** `/api/scryfall/health` both identify **0.6.22** and the latter returns JSON with `transport: "same-origin"`, rather than the HTML app. Then test the original iPhone on that origin: retry unresolved collection lookups, inspect the preview before committing, resume unverified/stale legality checks, and confirm saved copies/decks are unchanged. A health response alone does not verify upstream connectivity; a successful lookup is also needed. No collection reset or export re-import is a prerequisite.
