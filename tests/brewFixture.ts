// Brew Score calibration decks (real Scryfall data, tests/data/brew-cards.json). These are separate from the holdout
// decks, which are used only to check the engine afterwards.
//   Vorel counters: +1/+1 counter sources, clone/copy effects, graveyard value: Evolution Witness should be a strong brew.
//   Tatyova landfall: almost no counters, no clones, little graveyard value: the negative control for the same card.
import raw from "./data/brew-cards.json" with { type: "json" };
import { normalizeCard } from "../src/import/scryfall";
import type { CardMetadata } from "../src/models/collection";
import { dnaFixture } from "./dnaFixtures";
import { synergyFixture } from "./synergyFixtures";

export const brewCards = raw.map((c) => normalizeCard({ ...c, object: "card", set_name: "Brew calibration" } as unknown as Parameters<typeof normalizeCard>[0]));
export const brewCard = (name: string): CardMetadata => {
  const c = brewCards.find((x) => x.name === name || x.name.split(" // ").includes(name));
  if (!c) throw new Error(`Brew card missing: ${name}`);
  return c;
};
const COUNTERS = ["Hardened Scales", "Branching Evolution", "Ivy Lane Denizen", "Forgotten Ancient", "Kalonian Hydra", "Experiment One", "Cytoplast Root-Kin", "Rishkar, Peema Renegade", "Evolution Sage", "Simic Ascendancy", "Master Biomancer", "Zameck Guildmage", "Bred for the Hunt", "Inspiring Call", "Armorcraft Judge", "Vigean Graftmage", "Biogenic Upgrade", "Incubation Druid", "Plaxcaster Frogling", "Gyre Engineer"];
const CLONES = ["Clone", "Spark Double", "Phantasmal Image", "Quasiduplicate", "Progenitor Mimic", "Mirror Image"];
const GRAVEYARD = ["Eternal Witness", "Satyr Wayfinder", "Mulch", "Life from the Loam", "Grapple with the Past", "Ramunap Excavator", "Splendid Reclamation", "Mystic Sanctuary", "Golgari Grave-Troll"];
const SIMIC_STAPLES = ["Sol Ring", "Rampant Growth", "Cultivate", "Kodama's Reach", "Counterspell", "Beast Within", "Rhystic Study", "Ponder", "Cyclonic Rift", "Heroic Intervention", "Swan Song", "Nature's Lore", "Three Visits", "Fact or Fiction", "Pongify", "Rapid Hybridization", "Krosan Grip", "Sylvan Library", "Lightning Greaves"];
const SIMIC_LANDS = ["Breeding Pool", "Yavimaya Coast", "Hinterland Harbor", "Command Tower", "Exotic Orchard"];
const LANDFALL = ["Lotus Cobra", "Avenger of Zendikar", "Harmonize", "Explore", "Growth Spiral", "Coiling Oracle", "Wood Elves", "Farhaven Elf", "Mystic Snake", "Aether Gust", "Fierce Guardianship", "Tishana's Tidebinder", "Brainstorm", "Reclamation Sage", "Retreat to Coralhelm", "Tireless Provisioner", "Aesi, Tyrant of Gyre Strait", "Roil Elemental", "Hydroid Krasis", "Oracle of Mul Daya", "Azusa, Lost but Seeking", "Dryad of the Ilysian Grove", "Exploration", "Burgeoning", "Mystic Remora", "Simic Signet"];
/** Owned candidates offered to both decks. */
export const BREW_CANDIDATES = ["Evolution Witness", "Arcane Signet", "Mind Stone", "Psychic Battle", "Gyre Sage", "Llanowar Elves", "Elvish Visionary", "Scavenging Ooze", "Biomass Mutation", "Rogue's Passage"];
function deck(commander: string, names: string[], name: string, extra: CardMetadata[] = []) {
  const main = [...names.map(brewCard), ...extra];
  const basics = [brewCard("Forest"), brewCard("Island")];
  const f = dnaFixture(brewCard(commander), [...main, ...basics]);
  f.deck.name = name;
  const lands = main.filter((c) => /\bLand\b/.test(c.typeLine.split("—")[0])).length;
  const fill = Math.max(2, 36 - lands);
  f.deck.entries!.find((e) => e.name === "Forest")!.quantity = Math.ceil(fill / 2);
  f.deck.entries!.find((e) => e.name === "Island")!.quantity = Math.floor(fill / 2);
  const owned = synergyFixture().owned;
  for (const c of BREW_CANDIDATES.map(brewCard)) {
    f.state.metadata[c.scryfallId] = c;
    f.state.items.push(owned(c, c.scryfallId, 1));
  }
  return f;
}
export const vorelCountersFixture = ({ clones = true, extra = [] as CardMetadata[] } = {}) =>
  deck("Vorel of the Hull Clade", [...COUNTERS, ...(clones ? CLONES : []), ...GRAVEYARD, ...SIMIC_STAPLES, ...SIMIC_LANDS], "Vorel Counters Brew", extra);
export const tatyovaLandfallFixture = () => deck("Tatyova, Benthic Druid", [...LANDFALL, ...SIMIC_STAPLES, ...SIMIC_LANDS], "Tatyova Landfall");
