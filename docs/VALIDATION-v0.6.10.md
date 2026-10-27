# v0.6.10 — Full card-pool audit and real card data

Baseline: v0.6.9 at `1b7ee0c`. Scryfall access was enabled for the build environment (`api.scryfall.com`, `data.scryfall.io`). That made two things possible: replacing from-memory fixture text with real Oracle data, and auditing the evaluator against every Commander-legal card instead of one decklist at a time.

## Real card data

The Oracle records come from the Scryfall `oracle-cards` bulk file, dated 2026-10-27. They replace the reconstructed text in:
- `tests/data/miles-tails-vehicles.json` (72 cards) and `tests/data/valgavoth-pings.json` (87 cards). All are Commander legal.
- `tests/upgradeCandidates.ts` and the clone fixtures in `tests/dnaFixtures.ts`. The Savage Beating, Vandalblast and clone wording was updated; most cards matched already.
- `tests/data/card-pool-rules.json` (new): 27 real cards for the audit regression tests.

All earlier regressions pass on the real text. The Valgavoth fixture's Deck Health matches the user's screenshot exactly (Ramp 11.6, Card advantage 8.2, Interaction 11, Board wipes 4, Finishers 9, Lands 38), apart from the intended Protection and Recursion fixes.

## Audit harness

```
CARD_POOL=/path/oracle-cards.jsonl AUDIT_OUT=report.json npx vitest run tests/audit
```

- **Input:** Commander-legal, deck-playable cards (32,094) and commander-eligible cards (3,441).
- **What it reports:** wording that clearly implies a role the engine did not assign (wipe, removal, counterspell, ramp, draw, tutor, recursion, protection), crashes, and Commander triggers that fall through to "acts every turn".
- **Speed:** about 25 s.
- **Not in the unit suite:** it is skipped without `CARD_POOL` and lives outside `tests/unit`.

## Results

| Gap | First run | Final |
|---|---|---|
| Wipe | 95 | 12 |
| Removal | 42 | 30 |
| Protection | 23 | 0 |
| Card draw | 220 | 27 |
| Tutor | 233 | 130 |
| Mana rock | 21 | 7 |
| Unclassified Commander triggers | 671 (561 commanders) | 206 (179 commanders) |
| Crashes | 0 | 0 |

Most remaining hits are audit false positives:
- Removal: blink, "exile target creature you control, then return it".
- Wipes: "-2/-0", "exile all creatures you control".
- Draw: opponents drawing.
- Tutors: land and named-card searches.

The remaining Commander triggers are long-tail mechanics: clash, the Ring, expend, tapping for mana, "this way" reflexive triggers. 3,604 non-vanilla cards still carry no tag or role. Most are combat tricks and creatures whose value is their body; that list hasn't been reviewed yet.

## Fixes (all generic)

See CHANGELOG 0.6.10:
- clause-level effect scope (`clauseScope`, `subjectScope`);
- shrink sweeps, permanent sweeps with exceptions, best-answer-per-line, graveyard-plus-creature sweeps, the narrower "you control" guard, and mass judged from the removal clause;
- Aura and Equipment protection and granted mana abilities;
- typed tutors;
- comma- and period-safe Commander triggers;
- trigger events for discard, leaves, token creation, scry and proliferate.

## Golden fixture

One reviewed change. The Elder Dragon War now reads as card draw plus tokens, not just a sweep. Reign of Dragons' best cut moves from Chain Reaction to Hit the Mother Lode, with values within ±0.03 and unchanged labels.

## Tests

`tests/unit/cardPoolRules.test.ts` (9), using real cards:
- clause-scoped draws and removal;
- shrink, permanent, multi-sentence and exception sweeps, with "-2/-0" not counted;
- Aura protection, Greaves and mana Auras;
- type tutors versus named searches;
- Exhume recursion;
- Gregor's comma name;
- the discard, leaves, token, scry and proliferate trigger events.

## Validation run

- `npm run lint` and `npx tsc -b`: clean.
- `npm run test:unit`: 482 passed.
- `npm run build`: passed.
- `npm audit`: 0 vulnerabilities.
- `git diff --check`: clean.
- Playwright on the production build: 375 passed across all five viewports.
- Card-pool audit: 32,094 cards, 0 crashes, about 25 s.
