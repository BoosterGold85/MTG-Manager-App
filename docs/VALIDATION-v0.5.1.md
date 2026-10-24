# v0.5.1 — IndexedDB / Deck Import Reliability Hotfix

Baseline: `747327f` (approved v0.5.0 Deck DNA Core). This patch changes storage connection recovery and deck-import ownership verification only. No new Deck DNA or other product functionality.

## Root cause

`IndexedDbCollectionRepository` cached a resolved `Promise<IDBDatabase>`. An explicitly closed or browser-invalidated connection could remain behind that promise, and a caller that had already obtained the promise could resume with a closing connection even after another callback invalidated the cache. Transaction creation then threw `InvalidStateError`, which escaped as raw browser text. There was no database `close` invalidation or bounded recovery of transaction creation.

Deck import used the parent's collection state directly. The Decks parent supplied `state || emptyCollection()`, so an unavailable initial collection read could look exactly like legitimate zero ownership. Card parsing/lookup could succeed and produce a 100-Missing preview with confirmation enabled despite never verifying the saved inventory.

## Recovery and safety

- One shared transaction-start helper obtains the cached connection, attempts to create the transaction, and catches only closing/invalid-state creation failures. It invalidates that connection, closes it best-effort, reopens the same database and retries **once** (two transaction-start attempts total).
- Only transaction creation is replayable. Once requests start, neither an abort nor an uncertain write outcome is automatically replayed. Save still checks the current revision and writes the whole snapshot inside the same readwrite transaction, resolving only on commit. A stale write remains rejected after reconnection.
- Database `close` and `versionchange` invalidate the matching cached promise. A late event or rejection from an older connection cannot clear a newer cached connection. A caller holding the old resolved promise is covered by the transaction-start recovery. Concurrent recovery callers share the new open.
- Requests and handlers are started synchronously after transaction creation, with no extra await in between. Read results are returned only on transaction completion; an aborted read is not accepted as an ownership snapshot.
- Repeated failure becomes a controlled MTG Manager storage error. Its `cause` retains the technical exception for diagnostics/tests. Closing detection uses structural error name/message rather than relying on cross-realm `instanceof Error` behavior.
- Deck import always loads a fresh verified collection snapshot before resolving ownership, including on retry. Only a successful `null` load means genuinely absent saved inventory. A rejected read never becomes an empty collection.
- Each attempt clears old preview/choices and marks ownership unverified. A read failure hides the ownership summary and rows, leaves Confirm import disabled, shows an actionable MTG Manager message and provides **Retry ownership check** / Cancel. The source text/file contents remain in memory. The confirm handler also checks verified ownership and preview phase.
- Preview and confirmation use that same verified snapshot/revision; existing repository concurrency checks still protect against another tab changing inventory after preview.

No database deletion, clearing, schema upgrade, collection recreation, automatic re-import or ownership reset is performed. Existing decks, source metadata, manual corrections, collection records and Deck DNA behavior remain intact. A normal save/import changes only its authorized snapshot fields.

## Tests added

Nine deterministic unit tests in `tests/unit/storageRecovery.test.ts` cover:

1. Cached connection closed before load; fresh load succeeds and cache is reused.
2. Cached connection closed before save; one successful write and unchanged revision protection.
3. Concurrent callers holding an old resolved promise reopen safely.
4. Close/versionchange invalidation and a late old close after replacement.
5. Persistent load failure stops after two attempts with controlled message and original cause.
6. Persistent save failure stops after two attempts and preserves the prior snapshot.
7. A failure after transaction creation is never replayed.
8. Cross-realm/error-shaped InvalidStateError recovery.
9. Another tab's newer revision is still rejected after reconnecting, with zero stale writes.

Two browser workflows in `tests/browser/storageRecovery.spec.ts` run at all five approved sizes (10 cases):

- A 100-card ManaBox deck import with existing inventory and a saved deck: persistent collection-read failure produces no ownership/Missing summary and disabled confirmation; restoring storage and Retry reconciles four actually available exact owned copies instead of reporting 100 Missing. Failure, preview and Cancel leave the entire saved snapshot unchanged.
- Closing connections on the first readonly transaction and first save transaction: automatic recovery completes the normal preview and commits exactly one new deck/one revision. Existing deck contents, owned quantities and canonical metadata remain unchanged.

The preserved suite includes the v0.3.1 interrupted lookup/recovery tests, the 4,421-row CSV regression, v0.4.x allocations/deck imports/browsing and v0.5.0 DNA. Existing backup-version expectations are updated to the patch version; no prior functional assertions are weakened.

## Validation

**Passed:** lint; **270 unit tests** (261 preserved + 9 recovery cases); production build; **285 production browser tests** across all five sizes (275 preserved + 10 recovery cases), with no skips, in **11.1 minutes**; dependency audit (**0 vulnerabilities**); and `git diff --check`. After finalizing controlled native write-error messages, all 270 unit tests and **40 focused production browser tests** (storage recovery + collection management across five sizes) passed again, along with lint, build and audit. The initial targeted 360px recovery workflows also passed.

```sh
npm run lint
npm run test:unit
npm run build
TEST_PRODUCTION=1 npm test
npm audit --cache /workspace/.npm-cache
git diff --check
```

Sizes: 360×800, 390×844, 430×932, 768×1024 and 1440×1000. Browser failure injection uses Chromium plus deterministic fake IndexedDB unit tests; this is not a claim of physical iPhone testing.

## Deployment

The validated v0.5.1 hotfix is committed and pushed to GitHub `main`. Cloudflare status is unverified: no Cloudflare deployment tooling is connected and the GitHub commit-status API returns `Forbidden`. A successful local build or Git push does not prove a Cloudflare deployment.
