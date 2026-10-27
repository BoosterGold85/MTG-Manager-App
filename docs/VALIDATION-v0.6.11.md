# v0.6.11 — "The app isn't sure" warnings

Baseline: v0.6.10 at `5933647` (approved).

## What changed

- `analysisConfidence(state, deck)` in `src/upgrades/index.ts`, memoized per collection state and deck. It reads only what the engine already computed (Deck DNA, strategy profile, current deck model) and changes no scores. Notes:
  - `commander-trigger`: Commander triggers that fall through to "acts every turn" (`isUnclassifiedTrigger` in `src/dna/strategy.ts`, shared with the card-pool audit). Level Low.
  - `commander-links`: the Commander has understood, non-self triggers, the main deck has 30+ cards, and fewer than 3 cards have Commander link ≥ 0.5.
  - `weak-plan`: 30+ cards and no primary theme (Low), or a top primary theme under 15%.
  - `untracked-cards`: nonland cards with no role, no DNA connection and more than 40 characters of rules text, when there are at least max(3, 8% of nonlands).
  - `missing-text`: nonland cards with no saved rules text.
  - Level: Low for an unclassified Commander trigger or no plan; Medium for any other note; High otherwise.
- `DeckOverview` renders the notes in a section labelled "Analysis confidence", right before Deck Health, only when there are notes.
- Generic evaluator fixes found by the warning on the Miles deck: library tucks are removal (mass tucks are wipes); qualified anthems are team pumps.

## Tests

- `tests/unit/analysisConfidence.test.ts`: the Miles, Valgavoth, Reign of Dragons and Lathliss regression decks are High with no notes; an unclassifiable Commander ("Whenever you win a clash, draw a card") is Low and quotes the ability; untracked cards and a card with no rules text are listed; Condemn, Favorable Winds and Hallowed Burial are tracked.
- `tests/browser/analysisConfidence.spec.ts`: the callout shows the heading, the quoted ability and the card names, sits right before Deck Health, causes no horizontal overflow and passes Axe.
- `tests/browser/deckDna.spec.ts`: the Overview order check ignores the callout.
- Golden engine output (`tests/golden/upgrades-v0.6.6.json`) is unchanged.

## Known limitations

- Thresholds (3 linked cards, 15% plan, 8% untracked) are judgment calls, tuned so every regression deck is High.
- Momentary Blink, Hotshot Mechanic and Tangle Tumbler are still untracked in the Miles deck; it stays under the threshold, so no note is shown.

## Validation run

- `npm run lint`: clean (also fixes a `no-control-regex` error from v0.6.10: the Commander self-name placeholder is now `§`, which appears in no Oracle text). `npx tsc -b`: clean. `npm run test:unit`: 490 passed, golden unchanged. `npm run build`: passed. `npm audit`: 0 vulnerabilities. `git diff --check`: clean.
- Playwright on the production build: 380 passed across mobile-360, mobile-390, mobile-430, tablet and desktop.
