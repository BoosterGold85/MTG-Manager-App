# MTG Manager v0.6.17 — Blind Real-Deck Holdout Pack

Use these 10 public Commander decks as blind holdouts for real-deck generalization testing.

## Freeze before evaluation

Before the first engine run, freeze:
- the current 100-card export
- source URL
- timestamp
- content hash
- human-written plan
- expected upgrades
- misleading suggestions

If an expected upgrade is already present in the captured list, replace that expectation BEFORE evaluation and record why.

Do not inspect rankings and then alter expectations.
Do not add Commander names, card names, deck names, or holdout-specific thresholds to production logic.

Public lists may change, so capture and hash the current list before scoring.

## Holdouts

### 1. Anikthea, Hand of Erebos — Enchantments / graveyard recursion
Source: https://archidekt.com/decks/25801366/anikthea_hand_of_erebos

Plan: Use enchantments as the primary engine, stock the graveyard, then reuse valuable non-Aura enchantments through Anikthea while building an enchantment-creature/token board. Enchantress value and recursion matter more than Aura Voltron.

Expected upgrades: Starfield of Nyx, Weaver of Harmony, Doomwake Giant, Nyx Weaver, Composer of Spring

Misleading suggestions: Ethereal Armor, Kor Spiritdancer

Why misleading: They look enchantment-synergistic but push Aura Voltron, while Anikthea specifically wants non-Aura enchantments to recur.

### 2. Krenko, Mob Boss — Goblin swarm / repeated Commander activation
Source: https://archidekt.com/decks/26105955/krenko_mob_boss

Plan: Resolve and protect Krenko, give him haste or repeated untaps, exponentially grow the Goblin count, then turn the swarm into combat damage, sacrifice value, or burst mana.

Expected upgrades: Thousand-Year Elixir, Magewright's Stone, Skirk Prospector, Goblin Chirurgeon, Brightstone Ritual

Misleading suggestions: Brass's Bounty, Etali, Primal Storm

Why misleading: Expensive generic red value should not outrank cards that directly increase Krenko activations or exploit the Goblin mass.

### 3. Teysa Karlov — Aristocrats / death triggers
Source: https://archidekt.com/decks/20407587/1_teysa_karlov_is_my_wife

Plan: Sacrifice creatures and tokens for value, double death-triggered abilities with Teysa, and win through drain, recursive fodder, and death payoffs.

Expected upgrades: Requiem Angel, Blasting Station, Sifter of Skulls

Misleading suggestions: Soul Warden, Cathars' Crusade

Why misleading: Token quantity alone should not turn the deck into generic lifegain or +1/+1-counter go-wide.

### 4. Feather, the Redeemed — Targeted spells / reusable cantrips
Source: https://archidekt.com/decks/4071438/feather_the_redeemed

Plan: Cast cheap spells targeting your own creatures, recycle them through Feather, protect Feather, trigger spellslinger effects, and convert repeated spell value into combat pressure.

Expected upgrades: Mavinda, Students' Advocate, Psychotic Fury, Homestead Courage

Misleading suggestions: Aurelia, the Warleader, Heroic Reinforcements

Why misleading: Generic Boros combat cards should not outrank repeatable targeted spells that actually participate in Feather's engine.

### 5. Sram, Senior Edificer — Equipment Voltron
Source: https://archidekt.com/decks/27229313/sram_senior_edificer

Plan: Cast cheap Equipment and Auras to keep Sram drawing, efficiently attach them to a threat, and turn equip/attachment synergy into a compact Voltron engine.

Expected upgrades: Ardenn, Intrepid Archaeologist, Armored Skyhunter, Halvar, God of Battle

Misleading suggestions: Parhelion II, Skysovereign, Consul Flagship

Why misleading: Vehicles technically trigger Sram, but that alone should not make a Vehicle package strategically important in an Equipment-focused list.

### 6. Chulane, Teller of Tales — Creature casting / bounce-recast engine
Source: https://archidekt.com/decks/1337204/chulane_teller_of_tales

Plan: Chain creatures to turn Chulane into card and land velocity, then repeatedly bounce and recast creatures to reuse cast and ETB effects.

Expected upgrades: Aluren, Intruder Alarm, Equilibrium, Stonecloaker

Misleading suggestions: Scute Swarm, Avenger of Zendikar

Why misleading: Chulane puts lands onto the battlefield, but that should not cause pure landfall-token cards to displace creature-cast/bounce engines.

### 7. Meren of Clan Nel Toth — Creature recursion / sacrifice
Source: https://archidekt.com/decks/21327000/meren_of_clan_nel_toth

Plan: Sacrifice creatures for value, build experience, and repeatedly recur creature-based removal, ramp, tutors, and value pieces through Meren.

Expected upgrades: Foundation Breaker, Journey to Eternity, Haywire Mite, Birthing Pod, Vile Entomber

Misleading suggestions: Doubling Season, Hardened Scales

Why misleading: Meren's experience counters are on the player. Generic permanent/+1/+1 counter amplification should not be mistaken for direct support.

### 8. Brago, King Eternal — Blink / ETB control
Source: https://archidekt.com/decks/24576453/brago_king_eternal

Plan: Connect with Brago and repeatedly blink useful nonland permanents to reuse ETBs, removal, draw and control pieces until repeated value or a loop takes over.

Expected upgrades: Preston, the Vanisher, Virtue of Knowledge, Eerie Interlude, Momentary Blink

Misleading suggestions: Sai, Master Thopterist, Thought Monitor

Why misleading: Brago uses plenty of artifacts as infrastructure, but artifact density should not incorrectly turn it into an artifact-token deck.

### 9. Chatterfang, Squirrel General — Tokens / sacrifice
Source: https://archidekt.com/decks/9494289/chatterfang_squirrel_general

Plan: Convert every token source into additional Squirrels, then spend those bodies as sacrifice resources for removal, drain, mana and combo value.

Expected upgrades: Nested Shambler, Cloakwood Hermit, Creakwood Liege, Squirrel Sovereign

Misleading suggestions: Dina, Soul Steeper, Bloodchief Ascension

Why misleading: Incidental lifegain/life-loss overlap should not outrank the much stronger token-generation and sacrifice relationships.

### 10. Gishath, Sun's Avatar — Dinosaur ramp / combat-cheat
Source: https://archidekt.com/decks/12410149/gishath_suns_avatar

Plan: Ramp aggressively into Gishath, connect in combat, and maximize Dinosaur hit density and top-deck quality so Gishath's damage turns into a large board of Dinosaurs.

Expected upgrades: Scroll Rack, Sensei's Divining Top, Temple Altisaur

Misleading suggestions: Beast Whisperer, Hardened Scales

Why misleading: Beast Whisperer rewards casting creatures while Gishath cheats many directly into play; Hardened Scales has no reason to score highly without a real counter package.
