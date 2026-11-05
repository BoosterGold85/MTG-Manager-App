# Uugguu deck analysis

The supplied list contains exactly **100 cards and 92 distinct canonical cards**. Live Scryfall collection
lookups on 2026-11-04 matched every name, including the three double-faced cards. No card was missing
from canonical data. The exact list, canonical analysis fields and provenance hashes are checked into
`tests/data/uugguu-deck.*` and `tests/audit/uugguu/` as an offline regression corpus. This does not write
the deck into a user's saved collection, assign ownership, or publish a release.

All cards fit the commander's blue/black/green color identity. The captured Scryfall data marks
[Uugguu](https://scryfall.com/card/mbc/54/uugguu-the-omniplasm) itself **not legal in Commander**;
the other 91 distinct cards are marked legal. Analysis support does not override that legality record.

## What was not recognized

Before this change, ten cards contained abilities flagged as unsupported or partially understood:

| Card | Unrecognized part |
| --- | --- |
| Maskwood Nexus | Creature-type changes, including creature cards outside the battlefield |
| Arcane Adaptation | The chosen-type grant and its scope |
| Roaming Throne | Its chosen creature type and extra triggered ability |
| Biowaste Blob | Its self-copy condition requiring control of a commander |
| Gelatinous Cube | Moving its linked exiled creature card into the owner's graveyard |
| Umori, the Collector | Optional companion restriction and choosing a card type on entry |
| Three Tree City | Choosing a creature type on entry |
| Breeding Pool | Optional life payment to enter untapped |
| Overgrown Tomb | Optional life payment to enter untapped |
| Watery Grave | Optional life payment to enter untapped |

Several other cards were marked recognized while their important relationships were missing. The new
tests therefore check actual relationships and roles, not only disappearance of the warning.

## Rules added to the app

- **Uugguu's death-copy engine:** another nontoken Ooze dying produces two 2/2 nonlegendary copies.
  Token deaths do not retrigger its nontoken condition. Copy facts distinguish the source's required type
  from copiable characteristics; a type granted by another permanent is not automatically copied.
- **Type changes:** Nexus and Adaptation can support the death condition and chosen-type draw. Their
  out-of-battlefield scope also supports Bloodline Bidding. March changes battlefield creatures only;
  it does not make graveyard creatures Oozes. Its 6/6 base body can shrink larger creatures.
- **Clones:** actual compatible nonlegendary Ooze targets in the deck provide conditional evidence.
  A separate valid route copies an active legendary death-copy engine: keep the original under the
  legend rule, let the new nontoken copy die, and receive the original's nonlegendary copy tokens.
  Legend-rule deaths are not sacrifices. This route is not classified as an infinite loop.
- **Sacrifice and multiplication:** the Altars, Pod, Vannifar and Cauldron can feed eligible creature
  deaths, with costs and timing preserved. Token doublers multiply the death-copy output; Roaming
  Throne can add a trigger from another chosen-type creature. Neither turns tokens into nontokens.
  Village Rites, Deadly Dispute and Victimize provide one-shot sacrifices. Saw in Half can destroy
  your own eligible creature for the death trigger and its own smaller copies, provided it actually dies.
- **Death-return protection:** Feign Death, Malakir Rebirth, Not Dead After All and Undying Malice
  grant temporary return-on-death protection, not protection against exile. They cannot return tokens.
- **Land creatures and land tokens:** Mutavault and Corrupted Zendikon enable conditional land-creature
  deaths. Mutable Explorer creates a land token for mana, not an immediately active creature or
  nontoken creature. Changeling tokens retain their type support for token-eligible triggers.
- **Token mana:** Springleaf Parade's creature tokens can tap for mana, with summoning sickness still
  relevant. This ability requires actual creature-token sources in the deck.
- **Other ability details:** Reanimate's put-from-graveyard wording is recursion; Renew's temporary
  copy effect does not cause creatures to enter; Biowaste Blob needs an actual commander, not an
  arbitrary permanent. Umori's companion restriction does not constrain it as a main-deck card.

Production rules use Oracle wording and typed evidence, not this deck's card names. Tests include
renamed cards, opponents' effects, missing setup, tokens versus nontokens, zone restrictions and a
complete read-only offline analysis of the supplied deck. Existing score weights and thresholds remain
unchanged; facts, semantic and ranking cache versions are updated for the changed interpretation.

Full text coverage means the tested ability shapes are recognized. The app remains a heuristic deck
analyzer, not a board-state simulator, combo proof system, or promise of competitive power. Animation,
casting costs, actual battlefield presence, target availability and keeping a type-changing permanent
active still matter. No live deployment is included in this source change.

## Validation

- Lint and production build (including TypeScript) passed. The pre-existing large-bundle advisory remains.
- All **841 unit tests in 49 files** passed with `npm run test:unit -- --maxWorkers=1 --testTimeout=30000`.
  Earlier default-timeout runs had intermittent timeout-only failures in existing tests; one earlier
  complete default run also passed. No repository test timeout or explicit performance budget was changed.
  The measured 4,421-candidate and 1,500-candidate budget assertions passed in the final complete run.
- The 101 new deck checks cover all 92 canonical cards and renamed variants, the exact 100-card list,
  real versus missing setup, one-shot and repeatable sacrifices, the legend-rule copy route, legality,
  zone restrictions, and a full offline analysis that preserves saved data.
- The 72 frozen expectation occurrences retain their facts, capabilities and tags; the facts-version
  stamp is checked separately. Earlier golden snapshots are preserved. The Commander source-hash
  guard includes the new helper and the intentionally revised analysis modules.
- All **10 production-browser checks** passed across the five approved sizes (360, 390, 430, 768 and
  1440 pixels). The supplied deck has no partial-ability, unsupported-mechanic or missing-data warning;
  the existing unknown-mechanic warning still appears for the separate negative-control deck.
