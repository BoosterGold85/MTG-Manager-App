# Dormant module merge review

Scope: exact frozen `phase4-remediation.1` code and its test fixtures, not analyzer
activation, scoring integration, a release, or certification of universal rules.
Production baseline: `65be47176c6eee3f427fec72dcbf3e26a7aa233d` (v0.6.25).

## Findings and decision

The production-boundary review passes for an inactive research-only merge:

- The engine has no import/re-export edge from `src/` or `worker/`.
- Production files, package version, lockfile, workers, scoring and configurations
  are byte-identical to the baseline. No dependencies or routes are added.
- All 91 generated production files are byte-identical to baseline. The complete
  file hashes are retained in `../bundle-comparison.json`.
- Two boundary tests enforce no production imports, a disabled manifest and exact
  reviewed source bytes. Any later integration must deliberately change those
  safeguards in a separately reviewed change.
- The existing 960 unit tests and 89 successor tests pass. The final complete
  candidate suite also includes two boundary tests (1,051 tests total). Lint and
  production build pass. The module remains Node-only and is not worker-ready.

This is **safe to merge as dormant research code**. It is **not safe to activate
as a whole-deck analyzer**. A passing isolation review does not convert an
unsupported rule into Verified or satisfy independent correctness gates.

Mechanical findings retained from the frozen study: the original mandatory-target
errors are repaired, but 63/104 positive regression claims remain unestablished.
The proof audit flags eight additional-sacrifice-cost event instances that cite
synthetic cast evidence rather than the actual cost clause, and ten ordinary
permanent-entry instances without explicit rules citations. Exact cited Oracle
lines and required predicates passed structural checks; independent semantic
proof accuracy remains unmeasured. Preserve these findings rather than hiding
or changing the frozen model to make its holdout look better.

Known limits include delayed returns, stack-targeted ability copies and
counterspells, continuous-effect layers, broad state-based actions, alternate
costs, opponent sequencing and most deck-level context. Whole-deck projection
coverage is 8.4%/10.0% and yields no certified chains. A complete deck is not a
battlefield; supplied mana and board assumptions cannot certify an actual deck.

The prior fresh packet has 150 states, 125 exercised new Oracle cards, three
Verified root-action outcomes, no discovered chains, and 92 Unknown outcomes.
Independent labels are still pending; precision, recall and proof-quality
confidence for it are unavailable. The original developer-labeled regressions
must not be described as independent validation.

Merge authorization applies to this dormant boundary. No feature activation,
production scoring change, deployment command or version bump is included.
