import type { CardSynergy } from "../dna/engine";
import type { DeckStrategyProfile } from "../dna/strategy";

/** Presentation only: translates the frozen score's evidence, never rescoring. */
export function candidateSummary(
  synergy: CardSynergy,
  profile: DeckStrategyProfile,
): string {
  const evidence = synergy.debug;
  const themes = profile.primaryArchetypes
    .filter((theme) => evidence.matchedTags.includes(theme.tag))
    .map((theme) => theme.label)
    .slice(0, 2);
  const needed = synergy.reasons.find((reason) => reason.startsWith("Needed "))
    ?.replace(/^Needed /, "").replace(/ \(.*/, "").toLocaleLowerCase()
    .replace(/payoffs$/, "payoff").replace(/enablers$/, "enabler")
    .replace(/tutors$/, "tutor").replace(/finishers$/, "finishing")
    .replace(/lands$/, "land").replace(/wipes$/, "wipe").replace(/outlets$/, "outlet");
  const support: string[] = [];
  if (evidence.archetypeFit > 0 && themes.length)
    support.push(`supports ${themes.join(" and ")}`);
  if (evidence.roleNeed > 0 && needed)
    support.push(`fills a needed ${needed} role`);
  if (evidence.commanderSynergy >= 20)
    support.push("directly reinforces the Commander");
  else if (evidence.commanderSynergy > 0)
    support.push("has some interaction with the Commander");
  if (!support.length && evidence.packageMatch > 0)
    support.push("supports an established card package");
  const penalty = (name: string) => evidence.penalties.some((p) => p.name === name);
  let caveat = "";
  if (evidence.penalties.some((p) => /anti-synergy|engine conflict/i.test(p.name)))
    caveat = "Some effects work against the deck’s existing engines.";
  else if (penalty("Redundant role"))
    caveat = "This deck already has plenty of cards serving its roles.";
  else if (penalty("Off-archetype creature"))
    caveat = "Its creature type does not support the deck’s main typal plan.";
  else if (penalty("Low impact for mana value"))
    caveat = "Its recorded effects offer limited impact for the mana cost.";
  else if (penalty("Curve congestion"))
    caveat = "The deck already has many cards at this mana cost.";
  else if (penalty("No Commander interaction"))
    caveat = "No direct interaction with the Commander was identified.";
  const joined = support.length > 2
    ? `${support.slice(0, -1).join(", ")}, and ${support.at(-1)}`
    : support.join(" and ");
  const positive = joined ? joined[0].toUpperCase() + joined.slice(1) : "";
  if (synergy.score >= 50)
    return `${positive || "Offers some useful support in this deck"}.${caveat ? ` ${caveat}` : ""}`;
  if (positive)
    return `Limited fit: ${joined}. ${caveat || "These benefits do not add up to a strong fit in this deck."}`;
  const plan = profile.primaryArchetypes.slice(0, 2).map((t) => t.label).join(" / ");
  const missing = evidence.roleNeed === 0
    ? " and does not fill an identified missing role"
    : "";
  return `Does not meaningfully support ${plan ? `the primary ${plan} plan` : "the primary strategy"}${missing}.${caveat ? ` ${caveat}` : ""}`;
}
