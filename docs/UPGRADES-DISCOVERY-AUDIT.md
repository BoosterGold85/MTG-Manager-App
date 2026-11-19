# Upgrades discovery quality audit (Discovery 1.1.0, revised)

Status: evidence for owner review. Not merged, not deployed. This document corrects the earlier report where it was wrong.

## Bottom line

- The Vehicle/flying validation defect is corrected in the shared validator, and the earlier claim that non-flying Vehicles were false positives was wrong. Subterranean Schooner and Tangle Tumbler **do** interact with Miles: the card's own rule gives a flying counter when the Vehicle lacks flying.
- A second shared defect was found through the audit and corrected: "beginning of each player's draw step" was treated as a card-draw event. Four Kwain fixture scores change as a result (listed in section 3).
- **The usefulness target is not met on this evidence.** Most top-ten entries across six Commander decks are generic relationships that the engine verifies textually but that are not specific interactions (section 5). Several are overclaimed as "Strongly supported". My reading below is preliminary and is not a human judgment; the column for your judgment is in the tables.
- The alternative ordering does not change the picture (section 6). The bottleneck is which relationships are allowed, not the order they are shown in.

## 1. Corrections to the earlier report

1. **Schooner and Tangle Tumbler.** Earlier I called them false positives for Miles's flying payoff. Miles's rule reads "draw a card if it has flying. **Otherwise, put a flying counter on it.**" A non-flying Vehicle gets a flying counter, which is a real effect. My stated-condition filter in the discovery layer dropped a valid interaction. That filter is removed.
2. **Aeronaut Admiral and granted flying.** The earlier code ignored static grants such as "Vehicles you control have flying" (Aeronaut Admiral, Mu Yanling). Grants are now read from the deck's own cards and applied to the object the trigger watches, including a token that the source creates.
3. **Confidence labels.** The earlier "Strongly supported" was not defined tightly enough. It now requires a printed clause on one of the two cards, both cards named in the evidence, a typed object, and High analysis confidence (section 4).

## 2. Vehicle / flying: root cause, correction, and tests

Root cause, in `src/synergy/recommendation.ts` `verifies()` and `src/dna/strategy.ts`:
- Trigger object types ("a Vehicle you control enters", "another nontoken Dragon you control enters") were not checked against the source.
- Keyword tests in rules ("if it has flying") were not checked, and the evidence always described the first branch, even for sources that lack the keyword.
- Granted keywords from other deck cards were not considered.
- The rule snippet stopped before the "Otherwise" clause, so an alternative branch was invisible.

Fix (shared module `src/synergy/stateConditions.ts`, used by the validator and the evidence text):
- A named type must match the source, or the source must create tokens of that type (the trigger watches the token). A Changeling creature matches any creature type, but not a non-creature subtype.
- A keyword test with no alternative must hold for the object. With an alternative, both branches are real effects, so the link stands, and the evidence says which branch applies.
- The condition is parsed from the receiver's full rule line, not the truncated snippet.
- Keywords are printed, granted by a deck card to a type the object has, or printed in the token's creation text.
- Dies triggers are excluded from the type gate, so a sacrifice outlet can still relate to them.

Tests (`tests/unit/stateConditions.test.ts`, 18 tests, all passing): printed flying (Copter), missing flying with the Otherwise branch (Schooner), flying granted by Aeronaut Admiral and by Mu Yanling, grants that reach only the types they name (creature flying does not fly a non-creature Vehicle), a token that gains flying from its source's own grant (Mu Yanling), Changeling, the no-alternative case, the dies exclusion, and scoring through the real scorer on the Miles fixture.

Not done: Aeronaut Admiral itself does not become a link to any Vehicle. Its grant is now applied where the Vehicle is linked to Miles. Whether an enabler should be a *relationship* of its own (with a score) is a scoring decision and is left for you.

## 3. Scoring impact (before = `2a665f0`, after = final code, same fixtures)

Dump of scores and link sets for 497 cards across seven fixture decks (`docs/audit/` and `scratchpad` comparison):
- **Score changes: 4**, all in the Kwain fixture: Dictate of Kruphix 55→9, Howling Mine 55→9, Kami of the Crescent Moon 55→29, Well of Ideas 56→31. Cause: draw-step triggers no longer match card draw effects.
- **Link or synergy set changes only: 36**, all in Kwain, same cause.
- No other fixture changed. Miles key cards, Reign Wayfinder, the death-engine strategy test and the Upgrades golden snapshot pass unchanged.

## 4. Confidence labels

"Strongly supported" now requires all of: High analysis confidence; a link at strength 0.8 or higher; evidence that names both cards; a rule clause that is printed on one of the two cards (a paraphrase cannot qualify); a typed object in the clause ("a Vehicle you control enters"), so broad events such as "you gain life" or "a creature you control leaves the battlefield" do not qualify alone; and not a relation kind on the weak list.

The weak list is provisional and general, not per card: symmetric or setup relations (↔, graveyard setup), cost-based or symmetric relations ("Discard enabler", "Explicit"), mana-spend riders ("when that mana is spent"), and replacement effects ("replaces", "does not initiate"). It is listed in `src/upgrades/discovery.ts`.

Remaining overclaims are listed in section 5. The label means "the printed rule is a specific, typed interaction", not "this card is useful".

## 5. Provisional guards: measured, not assumed

Design: two factors, each measured with the other held fixed. The category filter's effect is (no cap, no category filter) minus (no cap, filter on). The cap's effect is (filter on, no cap) minus (production). Earlier one-factor numbers were confounded and are replaced.

Suppressed by the **category filter** (a rule shared by three or more candidates):
- **Miles 'Tails' Prower** — category filter removed: Loran of the Third Path (Strongly supported, Brew 29); Faramir, Prince of Ithilien (Strongly supported, Brew 29); Triskaidekaphile (Strongly supported, Brew 28); Maskwood Nexus (Strongly supported, Brew 27); Swiftfoot Boots (Strongly supported, Brew 25); Temple Bell (Strongly supported, Brew 25); Well of Ideas (Strongly supported, Brew 25); Folio of Fancies (Strongly supported, Brew 24); Dragon's Hoard (Strongly supported, Brew 23); Teferi's Ageless Insight (Strongly supported, Brew 23); Visions of Beyond (Strongly supported, Brew 23); Aura Blast (Strongly supported, Brew 23); Jace Beleren (Strongly supported, Brew 23); Secret Rendezvous (Strongly supported, Brew 23); Thought Reflection (Strongly supported, Brew 23); Consider (Strongly supported, Brew 23); Keep Watch (Strongly supported, Brew 23); Mind Stone (Strongly supported, Brew 23); Bonders' Enclave (Strongly supported, Brew 22); Distant Melody (Strongly supported, Brew 22); Minds Aglow (Strongly supported, Brew 22); Prosperity (Strongly supported, Brew 22); War Room (Strongly supported, Brew 22); Windfall (Strongly supported, Brew 22); Borne Upon a Wind (Strongly supported, Brew 22); Vision Skeins (Strongly supported, Brew 22); Decanter of Endless Water (Strongly supported, Brew 21); Phyrexian Altar (Strongly supported, Brew 21); Astrid Peth (Strongly supported, Brew 21); Lightning Greaves (Strongly supported, Brew 21); Mind Unbound (Strongly supported, Brew 21); Harmonized Crescendo (Strongly supported, Brew 21); Laboratory Maniac (Strongly supported, Brew 20); Fellwar Stone (Strongly supported, Brew 20); Basilisk Collar (Strongly supported, Brew 19); Restoration Magic (Strongly supported, Brew 18); Ashnod's Altar (Strongly supported, Brew 18); Monologue Tax (Strongly supported, Brew 18); Smothering Tithe (Strongly supported, Brew 18); Howling Mine (Strongly supported, Brew 18); Sky Diamond (Strongly supported, Brew 18); Thought Vessel (Strongly supported, Brew 18); Séance Board (Strongly supported, Brew 17); Dragonstorm Globe (Strongly supported, Brew 16); Nuka-Cola Vending Machine (Strongly supported, Brew 15); Supreme Verdict (Strongly supported, Brew 12); Generous Gift (Strongly supported, Brew 12); Path to Exile (Strongly supported, Brew 12); An Offer You Can't Refuse (Strongly supported, Brew 11); Counterspell (Strongly supported, Brew 11); Essence Scatter (Strongly supported, Brew 11); Fumigate (Strongly supported, Brew 11); Hidden Grotto (Strongly supported, Brew 10); Exotic Orchard (Strongly supported, Brew 10); Cut a Deal (Strongly supported, Brew 10); Index (Strongly supported, Brew 10); Aetherize (Strongly supported, Brew 10); Hunted by The Family (Strongly supported, Brew 9); Adarkar Wastes (Strongly supported, Brew 7); Arcane Adaptation (Strongly supported, Brew 7); Ghostly Prison (Strongly supported, Brew 7); Mystic Sanctuary (Strongly supported, Brew 7); Propaganda (Strongly supported, Brew 7); Ash Barrens (Strongly supported, Brew 7); Azorius Chancery (Strongly supported, Brew 7); Deserted Beach (Strongly supported, Brew 7); Dictate of Kruphix (Strongly supported, Brew 7); Glacial Fortress (Strongly supported, Brew 7); Mutavault (Strongly supported, Brew 7); Reliquary Tower (Strongly supported, Brew 7); Rogue's Passage (Strongly supported, Brew 7); Sea Gate (Strongly supported, Brew 7); Skycloud Expanse (Strongly supported, Brew 7); Temple of the False God (Strongly supported, Brew 7); Uncharted Haven (Strongly supported, Brew 7); Witch's Clinic (Strongly supported, Brew 7); Forced Fruition (Strongly supported, Brew 7); Evolving Wilds (Strongly supported, Brew 6); Misty Rainforest (Strongly supported, Brew 6); Polluted Delta (Strongly supported, Brew 6); Terramorphic Expanse (Strongly supported, Brew 6); Verdant Catacombs (Strongly supported, Brew 6); Omniscience (Strongly supported, Brew 5); Approach of the Second Sun (Strongly supported, Brew 4); Apothecary White (Plausible, Brew 27); Heliod's Intervention (Plausible, Brew 10). Rule cap removed: none.
- **Lathliss, Dragon Queen** — category filter removed: Maskwood Nexus (Strongly supported, Brew 12). Rule cap removed: none.
- **Valgavoth, Harrower of Souls** — category filter removed: Phyrexian Altar (Plausible, Brew 43); Phyrexian Tower (Plausible, Brew 43); Ashnod's Altar (Plausible, Brew 42); Drakuseth, Maw of Flames (Plausible, Brew 39); Rolling Hamsphere (Plausible, Brew 39); Rapacious Dragon (Plausible, Brew 38); Tyrant's Familiar (Plausible, Brew 36); Leyline Tyrant (Plausible, Brew 35); Skyline Despot (Plausible, Brew 34); Atsushi, the Blazing Sky (Plausible, Brew 34); Scourge of Valkas (Plausible, Brew 32); Sarkhan, Dragon Ascendant (Plausible, Brew 31); The Elder Dragon War (Plausible, Brew 30); Gelatinous Cube (Plausible, Brew 29); Goldlust Triad (Plausible, Brew 28); Village Rites (Plausible, Brew 27); Hecteyes (Plausible, Brew 27); Terror of Mount Velus (Plausible, Brew 25); Maskwood Nexus (Plausible, Brew 24); Deadly Dispute (Plausible, Brew 23); Lathliss, Dragon Queen (Plausible, Brew 21); Utvara Hellkite (Plausible, Brew 21); Howling Golem (Plausible, Brew 20); Temple Bell (Plausible, Brew 17); Smuggler's Copter (Plausible, Brew 16); Goddric, Cloaked Reveler (Plausible, Brew 15); Minion of the Mighty (Plausible, Brew 14); Anger (Plausible, Brew 14); Taurean Mauler (Plausible, Brew 14); Thundermane Dragon (Plausible, Brew 14); Hellkite Charger (Plausible, Brew 13); Scourge of the Throne (Plausible, Brew 13); Bitter Reunion (Plausible, Brew 13); Unexpected Windfall (Plausible, Brew 11); Bonders' Enclave (Plausible, Brew 11); Thrill of Possibility (Plausible, Brew 11); War Room (Plausible, Brew 11); Commander's Sphere (Plausible, Brew 10); Shivan Devastator (Plausible, Brew 10); Academy Manufactor (Plausible, Brew 10); Dragonspeaker Shaman (Plausible, Brew 9); Dragonlord's Servant (Plausible, Brew 9); Nogi, Draco-Zealot (Plausible, Brew 9); Dragon's Hoard (Plausible, Brew 6). Rule cap removed: Scrawling Crawler (Plausible, Brew 42); Thunderbreak Regent (Plausible, Brew 39); Firespitter Whelp (Plausible, Brew 39); Psychosis Crawler (Plausible, Brew 34).
- **Kwain, Itinerant Meddler** — category filter removed: Of Herbs and Stewed Rabbit (Strongly supported, Brew 28); Commander's Sphere (Strongly supported, Brew 27); Rolling Hamsphere (Strongly supported, Brew 26); Goldbug, Humanity's Ally // Goldbug, Scrappy Scout (Strongly supported, Brew 25); Parhelion II (Strongly supported, Brew 25); Mind Stone (Strongly supported, Brew 25); Miles "Tails" Prower (Strongly supported, Brew 24); Sram, Senior Edificer (Strongly supported, Brew 24); Sephara, Sky's Blade (Strongly supported, Brew 21); Bonders' Enclave (Strongly supported, Brew 21); War Room (Strongly supported, Brew 21); Winged Words (Strongly supported, Brew 21); Distant Melody (Strongly supported, Brew 20); The Gaffer (Strongly supported, Brew 20); Moorland Haunt (Strongly supported, Brew 19); Dragon's Hoard (Strongly supported, Brew 19); Harmonized Crescendo (Strongly supported, Brew 19); Maskwood Nexus (Strongly supported, Brew 17); Jubilant Skybonder (Strongly supported, Brew 16); Warden of Evos Isle (Strongly supported, Brew 16); Hotshot Mechanic (Strongly supported, Brew 14); Empyrean Eagle (Strongly supported, Brew 14); Sage Owl (Strongly supported, Brew 14); Gearshift Ace (Strongly supported, Brew 14); Gearseeker Serpent (Strongly supported, Brew 14); Astrid Peth (Strongly supported, Brew 13); Thunderclap Wyvern (Strongly supported, Brew 13); Cloudspire Captain (Strongly supported, Brew 9); Sanwell, Avenger Ace (Strongly supported, Brew 8); Aeronaut Admiral (Strongly supported, Brew 8); Apothecary White (Plausible, Brew 19); Phyrexian Altar (Plausible, Brew 16); Cid, Freeflier Pilot (Plausible, Brew 15); Ashnod's Altar (Plausible, Brew 14); Kitsune Ace (Plausible, Brew 9). Rule cap removed: none.
- **Uugguu, the Omniplasm** — category filter removed: none. Rule cap removed: Revive the Shire (Speculative, Brew 18).
- **Hurska Sweet-Tooth** — category filter removed: Acidic Slime (Plausible, Brew 35); Howling Golem (Plausible, Brew 34); Chomping Changeling (Plausible, Brew 33); Green Slime (Plausible, Brew 33); Basilisk Collar (Plausible, Brew 32); Lightning Greaves (Plausible, Brew 31); Loran of the Third Path (Plausible, Brew 25); Birthing Pod (Plausible, Brew 24); Skysovereign, Consul Flagship (Plausible, Brew 23); Witch's Clinic (Plausible, Brew 23); Sanwell, Avenger Ace (Plausible, Brew 22); Flumph (Plausible, Brew 20); Hotshot Mechanic (Plausible, Brew 20); Gearshift Ace (Plausible, Brew 20); Scrawling Crawler (Plausible, Brew 20); Cid, Freeflier Pilot (Plausible, Brew 19); Windborn Muse (Plausible, Brew 19); Cloudspire Captain (Plausible, Brew 18); Evolving Wilds (Plausible, Brew 18); Misty Rainforest (Plausible, Brew 18); Polluted Delta (Plausible, Brew 18); Terramorphic Expanse (Plausible, Brew 18); Verdant Catacombs (Plausible, Brew 18); Brute Suit (Plausible, Brew 18); Ashnod's Altar (Plausible, Brew 17); Phyrexian Altar (Plausible, Brew 17); Kitsune Ace (Plausible, Brew 17); Sram, Senior Edificer (Plausible, Brew 17); Aeronaut Admiral (Plausible, Brew 17); Irontread Crusher (Plausible, Brew 17); _____ _____ Rocketship (Plausible, Brew 17); Aeve, Progenitor Ooze (Plausible, Brew 17); Skybox Ferry (Plausible, Brew 16); Three Visits (Plausible, Brew 13); Temple Bell (Plausible, Brew 12); Howling Mine (Plausible, Brew 11); Dragon's Hoard (Plausible, Brew 10); Bonders' Enclave (Plausible, Brew 10); War Room (Plausible, Brew 10); Hidden Grotto (Plausible, Brew 9); Séance Board (Plausible, Brew 9); Ash Barrens (Plausible, Brew 9); Exotic Orchard (Plausible, Brew 9); Mutavault (Plausible, Brew 9); Reliquary Tower (Plausible, Brew 9); Temple of the False God (Plausible, Brew 9); Uncharted Haven (Plausible, Brew 9); Haven of the Spirit Dragon (Plausible, Brew 9); Mind Stone (Plausible, Brew 6); Fellwar Stone (Plausible, Brew 6); Thought Vessel (Plausible, Brew 6); Commander's Sphere (Plausible, Brew 6); Decanter of Endless Water (Plausible, Brew 5); Worn Powerstone (Plausible, Brew 5); Bala Ged Recovery // Bala Ged Sanctuary (Plausible, Brew 4); Dragonstorm Globe (Plausible, Brew 0). Rule cap removed: Approach of the Second Sun (Plausible, Brew 52).

Reading (preliminary, not a human judgment): the category filter removes many generic shared triggers, which is its job. It also removes some cards that may be real and specific to the deck: in Valgavoth, Drakuseth and Scourge of Valkas are Dragon-engine cards, and in Hurska, Skysovereign is a flying Vehicle. Whether the filter should give Commander-specific shared rules more room is for you to decide. The cap removes a few items too (Firespitter Whelp, Approach of the Second Sun, Revive the Shire).

Remaining overclaims, which the labels do not catch:
- **Triggers matched by a broad type rather than a specific card.** "Whenever you cast a creature spell" is accepted for any creature in the deck, so Aeronaut Admiral is credited to Hazoret's Monument and Phantasmal Image (section 6). Same for "another creature enters" (Soul Warden, Copycrook).
- **Replacement and fizzle-style relations** that are not triggers, such as "The Wind Crystal replaces…" and "Peregrin Took adds Food…" (Hurska).
- **Opponent-draw riders** (Bident of Thassa → Arcane Denial).

These are the next validator work. Each is a shared-logic change that moves scores, so each needs its own review under the protection guards.

## 6. Brew ordering against an alternative, same candidate pool

Alternative ordering: strength tier, then number of distinct supporting links, then Brew (same candidates, no new production score). Overlap with the production top ten: 10, 9, 8, 8, 10, 7 for the six decks in order. The two orderings mostly agree because the top-ten is limited by which relations exist, not by order. Brew ordering stays. No new scoring model was added.

## 7. Owned pool and what this is not

- The audit pool is the **real card records from the other decklists in the repository** (Miles, Lathliss, Valgavoth, Kwain, Uugguu, Hurska), filtered to each Commander's color identity and excluding that deck's own cards. Every card is marked as owned and unassigned to the deck under test.
- This is not your physical collection. I cannot read it. The frozen blind holdout corpus was not used at all.
- Six decks, and two of them were the ones you named. Carnage/Mayhem is not in the repository, so it is not covered.

## 8. Top ten per deck

Labels are the engine's, with the printed rule that supports each. The last column is for your judgment.

### Miles 'Tails' Prower
Deck: 100 cards (complete). Owned pool: 148 cards, all unassigned to this deck. Discoverable after guards: 31 (cap off: 31, both guards off: 117).

| # | Card | Label | Brew | What the engine says happens (first supporting rule) | Worth considering? (owner) |
|---|---|---|---|---|---|
| 1 | Arcane Denial | Strongly supported | 49 | Bident of Thassa → Arcane Denial: Its controller may draw up to two cards at the beginning of the next turn's upkeep | |
| 2 | Phantasmal Image | Strongly supported | 37 | Aeronaut Admiral → Phantasmal Image: You may have this creature enter as a copy of any creature on the battlefield, except it's an Illusion in additio… | |
| 3 | Hazoret's Monument | Strongly supported | 35 | Aeronaut Admiral → Hazoret's Monument: Whenever you cast a creature spell, you may discard a card | |
| 4 | Council's Deliberation | Strongly supported | 20 | Temple of Enlightenment → Council's Deliberation: Whenever you scry, if you control an Island, you may exile this card from your graveyard | |
| 5 | Haliya, Guided by Light | Plausible | 55 | _____ _____ Rocketship → Haliya, Guided by Light: Whenever Haliya, Guided by Light or another creature or artifact you control enters, you gain 1 life | |
| 6 | Prince Imrahil the Fair | Plausible | 50 | Commander's Sphere → Prince Imrahil the Fair: Whenever you draw your second card each turn, create a 1/1 white Human Soldier creature token | |
| 7 | Wizard Class | Plausible | 49 | Bident of Thassa → Wizard Class: Whenever you draw a card, put a +1/+1 counter on target creature you control | |
| 8 | Archaeomancer | Plausible | 49 | Graveyard setup / return relationship: Archaeomancer ↔ Shorikai, Genesis Engine; When this creature enters, return target instant or sorcery card from… | |
| 9 | Ominous Seas | Plausible | 48 | Bident of Thassa → Ominous Seas: Whenever you draw a card, put a foreshadow counter on this enchantment | |
| 10 | Exemplar of Light | Plausible | 46 | Absorb → Exemplar of Light: Whenever you gain life, put a +1/+1 counter on this creature | |

Alternative top 10 (strength, then number of supporting links, then Brew): Arcane Denial, Phantasmal Image, Hazoret's Monument, Council's Deliberation, Haliya, Guided by Light, Prince Imrahil the Fair, Wizard Class, Archaeomancer, Ominous Seas, Exemplar of Light. Overlap with production top 10: 10/10.

### Lathliss, Dragon Queen
Deck: 100 cards (complete). Owned pool: 61 cards, all unassigned to this deck. Discoverable after guards: 13 (cap off: 13, both guards off: 14).

| # | Card | Label | Brew | What the engine says happens (first supporting rule) | Worth considering? (owner) |
|---|---|---|---|---|---|
| 1 | Fear of Burning Alive | Strongly supported | 59 | Anger → Fear of Burning Alive: Delirium — Whenever a source you control deals noncombat damage to an opponent, if there are four or more card types am… | |
| 2 | Mask of Memory | Strongly supported | 36 | Anger → Mask of Memory: Whenever equipped creature deals combat damage to a player, you may draw two cards | |
| 3 | Rampaging Ferocidon | Plausible | 48 | Anger → Rampaging Ferocidon: Whenever another creature enters, this creature deals 1 damage to that creature's controller | |
| 4 | Agate Instigator | Plausible | 43 | Anger → Agate Instigator: Whenever another creature you control enters, this creature deals 1 damage to each opponent | |
| 5 | Path of Ancestry | Plausible | 41 | Anger → Path of Ancestry: When that mana is spent to cast a creature spell that shares a creature type with your commander, scry 1 | |
| 6 | Roaming Throne | Plausible | 37 | Additional triggered abilities for Lathliss, Dragon Queen: Ward {2} As this creature enters, choose a creature type. This creature is the chosen type … | |
| 7 | Mishra's Bauble | Plausible | 19 | Bitter Reunion → Mishra's Bauble: Draw a card at the beginning of the next turn's upkeep | |
| 8 | Smuggler's Copter | Plausible | 19 | Graveyard setup / return relationship: Smuggler's Copter ↔ Haven of the Spirit Dragon; Flying Whenever this Vehicle attacks or blocks, you may draw a … | |
| 9 | Three Tree City | Plausible | 10 | Its "one chosen creature type" ability: {2}, {T}: Choose a color. Add an amount of mana of that color equal to the number of creatures you control of … | |
| 10 | Grab the Prize | Plausible | 9 | Graveyard setup / return relationship: Grab the Prize ↔ Haven of the Spirit Dragon; As an additional cost to cast this spell, discard a card. Draw two… | |

Alternative top 10 (strength, then number of supporting links, then Brew): Fear of Burning Alive, Mask of Memory, Rampaging Ferocidon, Agate Instigator, Path of Ancestry, Mishra's Bauble, Three Tree City, Ugin, Eye of the Storms, Smuggler's Copter, Grab the Prize. Overlap with production top 10: 9/10.

### Valgavoth, Harrower of Souls
Deck: 100 cards (complete). Owned pool: 112 cards, all unassigned to this deck. Discoverable after guards: 22 (cap off: 26, both guards off: 70).

| # | Card | Label | Brew | What the engine says happens (first supporting rule) | Worth considering? (owner) |
|---|---|---|---|---|---|
| 1 | Warstorm Surge | Plausible | 53 | Agate Instigator → Warstorm Surge: Whenever a creature you control enters, it deals damage equal to its power to any target | |
| 2 | Parapet Thrasher | Plausible | 49 | Blood Seeker → Parapet Thrasher: Whenever one or more Dragons you control deal combat damage to an opponent, choose one that hasn't been chosen this t… | |
| 3 | Dragonhawk, Fate's Tempest | Plausible | 43 | Dragonhawk, Fate's Tempest → Valgavoth, Harrower of Souls: Whenever an opponent loses life for the first time during each of their turns, put a +1/+1 … | |
| 4 | Mishra's Bauble | Plausible | 40 | Grab the Prize → Mishra's Bauble: Draw a card at the beginning of the next turn's upkeep | |
| 5 | Hazoret's Monument | Plausible | 40 | Agate Instigator → Hazoret's Monument: Whenever you cast a creature spell, you may discard a card | |
| 6 | Well of Lost Dreams | Plausible | 36 | Bastion of Remembrance → Well of Lost Dreams: Whenever you gain life, you may pay {X}, where X is less than or equal to the amount of life you gained | |
| 7 | Path of Ancestry | Plausible | 33 | Agate Instigator → Path of Ancestry: When that mana is spent to cast a creature spell that shares a creature type with your commander, scry 1 | |
| 8 | Mask of Memory | Plausible | 31 | Agate Instigator → Mask of Memory: Whenever equipped creature deals combat damage to a player, you may draw two cards | |
| 9 | Corrupted Zendikon | Plausible | 28 | Bastion of Remembrance → Corrupted Zendikon: When enchanted land dies, return that card to its owner's hand | |
| 10 | Dragonmaster Outcast | Plausible | 28 | Its "lands to control" ability: At the beginning of your upkeep, if you control six or more lands, create a 5/5 red Dragon creature token with flying. | |

Alternative top 10 (strength, then number of supporting links, then Brew): Warstorm Surge, Parapet Thrasher, Mishra's Bauble, Hazoret's Monument, Well of Lost Dreams, Path of Ancestry, Mask of Memory, Dragonmaster Outcast, Uchuulon, Cursed Mirror. Overlap with production top 10: 8/10.

### Kwain, Itinerant Meddler
Deck: 100 cards (complete). Owned pool: 138 cards, all unassigned to this deck. Discoverable after guards: 52 (cap off: 52, both guards off: 87).

| # | Card | Label | Brew | What the engine says happens (first supporting rule) | Worth considering? (owner) |
|---|---|---|---|---|---|
| 1 | Chrome Host Seedshark | Strongly supported | 36 | Adarkar Wastes → Chrome Host Seedshark: Whenever you cast a noncreature spell, incubate X, where X is that spell's mana value | |
| 2 | Path of Ancestry | Strongly supported | 33 | Path of Ancestry → Council's Deliberation: Whenever you scry, if you control an Island, you may exile this card from your graveyard | |
| 3 | Phantasmal Image | Strongly supported | 30 | Alandra, Sky Dreamer → Phantasmal Image: You may have this creature enter as a copy of any creature on the battlefield, except it's an Illusion in add… | |
| 4 | Hazoret's Monument | Strongly supported | 29 | Archaeomancer → Hazoret's Monument: Whenever you cast a creature spell, you may discard a card | |
| 5 | Temple of Enlightenment | Strongly supported | 9 | Temple of Enlightenment → Council's Deliberation: Whenever you scry, if you control an Island, you may exile this card from your graveyard | |
| 6 | Thopter Fabricator | Plausible | 47 | Arcane Denial → Thopter Fabricator: Whenever you draw your second card each turn, create a 1/1 colorless Thopter artifact creature token with flying | |
| 7 | Mishra's Bauble | Plausible | 38 | Aura Blast → Mishra's Bauble: Draw a card at the beginning of the next turn's upkeep | |
| 8 | Soul Warden | Plausible | 38 | Alandra, Sky Dreamer → Soul Warden: Whenever another creature enters, you gain 1 life | |
| 9 | The Wind Crystal | Plausible | 38 | The Wind Crystal replaces the amount of a real life-gain event for Approach of the Second Sun; it does not originate life gain or multiply the number … | |
| 10 | Well of Lost Dreams | Plausible | 37 | Approach of the Second Sun → Well of Lost Dreams: Whenever you gain life, you may pay {X}, where X is less than or equal to the amount of life you gai… | |

Alternative top 10 (strength, then number of supporting links, then Brew): Chrome Host Seedshark, Path of Ancestry, Phantasmal Image, Hazoret's Monument, Temple of Enlightenment, Thopter Fabricator, Mishra's Bauble, Soul Warden, Copycrook, Kindred Discovery. Overlap with production top 10: 8/10.

### Uugguu, the Omniplasm
Deck: 100 cards (complete). Owned pool: 146 cards, all unassigned to this deck. Discoverable after guards: 67 (cap off: 68, both guards off: 68).

| # | Card | Label | Brew | What the engine says happens (first supporting rule) | Worth considering? (owner) |
|---|---|---|---|---|---|
| 1 | Chrome Host Seedshark | Strongly supported | 71 | Arcane Adaptation → Chrome Host Seedshark: Whenever you cast a noncreature spell, incubate X, where X is that spell's mana value | |
| 2 | Mask of Memory | Strongly supported | 54 | Acidic Slime → Mask of Memory: Whenever equipped creature deals combat damage to a player, you may draw two cards | |
| 3 | Hazoret's Monument | Strongly supported | 42 | Acidic Slime → Hazoret's Monument: Whenever you cast a creature spell, you may discard a card | |
| 4 | Dragon's Hoard | Strongly supported | 34 | Chomping Changeling → Dragon's Hoard: Whenever a Dragon you control enters, put a gold counter on this artifact | |
| 5 | Arcane Denial | Strongly supported | 27 | Deadly Dispute → Arcane Denial: Its controller may draw up to two cards at the beginning of the next turn's upkeep | |
| 6 | Council's Deliberation | Strongly supported | 7 | Path of Ancestry → Council's Deliberation: Whenever you scry, if you control an Island, you may exile this card from your graveyard | |
| 7 | Bastion of Remembrance | Plausible | 77 | Ashnod's Altar → Bastion of Remembrance: Whenever a creature you control dies, each opponent loses 1 life and you gain 1 life | |
| 8 | Tireless Provisioner | Plausible | 77 | Assassin's Trophy → Tireless Provisioner: Landfall — Whenever a land you control enters, create a Food token or a Treasure token | |
| 9 | Twenty-Toed Toad | Plausible | 72 | Acidic Slime → Twenty-Toed Toad: Whenever you attack with two or more creatures, put a +1/+1 counter on this creature and draw a card | |
| 10 | Blood Artist | Plausible | 71 | Ashnod's Altar → Blood Artist: Whenever this creature or another creature dies, target player loses 1 life and you gain 1 life | |

Alternative top 10 (strength, then number of supporting links, then Brew): Chrome Host Seedshark, Mask of Memory, Hazoret's Monument, Arcane Denial, Dragon's Hoard, Council's Deliberation, Bastion of Remembrance, Tireless Provisioner, Twenty-Toed Toad, Blood Artist. Overlap with production top 10: 10/10.

### Hurska Sweet-Tooth
Deck: 100 cards (complete). Owned pool: 93 cards, all unassigned to this deck. Discoverable after guards: 27 (cap off: 28, both guards off: 84).

| # | Card | Label | Brew | What the engine says happens (first supporting rule) | Worth considering? (owner) |
|---|---|---|---|---|---|
| 1 | Ugin, Eye of the Storms | Strongly supported | 60 | Alhammarret's Archive → Ugin, Eye of the Storms: When you cast this spell, exile up to one target permanent that's one or more colors | |
| 2 | Mask of Memory | Strongly supported | 48 | Samwise Gamgee → Mask of Memory: Whenever equipped creature deals combat damage to a player, you may draw two cards | |
| 3 | Hazoret's Monument | Strongly supported | 28 | Academy Manufactor → Hazoret's Monument: Whenever you cast a creature spell, you may discard a card | |
| 4 | The Prydwen, Steel Flagship | Plausible | 72 | Academy Manufactor → The Prydwen, Steel Flagship: Whenever another nontoken artifact you control enters, create a 2/2 white Human Knight creature toke… | |
| 5 | Sephara, Sky's Blade | Plausible | 60 | Sephara, Sky's Blade → Hurska Sweet-Tooth: Whenever you gain life, you may pay {G/W} | |
| 6 | Springleaf Parade | Plausible | 55 | Peregrin Took adds Food to Springleaf Parade's controlled token-creation event; the replacement does not initiate its own event. | |
| 7 | Rolling Hamsphere | Plausible | 54 | Peregrin Took adds Food to Rolling Hamsphere's controlled token-creation event; the replacement does not initiate its own event. | |
| 8 | Mitotic Slime | Plausible | 48 | Apothecary White → Mitotic Slime: They have "When this token dies, create two 1/1 green Ooze creature tokens | |
| 9 | Parhelion II | Plausible | 47 | Peregrin Took adds Food to Parhelion II's controlled token-creation event; the replacement does not initiate its own event. | |
| 10 | Doubling Season | Plausible | 46 | Amplifies the actual counter placements from Banquet Guests; replacement effects alone do not originate counters: If an effect would create one or mor… | |

Alternative top 10 (strength, then number of supporting links, then Brew): Ugin, Eye of the Storms, Mask of Memory, Hazoret's Monument, The Prydwen, Steel Flagship, Sephara, Sky's Blade, Mitotic Slime, Doubling Season, Biowaste Blob, Parallel Lives, Path of Ancestry. Overlap with production top 10: 7/10.


## 9. Next step

Decide, in order: (1) whether the audit's top ten is useful on your own decks, using the last column; (2) whether to fund the next validator pass on broad-type triggers, which will move scores and needs its own review; (3) whether the protection guards should be re-baselined for a new boundary (see `docs/PROTECTION-REVIEW.md`).

## 10. Validation (final code, exact)

| Check | Command | Result |
| --- | --- | --- |
| Lint | `npx eslint .` | exit 0 |
| Typecheck and production build | `npm run build` (`tsc -b && vite build`) | exit 0 |
| Brew-lab build (for Brew Lab tests) | `npm run build:brew-lab` | exit 0 |
| Unit | `npx vitest run tests/unit` | 1031 passed, 2 failed of 1033 (the two guards in `docs/PROTECTION-REVIEW.md`: G1, G2) |
| Prototype | `npx vitest run tests/prototype` | 186 passed, 2 failed of 188 (guards G3, G4) |
| Audit (evaluation only) | `AUDIT_OUT=docs/audit/discovery-quality.json npx vitest run tests/audit/discoveryQuality.test.ts` | six decks, output in `docs/audit/discovery-quality.json` |
| Browser, full production build | `TEST_PRODUCTION=1 PRE_ANALYZER_DIST=<baseline 2a665f0 build> npx playwright test` | **575 passed, 20 failed, 15 skipped of 610** (18.5 min) |
| Browser, Brew Lab with brew-lab build | `npx playwright test tests/browser/brewLab.spec.ts` | 13 passed, 2 failed (mobile-360 Commander and Legacy compare) |

Failures, classified:
- **Brew Lab, 15 entries (production build).** Brew Lab is hidden in production by design: `analyzerAvailable()` requires the brew-lab mode or the gates to pass. These tests need the brew-lab build. On that build, 13 of 15 pass. The two mobile-360 failures are identical on the untouched baseline brew-lab build (a `<details>` paragraph intercepts pointer events over the summary at 360 px). This is not caused by this branch.
- **Decks Add Card contrast, 3 entries** (mobile-360, 390, desktop). Same failure on the untouched baseline (verified on 390, tablet and desktop).
- **Card Detail contrast, 2 entries** (desktop, mobile-430). Small muted text in the Legacy detail dialog measures 4.35:1 against 4.5:1 and sometimes 3.4:1 during the dialog transition. No color token changed on this branch. Pre-existing and intermittent.

Storage preservation:
- `git diff 2a665f0 -- src/storage src/models src/import src/decks src/intelligence src/app` is empty. No IndexedDB schema, key, or write path changed.
- Same-origin old-build-to-new-build tests (`experimentalAnalyzer.spec.ts`, which read the baseline build through `PRE_ANALYZER_DIST`): **10 of 10 passed** (Commander and Legacy on all five projects).
- The discovery landing spec passes on all five projects and checks that the collection snapshot is unchanged and makes zero Scryfall calls.
