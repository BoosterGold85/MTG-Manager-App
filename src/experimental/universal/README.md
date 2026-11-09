# Browser experimental mechanical engine

Browser fork of the frozen `research/universal-remediated` module merged as
`b2bbdeb`, from production v0.6.25 `65be471`. The research source/manifest remain
unchanged; the app does not import Node-only research modules.

Differences from that engine:
- Pure synchronous UTF-8 SHA-256 replaces Node crypto; tests compare Node vectors
  and canonical metadata identities. Existing model keys retain parity.
- Additional-sacrifice costs retain their actual Oracle clause/line and payment
  events cite that clause rather than the synthetic cast action.
- Permanent entry events carry explicit CR608.3/CR400.7 rules evidence in addition
  to the source-effect evidence. Rule descriptions are paraphrases, not Oracle
  quotations. UI separates Oracle line references from rules references.
- Depth exhaustion with remaining available actions explicitly marks search
  truncation. This does not invalidate a witnessed finite path but does mean
  alternatives and longer paths were not exhausted.
- Missing Oracle data and multi-face/special layouts (including token-printing cards) are explicitly unsupported. Their cache keys are distinct from supported blank-text/normal records to prevent stale reuse; valid normal record identity parity is retained.

`analyze.ts` is a separate read-only contract, capped at 500 distinct cards and
1 MiB request/result, with 3 selected hypothetical participants, depth 3, 200
states, 12 branches/proofs and 48 automatic steps. The UI terminates/replaces
this separate worker on cancellation, stale deck revision, unmount or 8s timeout.
No persistent cache/settings, storage repository, API or recommendation output
is involved. A zero-selection run only compiles saved metadata, with zero search.

Results are qualified to an explicit hypothetical supported noncombat subset.
The user must supply starting zones/resources; no deck is silently placed onto
a battlefield or assumed to have available mana. Only the selected scenario
objects are considered. Unselected cards and real opponents may change actual
play. There is no whole-deck completeness, independent precision, real-game
executability, loop, competitive-strength or numerical synergy guarantee.
