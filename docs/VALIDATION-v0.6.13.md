# v0.6.13 — Brew Score v1

Baseline: v0.6.12 at `3987db0` (approved, live). Brew Score is a new, read-only lens. **Synergy and Upgrade scores are unchanged:** the golden engine output is identical, and the Synergy reported beside Brew is the same `candidateScorer` score.

## Formula (`src/upgrades/brew.ts`)

`score = clamp₀¹⁰⁰(A + B + C + D + E + F + G + penalties)`, rounded. There is no normalization, and no card is forced to 100.

| Component | Max | How it is computed (all from this deck) |
|---|---|---|
| A. Contextual synergy | 25 | 25 × Synergy / 100 |
| B. Interaction quality | 20 | 20 × (1 − e^(−m/5)). m = the summed strength of verified links to deck cards (≥ 0.5; copy effects are excluded and scored under E) + 2 × the factor of each fed condition. |
| C. Bridge strength | 20 | 20 × source presence × target presence (× 0.6 when the target is a support need). See Bridges. |
| D. Novelty | 15 | With a bridge: 15 × e^(−existing/3), where existing = other deck cards that already make the same bridge. Without one: 9 × e^(−n/3), where n = deck cards sharing its condition. Always × relevance = min(1, (B + C)/15), so being unusual counts only when the card actually interacts. |
| E. Multiplicative potential | 10 | 10 × (1 − e^(−r/3)) × relevance. r = deck copy effects that make a working copy + blink effects (if it has a meaningful entry ability). |
| F. Commander connection | 5 | 5 × the verified Commander link, when ≥ 0.5 (v0.6.12 links: being one trigger source is weak) |
| G. Role value | 5 | 5 × the largest unmet share of a role it fills (deck-derived targets) |

**Penalties:**

| Penalty | Points | When |
|---|---|---|
| Redundancy | −2 per existing bridge beyond 2 (max −8) | Other cards already make the same bridge |
| Redundancy | −5 | Its main role is already above 1.5× target |
| Setup cost | −6 per unfed ability (max −12) | An ability's condition has less than half supply in this deck |
| Anti-synergy | −10 | It exiles graveyards while the deck has a Graveyard package |
| Anti-synergy | −3 each (max −9) | Synergy's genuine conflicts: missing enabler, unsupported subtheme, wrong token or creature type, win-more. Curve and redundancy penalties already shape A. |
| Speculation | −5 | A condition the app can't verify, or Low card confidence |

**Bands** describe originality, not power:

| Band | Score |
|---|---|
| Hidden Gem | 85+ |
| Interesting Brew | 70+ |
| Some Brew Potential | 50+ |
| Conventional / Weak Brew Fit | below 50 |

## Bridges

- **Packages** are this deck's Deck DNA themes that hold at least 8% and have at least 3 contributing cards. Presence = min(1, contributors / 8).
- **Source** (what the card draws on):
  - A fed condition (≥ 0.5) is mapped to the package of its own kind: counters → Counters, instants and sorceries → Spells, enchantments entering → Enchantments, Dragons entering → Dragons Matter, dying or sacrifice → Sacrifice, and so on.
  - With no such package, the condition itself is the source, for example "Instant or sorcery spells", with presence 0.8 × min(1, supply / 8).
  - Payoff signals stand in only for cards without a typed condition.
- **Target:** the roles that ability adds when its condition is met, mapped to families: recursion → Graveyard, card draw → Card Advantage, tokens → Tokens, and so on.

## Confidence

The deck's analysis confidence (v0.6.11) carries into Brew:
- **Low:** a Hidden Gem is labeled "Potential Brew", with the uncertainty note.
- **Medium:** "Analysis confidence: Medium" is shown.

## Calibration and controls

Calibration decks are `tests/brewFixture.ts` (real Scryfall data): Vorel counters with clones and graveyard value, and Tatyova landfall as the negative control. The holdout decks were not used to choose any value.

| Candidate | Vorel counters (Brew, Synergy) | Tatyova landfall (Brew, Synergy) |
|---|---|---|
| Evolution Witness | **81** Interesting Brew (69) | 32 (69) |
| Gyre Sage | 46 (44): Counters → Ramp | 4 (15) |
| Scavenging Ooze | 24 (71): graveyard hate in a graveyard deck | 11 (45) |
| Llanowar Elves | 22 (48) | 5 (20) |
| Elvish Visionary | 21 (48) | 13 (39) |
| Mind Stone (staple) | 16 (48) | 13 (36) |
| Rogue's Passage | 15 (46) | 34 (66) |
| Arcane Signet (staple) | 10 (36) | 6 (25) |
| Biomass Mutation | 5 (19) | 5 (18) |
| Psychic Battle (obscure, unsupported) | 4 (17) | 4 (16) |

- **Evolution Witness:**
  - Bridge: Counters → Graveyard, fed by 19 counter cards.
  - Novelty: only Golgari Grave-Troll already makes that bridge.
  - Copies: 6 copy effects.
  - Commander: a real link to Vorel.
  - In the negative control (same card, same Synergy 69) it falls by 49 points.
- **Staples and obscure cards:** good staples have high Synergy but low Brew; obscure unsupported cards stay low on both.

**Holdout check** (`tests/audit/holdout.audit.test.ts`, never tuned on):
- The unseen counters-recursion deck A3 also ranks Evolution Witness first at 81 (Counters → Graveyard).
- Other top picks are evidenced bridges:
  - Blood Artist, Sacrifice → Pings (Breya).
  - Setessan Champion, Enchantments entering → Card Advantage (Atraxa).
  - Avenger of Zendikar, Lands entering → Tokens (Tolsimir).
  - Dragon Tempest, Dragons Matter → Interaction (Dragon reanimator).
- No holdout deck produced a Hidden Gem.
- DNA checks still pass 13 of 14.

## Upgrades UI

- **Sort** adds Synergy, Brew Score High → Low and Brew Score Low → High. Brew ties go to Synergy, then name A–Z.
- **Brew filter:** All (default), Hidden Gems 85+, Interesting 70+, Some Potential 50+, Low / Conventional below 50.
  - It combines with search and copy availability.
  - The **Hidden Gems** shortcut sets the 85+ filter and the Brew sort.
  - Candidates are always legal, owned and not already in the deck.
- **Candidate cards:**
  - In a Brew view: Brew, band, Synergy, the bridge or strongest interaction, a one-line summary and "Why this brew?" (each claim names deck cards), followed by the usual actions.
  - The default views are unchanged.
- **Card Detail** from Upgrades: Card Intelligence, then In This Deck (Synergy), then the Upgrades I Own scores, then Brew in This Deck.
- **Performance:**
  - Brew is computed only when a Brew or Synergy view asks for it, once per deck revision (`brewCandidates` is memoized with the deck model).
  - Sorting, filtering, scrolling and opening a card reuse that result.
  - 600 extra owned candidates evaluate well within budget (unit test).

## Tests

- `tests/unit/brew.test.ts` (13):
  - Brew is separate from Synergy and never changes it.
  - The same card scores differently in different decks (positive fixture vs negative control).
  - Evolution Witness ranks first and at least 25 points above generic one-tag cards.
  - Staples get no bridge or novelty credit; obscure unsupported cards stay low.
  - Bridge credit; redundant bridges lower novelty and add a penalty.
  - Copy support needs clones; legendary and once-per-turn copies count less.
  - Speculative conditions are penalized; graveyard hate is anti-synergy.
  - Why this brew? lines name deck cards, and the components sum to the score.
  - Bands; Low confidence never says Hidden Gem.
  - Ownership doesn't change the score.
  - Caching and determinism; large-collection budget.
- `tests/browser/brew.spec.ts`, on every screen size:
  - Brew sort order; the Brew-first card with Synergy and the bridge; Why this brew? evidence.
  - Filter combinations with availability and search; the Hidden Gems shortcut.
  - Card Detail sections; no overflow; Axe clean.
- **Found and fixed:** the Upgrades card-art buttons used an `aria-label` that didn't contain their visible content when artwork failed to load (label-content-name-mismatch). They now use visually hidden text.

## Known limitations

- Bridges read Deck DNA packages and typed conditions. Interactions the parser can't type (most static effects, cost changes) contribute only through Synergy and links.
- Copy and blink detection relies on Card Intelligence clone and blink tags. Token-copy restrictions beyond "isn't legendary" aren't modeled.
- Interaction quality uses link counts, so a card linking to many cards in a large package can score high without being unusual. Novelty only partly offsets this.
- With the current calibration, Hidden Gem (85+) is rare. None of the calibration or holdout decks produced one.
- No popularity or price inputs, by design. Those may later become separate filters ("Conventional usage", "Under $2") that never change the strategic score.

## Validation run

- `npm run lint`, `npx tsc -b`, `git diff --check`: clean. `npm audit`: 0 vulnerabilities. `npm run build`: passed.
- `npm run test:unit`: 521 passed. The golden engine output is unchanged.
- Playwright on the production build: 390 passed across mobile-360, mobile-390, mobile-430, tablet and desktop.
