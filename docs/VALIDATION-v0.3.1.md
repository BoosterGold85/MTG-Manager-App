# v0.3.1 — Urgent importer reliability patch

Baseline: `9d441b0` (v0.3.0). This fixes the v0.2.x importer layer on current main; it does not downgrade or extend Card Intelligence.

## Root cause and correction

Previously, `/cards/collection` failures were caught inside each 75-identifier batch and copied into every row's `Resolution.error`. The resolver then continued to subsequent batches, so a prolonged service interruption could turn thousands of valid UUIDs into fake Problem Rows. Metadata was copied into the session cache only after the entire resolve call. Network/timeouts/5xx were not retried; 429 waits were capped at five seconds, potentially violating Retry-After.

Now:

- Genuine per-card errors remain distinct from service failures. A missing UUID in a successful response must appear in the explicit `not_found` identifiers to be treated as unknown; truncated/unexpected results interrupt instead. Search 404 responses require a Scryfall error object with code `not_found`.
- Timeouts, 429, 5xx, HTTP 408, network/CORS and response-reading failures receive up to four sequential attempts, with exponential backoff (1, 2, 4 seconds between attempts by default). The final failure also retains its cooldown before manual retry. Retry-After supports seconds and HTTP dates and is never shortened by a five-second cap. Other unsuccessful collection HTTP statuses interrupt without creating card errors.
- Default start spacing is 250 ms, at most four requests/second before response latency; 429 increases spacing to 500–2,000 ms. This is per-client pacing, not a claim of coordination across browsers/devices.
- Each successful batch/search checkpoints normalized canonical metadata immediately in session memory and a separate IndexedDB cache. Exact-name proof mappings are cached only after authoritative successful matching. Cache writes never contain inventory, CSV sources, purchase data or quantities. Cache write/read failure leaves session matching available and does not modify the collection.
- A recoverable `LookupInterrupted` reports resolved CSV rows and total lookup rows. No import plan/preview/confirmation is exposed while lookup is incomplete. Retry unresolved retains the parsed file and reruns matching with successes skipped; previous successful batches are never fetched again. Closing/reloading requires selecting the CSV again, but durable positive lookup metadata survives. Confirmed per-identifier negatives can also be reused within the same resolver session.
- Cancellation aborts the current fetch and backoff. Retry-After cooldown remains effective on the same client even if retry is clicked immediately.
- Existing import previews remain write-free for ownership. Collection changes still require confirmation and use the same atomic, revision-checked repository. Public metadata caching is independent of collection clearing; browser site-data clearing removes both.

## Regression evidence

The deterministic 4,421-row fixture contains valid unique Scryfall IDs, with 39 pre-cached cards. Twenty-four 75-card batches succeed (1,800 more cards), then the next batch repeatedly returns 503. Lookup throws an interruption at **1,839 / 4,421**, not 2,582 row errors. After recreating the resolver using the durable cache, only the remaining 2,582 identities are fetched. All 4,421 resolve, zero Problem Rows remain, and the collection has exactly 4,421 records. Total requests: 59 successful batches + four failed attempts = 63. An additional re-import performs zero network requests and reports 4,421 unchanged records.

The same fixture reconstructs a previously committed partial collection with 1,839 records and 2,582 stale transient problem rows. A complete recovered import retains the 1,839 untouched records, adds the 2,582 missing records, and clears the stale problems. No automatic changes occur until the resulting plan is confirmed.

Additional unit cases cover 429/500/503/network/timeout recovery, full Retry-After seconds/date handling, exponential backoff and adaptive pacing, malformed/incomplete/404 collection responses, explicit unknowns versus invalid UUIDs, fallback-search interruptions, cancellation and session recovery when durable cache writes fail. Existing network-as-problem assertions were corrected to require interruptions; the unknown-card fixture now supplies a real per-identifier `not_found`. No true unknown-card coverage was removed.

A browser flow at every approved size uploads 76 actual CSV rows, receives 75 successes then a repeated 503, verifies no preview/Confirm import/fake Problem Rows, retries only the final identifier, confirms 76 records and reloads/re-imports without requests or duplication. The original file and sample/owned collection remain unchanged until confirmation.

## Validation

**All passed:** lint; 169 unit tests; 185 production browser tests across 360/390/430/768/1440px; production TypeScript/Vite build; dependency audit (0 vulnerabilities); whitespace checks. No skipped tests. Full browser run: 5.2 minutes. This adds 10 unit regression cases and five browser cases to the preserved suite.

Commands: `npm run lint`, `npm run test:unit`, `npm run build`, `TEST_PRODUCTION=1 npm test`, `npm audit --cache /workspace/.npm-cache`, `git diff --check`.

The release does not include the user's actual CSV; the 4,421-row reproduction is deterministic simulated public metadata, not a claim of testing that private file or live sustained Scryfall availability. A continuing outage still requires retry later. Positive lookup caches can be stale and are not an ownership backup. If browser cache persistence is unavailable, same-session recovery works; closing the page may require refetching unconfirmed matches. Physical mobile hardware was not available.

## Changed areas and publication

`src/import/scryfall.ts`: error classification, pacing/backoff, interruption and checkpointing. `src/storage/scryfallCache.ts`: separate public metadata cache. `src/components/ImportCollection.tsx`: retained parsed input, interrupted state and Retry unresolved. Unit/browser regression files and version/documentation updates. No intelligence rules, ownership schema, synchronization identity or destructive-management behavior changed.

GitHub main is the publication target. Cloudflare integration may deploy after push, but this environment has no authenticated deployment connection or configured public URL, so deployment remains unverified.
