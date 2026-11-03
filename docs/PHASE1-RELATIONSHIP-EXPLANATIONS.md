# Phase 1 — Verified relationship explanations (review branch)

Base: v0.6.23, main `6d0286bab411530943c01cfed7aa4191146d71bf`.
Branch: `phase1-relationship-explanations`. No merge or deployment is authorized.

## Scope

Separate **How this card interacts with your deck** from **Why this swap improves your deck**. Keep existing marginal-gain reasons, lost coverage, concerns, dependency, saturation, confidence, grades, scores and cut selection. This is presentation work, not a new semantic or scoring pass. Phases 2 and 3 are not started.

The scorer's existing relationship objects already contain causal evidence; its public links previously discarded that text. This patch copies those strings onto optional `links[].evidence`. No extraction predicates, relationship strengths, weights or thresholds change.

The new presentation helper builds a disposable conceptual deck with one outgoing copy removed and the incoming card included. It invokes the existing engine on that view, selects only verified links to surviving canonical identities (strength >= 0.5, the existing non-Commander-link gate), and displays at most three named partners, prioritizing Commander links. For Commander links it prefers existing named Commander evidence; other links retain their engine-generated causal evidence. No Oracle parsing or tag-to-causality inference occurs in the UI. No evidence means an explicit neutral message, not an invented benefit.

The recomputed result is used only for explanation; it never replaces original recommendation scores, ranks, best cuts or confidence. The view is never saved. Legacy assignment-only decks are normalized through existing deckDnaInput, keeping one-copy removal semantics. Manual swap review uses the currently selected valid cut. The ordinary Why panel computes this work only when opened.

## Example

Before:
- Why this helps: “Small gains: redundancy +4.0, commander plan +0.6.”
- Concerns: little beyond creature type/body; Commander plan already saturated.

After:
- How this card interacts with your deck — **Lathliss, Dragon Queen**: “Changeling makes Changeling Wayfinder a Dragon, so entering triggers Lathliss, Dragon Queen.”
- Other surviving verified partners can include Breaching Dragonstorm and Dragon Tempest, with their actual engine-generated trigger evidence.
- Why this swap improves your deck — the same small-gain sentence, unchanged.
- The same concerns, cut explanation, confidence and numeric grade remain.

A relationship is not a claim that the swap is a major improvement. Removing a partner suppresses its explanation. No verified link produces: “No verified card-to-card interaction was found for this swap.”

## Validation and protection review

The new Reign parity capture comes from the unmodified v0.6.23 engine, before this patch. It freezes existing two-candidate order, full UpgradeEvaluation (including best cut, alternatives, confidence, deltas, reasons and concerns) and BuildEvaluation. Tests compare those exact outputs before/after invoking the presentation helper and assert unchanged collection/deck state. No existing golden expectations were edited.

Five new unit cases cover named Wayfinder/Lathliss evidence and numerical parity, token-Dragon exclusion from nontoken Lathliss triggers, no evidence from absent/weak/unsupported links, removal of a real Dragon Tempest partner, and evidence mentioning a removed third partner. A new browser case verifies the two explanation sections, preserved saturation/marginal-gain text, and unchanged saved state.

**The byte-for-byte Commander protection guard intentionally remains failing for review.** Existing hashes and guard code are untouched. The two flagged files are DeckUpgrades.tsx (presentation import/rendering/heading) and synergy/recommendation.ts (optional evidence field and copying existing strings into it). The remaining protected source files retain their hashes. Do not refresh the protection baseline automatically: reviewers must explicitly accept these narrow presentation changes. Numeric parity and the existing semantic/scoring tests are separate evidence, not a replacement for acknowledging this guard.

Final lint, build and diff checks passed. The final isolated full unit run reports **722 passed / 1 failed (723 total)** in 13.94 seconds; the sole failure is the unchanged protection guard described above. The relevant production browser suite passed **55/55** at all five sizes in 2.8 minutes. The last conservative removed-third-partner filter is covered by the final unit run and a separate focused browser rerun (**5/5 passed**, all five sizes, 14.0 seconds). An overlapping build/browser attempt caused two navigation failures and concurrent load caused one timing failure; isolated reruns are authoritative. No product thresholds were changed to address these test-run issues.

## Limits and unexpected behavior

- Public relationship links previously omitted their own causal text; exposing it requires the small metadata-only change in a protected source file.
- Initial alphabetical truncation hid the Commander relationship; presentation now prioritizes Commander links before other strong links. This never reorders candidates.
- Recomputing a read-only deck view adds work when opening an explanation or changing a manual cut. It does not run for closed candidate Why panels. One local Reign helper trial took about 123 ms; this is not a mobile performance guarantee.
- At most three relationships are shown, one concise evidence item per partner. The display is not an exhaustive semantic report.
- Existing semantic misses and scoring limitations remain. No blind holdout ranking evaluation, API integration, external paid calls, collection writes, deployment or land-mechanic changes are part of this branch.
