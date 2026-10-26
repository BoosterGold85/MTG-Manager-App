// Owned-collection candidates named in the Upgrades I Own directive.
// Oracle wording is canonical modern templating written from memory: Scryfall was not reachable
// from the build environment. Re-check against Scryfall when refreshing this fixture.
import type { CardMetadata } from "../src/models/collection";
import type { Color } from "../src/models/card";
import { sol } from "./importFixtures";
export function oracleCard(
  name: string,
  manaCost: string,
  manaValue: number,
  typeLine: string,
  oracleText: string,
  colorIdentity: Color[] = ["R"],
  extra: Partial<CardMetadata> = {},
): CardMetadata {
  return {
    name,
    manaCost,
    manaValue,
    typeLine,
    oracleText,
    colorIdentity,
    keywords: [],
    scryfallId: `candidate:${name}`,
    oracleId: `candidate:${name}`,
    setCode: "cnd",
    collectorNumber: name,
    rarity: "rare",
    imageUrl: sol.imageUrl,
    thumbnailUrl: sol.thumbnailUrl,
    ...extra,
  };
}
export const candidates = {
  dragonHatchling: oracleCard("Dragon Hatchling", "{1}{R}", 2, "Creature — Dragon", "Flying\n{R}: This creature gets +1/+0 until end of turn.", ["R"], { keywords: ["Flying"], power: "0", toughness: "1" }),
  hoardingDragon: oracleCard("Hoarding Dragon", "{3}{R}{R}", 5, "Creature — Dragon", "Flying\nWhen this creature enters, you may search your library for an artifact card, exile it, then shuffle.\nWhen this creature dies, you may put the exiled card into its owner's hand.", ["R"], { keywords: ["Flying"], power: "4", toughness: "4" }),
  fieryEmancipation: oracleCard("Fiery Emancipation", "{3}{R}{R}{R}", 6, "Enchantment", "If a source you control would deal damage to a permanent or player, it deals triple that damage to that permanent or player instead."),
  savageBeating: oracleCard("Savage Beating", "{3}{R}{R}", 5, "Instant", "Entwine {1}{R} (Choose both if you pay the entwine cost.)\nChoose one —\n• Creatures you control gain double strike until end of turn.\n• Untap all creatures you control. After this phase, there is an additional combat phase.", ["R"], { keywords: ["Entwine"] }),
  combatCelebrant: oracleCard("Combat Celebrant", "{2}{R}", 3, "Creature — Human Warrior", "If this creature hasn't been exerted this turn, you may exert it as it attacks. When you do, untap all other creatures you control and after this phase, there is an additional combat phase. (An exerted creature won't untap during your next untap step.)", ["R"], { power: "4", toughness: "1" }),
  xorn: oracleCard("Xorn", "{2}{R}", 3, "Creature — Elemental", "If you would create one or more Treasure tokens, instead create those tokens plus an additional Treasure token.", ["R"], { power: "3", toughness: "2" }),
  vandalblast: oracleCard("Vandalblast", "{R}", 1, "Sorcery", "Destroy target artifact you don't control.\nOverload {4}{R} (You may cast this spell for its overload cost. If you do, change its text by replacing all instances of \"target\" with \"each.\")", ["R"], { keywords: ["Overload"] }),
  deathByDragons: oracleCard("Death by Dragons", "{4}{R}{R}", 6, "Sorcery", "Each player other than target player creates a 5/5 red Dragon creature token with flying."),
  doublingSeason: oracleCard("Doubling Season", "{4}{G}", 5, "Enchantment", "If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead.\nIf an effect would put one or more counters on a permanent you control, it puts twice that many of those counters on that permanent instead.", ["G"]),
};
