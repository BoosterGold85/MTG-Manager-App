import type { CardMetadata } from "../models/collection";
import { stripReminderText } from "../utils/rulesText";

const textOf = (card: CardMetadata) =>
  stripReminderText(card.cardFaces?.[0]?.oracleText || card.oracleText || "");
const normalizeSelf = (card: CardMetadata, text: string) => {
  for (const name of [card.name, card.name.split(",")[0]].sort(
    (a, b) => b.length - a.length,
  ))
    if (name) text = text.split(name).join("SELF");
  return text.replace(/this (?:creature|permanent|artifact)/gi, "SELF");
};
const typeOf = (card: CardMetadata) =>
  (card.cardFaces?.[0]?.typeLine || card.typeLine).split("—")[0];
export const countersTargetSelf = (card: CardMetadata, trigger: string) =>
  /on SELF\b/i.test(normalizeSelf(card, trigger));
/** Global counter observers can see self-only placement on compatible permanents. */
export function suppliesCounterEvent(
  source: CardMetadata,
  recipient: CardMetadata,
  selfTarget: boolean,
): boolean {
  if (placesCountersOn(source, recipient)) return true;
  if (selfTarget) return false;
  const types = typeOf(recipient),
    sourceTypes = typeOf(source);
  const compatible =
    types === "Permanent" ||
    types
      .trim()
      .split(/\s+/)
      .filter((t) =>
        [
          "Artifact",
          "Creature",
          "Enchantment",
          "Land",
          "Planeswalker",
        ].includes(t),
      )
      .every((t) => new RegExp(`\\b${t}\\b`).test(sourceTypes));
  return compatible && placesCountersOn(source, source, true);
}
/** Target scope for a counter trigger; callers use this in the supply cache key too. */
export function counterRecipient(
  card: CardMetadata,
  trigger: string,
): CardMetadata {
  const normalized = normalizeSelf(card, trigger);
  if (countersTargetSelf(card, trigger)) return card;
  const kind = /on (?:a |another |each |one or more )?artifact creature/i.test(
    normalized,
  )
    ? "Artifact Creature"
    : /\bcreatures?\b/i.test(normalized)
      ? "Creature"
      : "Permanent";
  return { ...card, typeLine: kind, cardFaces: undefined };
}
/** A real way to put initial counters on this recipient, not merely a payoff or an amplifier.
 * Unknown target qualifiers are deliberately omitted rather than treated as any creature. */
export function placesCountersOn(
  source: CardMetadata,
  recipient: CardMetadata,
  self = false,
): boolean {
  const types = typeOf(recipient),
    creature = /^Permanent$/.test(types) || /\bCreature\b/.test(types),
    artifact = /^Permanent$/.test(types) || /\bArtifact\b/.test(types);
  const text = normalizeSelf(source, textOf(source));
  for (const line of text.split("\n")) {
    // Receiving counters and replacing/doubling/proliferating existing counters do not originate them.
    if (
      /\b(?:opponents?|that player|they) (?:puts?|may put)\b/i.test(line) ||
      /^If\b|\bwould be put\b|^Whenever[^,]*counters? (?:are|is) put/i.test(
        line,
      )
    )
      continue;
    if (
      self &&
      creature &&
      /\b(?:adapt|outlast|evolve|riot|training|monstrosity|fabricate)\b|\bSELF enters? with[^.]*\+1\/\+1 counter/i.test(
        line,
      )
    )
      return true;
    if (!/\+1\/\+1 counters?/i.test(line)) continue;
    const put = /\b(?:put|distribute)\b/i.test(line);
    const each =
      /\b(?:each|other|all) creatures? you control enters? with[^.]*\+1\/\+1 counters?/i.test(
        line,
      );
    if (creature && each) return true;
    if (self && put && /\bon SELF\b/i.test(line)) return true;
    if (!put && !/\bmove\b/i.test(line)) continue;
    const recipientText =
      line.match(/\b(?:on|onto|among) (.+?)(?:\.|$)/i)?.[1] || "";
    if (
      /^(?:each of )?(?:(?:up to )?(?:one|two|three|\d+) )?target (?:creatures?|permanents?)(?:\s*(?:\.|$)| you control\b)/i.test(
        recipientText,
      )
    ) {
      if (/^.*target permanents?/i.test(recipientText) || creature) return true;
    }
    if (
      creature &&
      /^(?:one, two, or three|one or two|two|three) target creatures?\b/i.test(
        recipientText,
      )
    )
      return true;
    if (
      creature &&
      /^(?:each|all|other|another|any number of other|any number of target) creatures?(?: you control)?(?:\s*(?:\.|$)|,)/i.test(
        recipientText,
      )
    )
      return true;
    if (
      artifact &&
      creature &&
      /^(?:target|another target) artifact creature\b/i.test(recipientText)
    )
      return true;
    if (
      artifact &&
      /^(?:target|each|another) artifact(?:\s*(?:\.|$)| you control\b)/i.test(
        recipientText,
      )
    )
      return true;
    // The arriving creature is the counter recipient, rather than the source itself.
    if (
      creature &&
      /(?:another |a |each )creature you control enters[^,]*,.*\bput[^.]*\+1\/\+1 counter[^.]*on that creature/i.test(
        line,
      )
    )
      return true;
  }
  return false;
}
