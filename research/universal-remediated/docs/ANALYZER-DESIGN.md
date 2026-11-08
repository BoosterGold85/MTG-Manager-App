# Proposed experimental Synergy Analyzer

Status: design only, disabled. Activation requires independent correctness,
proof-quality, coverage/usefulness and browser-worker gates. There is no UI,
worker adapter, persisted setting or production engine import in this merge.

## Deck Overview flow

Reuse the existing Commander/Legacy deck records and canonical card metadata.
Snapshot deck ID, format, entries, quantities, engine version and metadata
fingerprints. Run from an explicit “Experimental Synergy Analyzer” action only
after activation has been separately authorized; allow it to be disabled.
It must never feed Plan Fit, Brew Score or upgrade ranking functions.

The result has separate panels for:

1. Mechanically supported chains, with source Oracle clauses, causal steps,
   explicit prerequisites, required participants and resulting resources.
2. Conditional claims with unresolved prerequisites, separated from completed
   scoped certificates. Unknown and explicitly disproved claims appear separately.
3. Unsupported cards and clauses, with actual reasons, deferred combat mechanics
   and known semantic limits. Missing search results do not imply no interaction.
4. Coverage: input copies and distinct cards, parsed noncombat clauses, contexts
   attempted, contexts certified and contexts blocked. Parsing is not complete
   card understanding. Do not turn coverage into an accuracy percentage.
5. Card selection: chains requiring that card, a fresh counterfactual evaluation
   without it, disappeared chains, surviving alternative routes and net resource
   changes. Full rebuilding is acceptable initially; report timeout/abstention.

A deck list does not supply a current game state. Present “Verified under these
prerequisites,” never “executable now” unless the user has supplied and the engine
has validated the actual state. Every assumed zone, readiness, mana payment,
priority/timing, library requirement and no-response assumption must be visible.
Do not silently put all permanents onto a battlefield or invent access to mana.
Do not infer primary/secondary strategies, win probability, or complete deck
understanding from a few parsed clauses. Unsupported influences cannot be ignored
merely to obtain a certificate.

## Resources and contextual value

Display gross events separately from terminal holdings. A creature blinking is
an entry event, not an extra creature holding; generated mana spent later cannot
be counted twice. Each shown path pays costs through the same resource ledger.
Do not add payoffs from mutually exclusive paths into one apparent result.

Synergy Surplus can first be expressed as a witnessed extra payoff relative to
explicit standalone baselines with the same resources. Transformative Fit can
be a documented qualitative role that becomes possible only with support.
Marginal Deck Value can start as counterfactual lost/surviving chains and net
resources. None warrants a scalar weight, recommendation bonus or win-rate
estimate until independently calibrated and separately approved.

## Worker contract and bounded execution

Use the existing worker request/cancellation patterns through a separate
read-only analyzer request type. Do not reuse or alter scoring response fields.
Requests carry request ID, deck revision and engine fingerprint; stale replies
are discarded. Cache keys include all three plus Oracle content and limits.

A browser-compatible adapter must replace Node hashing without changing stable
semantic identities, validate serialized inputs, cap copied state/results and
round-trip proof references. Start with the engine's explicit bounded search
(depth 4, 2,000 states, 32 branches, 128 automatic steps, 50 proof entries).
Profile a hard worker timeout and payload cap before activation; terminate and
replace a stuck worker, return an explicit incomplete result and keep Deck
Overview responsive. Unhandled errors, unsupported layouts and exhausted budgets
must not produce fabricated chains or alter saved deck/collection data.

The UI must distinguish completed finite-path proof from truncated alternative
search. Infinite loops, completeness and strategy quality cannot be inferred
from a graph cycle or a bounded search finishing quickly.

## Gates before user testing

Retain the existing >=95% supported-claim precision target, zero false Verified
claims in dedicated adversarial negatives, >=100 independently labeled valid
multi-card cases across >=10 mechanical families, required unseen discovery gain,
and >=30 independently labeled diverse decks. Report intervals, abstentions,
unsupported contexts and every failure. Independently review cost/target evidence
and explanation quality; independently review any source-to-model label adapter.

Agree on an actual-deck usefulness gate before inspecting its outcomes. The
current low coverage and zero complete-deck chains fail practical readiness;
no arbitrary numerical coverage threshold is being invented here. Browser
resource/cancellation tests and production regression checks must also pass.
Only then propose activation for hands-on Commander/Legacy testing. Changes to
ranking or numerical synergy remain a separate decision.
