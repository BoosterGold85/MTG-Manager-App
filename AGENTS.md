# MTG Manager agent entry point

Read PROJECT_MEMORY.md first, then verify branch, working-tree status and remote main. Read only task-relevant reports instead of replaying long chats or loading large corpora.

Latest explicit user instructions override this handoff. Preserve unrelated branches, dirty checkouts and local-only work. Never force-push or reset them. Keep changes isolated until validated.

## Product/data boundaries

- Premium mobile Magic binder; retain existing design tokens, card-art dominance, interactions and responsive behavior.
- Browser ownership and conceptual deck entries are separate. Never fabricate ownership, steal assigned copies, clear IndexedDB or require mass reimport to work around a bug.
- Preserve database names/versions, keys, deck IDs, source collection fields, quantities and assignment/revision checks. Same browser origin is necessary for existing saved data.
- Commander Colors uses canonical color-identity subset matching, separately from visual Color.
- Canonical Scryfall metadata; transient lookup failure is an interruption, not proof that CSV rows are invalid.
- Explain verified causal relationships, not popularity or shared tags. No named-card production exceptions. Use generalized rules with negative controls.
- Never tune against frozen blind holdouts, edit frozen expectations to improve metrics, or silently refresh golden/protection hashes.
- Never commit credentials, private collection exports or personal backups. No paid API calls without authorization.

## Experimental analyzer boundary

The v0.6.26 user explicitly authorizes a limited, opt-in, read-only analyzer on main after isolation, correctness and data-preservation checks pass. Limited coverage/no discovered chains are acceptable; do not claim complete deck understanding or real-game executability.

No experimental outputs may feed Plan Fit, Brew Score, upgrade ranking, confidence, deck changes or collection writes. Keep existing scoring/storage files unchanged. Any future schema migration requires explicit safe migration tests; none is needed here.

## Validate and communicate

Run lint, TypeScript/build, existing unit/prototype tests and relevant/full production browser regression tests. Run timing-sensitive units separately from heavy browser loads; finish a build before starting browser tests against it. Capture same-origin old-build-to-new-build storage-preservation checks.

Report exact commands/counts and actual blockers. A push is not deployment verification. Never claim a physical-device test from Chromium emulation. Use inherited proxy/CA trust, respect enforced network policy, and never bypass a denied destination.

Update PROJECT_MEMORY.md in place at meaningful checkpoints; put full evidence in a task report under docs/. A memory file is context, not permission to merge/deploy a future task.
