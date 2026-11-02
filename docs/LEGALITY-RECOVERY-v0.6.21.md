# v0.6.21 — Legality Recovery & Upgrade Quick Reading

## Report and cause

The reported message, “Could not finish the legality check. Saved data is unchanged. Retry when connected,” came from the constructed Upgrades check. It fetched all batches before one metadata save and caught every failure with that same message. A network/service interruption, incomplete batch, malformed record, confirmed not-found, or changed identifier could therefore discard the successful earlier lookup results from the UI's check. Only already verified comparison candidates remained visible; eleven was not a hard cap.

The prior screen also used comparison eligibility as its entire browse catalog: lands, cards at the copy limit, cards needing mana changes and severe-effect cards were omitted. Unverified cards were hidden after an unsuccessful check. This further narrowed what the user could read. The device's exact failed request/eleven-card breakdown was not available, so this release does not claim a confirmed HTTP status or device-specific cause.

## Legality check behavior

- Collection-wide checks use a new per-batch path, with at most 75 unique IDs and the existing pacing, exponential backoff and Retry-After handling. Strict `refreshLegalities` remains unchanged for live selected-printing confirmation and the existing Overview check.
- Each successfully normalized canonical answer is checkpointed in the public Scryfall metadata cache. A run retains completed answers in memory, saves their legality fields through one revision-checked collection transaction when it finishes/pauses/stops, and reports progress. It never changes owned quantities, assignments, purchase/binder fields or decks.
- A transient batch failure leaves unresolved IDs pending; it does not mark cards illegal. **Retry remaining cards** reuses completed results from that run and requests only unresolved IDs. An incomplete HTTP-200 batch retains valid answers and leaves missing IDs pending while other batches can continue.
- Confirmed not-found, incomplete individual records and a fully answered batch with changed/unexpected identifiers appear under **Lookups needing attention**. Their owned records and saved metadata are retained. No printing or legality is guessed. Other printings continue to be checked.
- **Check unverified / stale only** uses saved format statuses within the existing seven-day policy to resume after reload. **Check owned-card legality** starts a full fresh check when there is no interrupted run. This lets users explicitly choose whether to reuse saved snapshots or recheck everything.
- **Stop check** keeps completed results while mounted. Navigating away aborts the request and avoids inventory writes after unmount; public metadata checkpoints remain cached. Retry of a failed metadata save retains the lookup results but still uses the current revision guard. No IndexedDB clearing or collection re-import is required.
- The lookup's original error is retained in the run result and a collapsed Last lookup error details section; the primary UI uses a recoverable message rather than raw DOMException text. A failed lookup is not equivalent to a nonlegal card.

## Browse and read

Standard/Legacy Upgrades now distinguishes:

1. **Legal in this format** — all recently verified legal owned printings, including browse-only lands, mana-review, severe-effect and copy-limit records.
2. **All owned cards** — also includes unverified/stale and nonlegal records, labeled explicitly. This remains useful when disconnected or a legality check pauses.
3. **Ready to compare** — the previous eligible comparison pool, with its existing filters/weights unchanged. Unavailable owned copies can still be compared hypothetically but cannot be assigned.

The status line separates format-legal count, comparison-eligible count, filtered shown count and total owned records. Interesting Brews, availability, search and ranking remain explicit filters. Thirty rows render initially; Show more and whole-catalog search have no eleven-card cap. Browse-only cards receive no fabricated score and no Compare action.

Artwork buttons and Read open the existing Card Detail, using saved canonical Oracle text, actual ownership, tags and deck usage. Previous/Next follows the current full filtered/ranked list, including rows beyond the rendered page. Closing preserves the search/sort/filter state and focus. Reading makes no collection writes or Scryfall API calls; uncached artwork may still need its image host. No Commander-context scoring is added to constructed detail.

## Preserved boundaries

Commander recommendation/UI sources and all protected hashes remain unchanged. No frozen Commander corpus or Legacy expectation was changed. Standard and Legacy formulas, thresholds and scoring versions remain 0.1.0; Commander ranking remains 0.6.16. The constructed result adds exclusion explanations; it does not loosen comparison gates.

Live same-printing format verification before confirmation, availability checks, combined-board copy limits, the 60-card main-deck requirement and atomic CAS writes remain enforced. Sideboard advice, mana-base swaps, automated moves, accounts and new intelligence work remain outside scope. These changes do not establish blind recommendation quality or competitive calibration.

## Validation

- `npm run test:unit`: **673/673 passed**, 45 files, in 12.87 seconds, run separately from browser emulation. Eight new unit cases cover a deterministic 4,421-printing interruption after 150 successes and complete recovery without repeating them, isolated missing/malformed/changed identifiers, incomplete HTTP-200 responses, 429/Retry-After pacing, stop/cancel preservation, unchanged strict confirmation, browse-only gates and saved-status resume after reload.
- `TEST_PRODUCTION=1 npx playwright test`: **505/505 passed** in 20.0 minutes across 360×800, 390×844, 430×932, 768×1024 and 1440×1000. Includes all 480 existing cases plus 25 recovery/reading cases. Tests prove real artwork buttons open shared detail, offline saved-rule reading, filtered Previous/Next, persistent view state, no read-time API calls/writes, no ownership/deck changes, partial status persistence, remaining-only retry, browse-only gates and whole-catalog pagination/search.
- Added an explicit reload-resume browser case. On the final source, `TEST_PRODUCTION=1 npx playwright test tests/browser/upgradeRecovery.spec.ts tests/browser/upgradeResume.spec.ts` passed **30/30**, including all five reload cases. Together the runs cover **510 distinct browser cases**, not a single 510-case full run. Card Detail has zero automated Axe violations and no horizontal overflow at the tested sizes.
- After the final diagnostic/copy changes, targeted legality/Standard/Legacy/format/protection/capture unit checks passed **39/39**. Final `npm run lint`, `npm run build` and `git diff --check` passed. The existing main-chunk warning remains.
- `RECALL_OUT=/workspace/legality-recall.json npx vitest run tests/audit/recall.audit.test.ts`: passed offline. All twelve Commander decks retain identical top-twenty names, order, Brew and Synergy scores (240/240 positions) versus v0.6.16. All 27 protected source hashes pass. Frozen Commander files and existing Legacy expectations remain unchanged; the ten unranked blind holdouts were not evaluated.
- A live read-only Scryfall `/cards/collection` smoke returned HTTP 200, one exact existing printing with its actual Legacy-banned status, one confirmed not-found for a valid-form unknown UUID, and CORS `*`. This checks public endpoint/response shape from this environment, not the user's phone connectivity.
- `npm audit --omit=dev --json`: zero production findings. Full `npm audit --json`: thirteen inherited moderate development lint-toolchain findings, zero high/critical; no dependency changes.
- Chromium emulation and saved-data integration tests are not physical iPhone/Android or installed-PWA validation. Blind recommendation quality, network availability on a particular device and Cloudflare deployment remain separate unverified concerns.

## Publication and deployment

The user's existing main-publication instruction applies to this hotfix. Remote GitHub SHA is verified after pushing. Cloudflare remains unverified from this environment: the Workers hostname is excluded by enforced network policy and no Cloudflare credentials are configured. The served `/version.json` should identify **0.6.21** after deployment. A main push alone is not proof of a completed site deployment.
