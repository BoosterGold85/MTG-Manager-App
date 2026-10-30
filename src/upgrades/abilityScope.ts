import type { CardMetadata } from "../models/collection";
import { stripAbilityWord, stripReminderText } from "../utils/rulesText";

/** An ability triggered by this permanent's own entry, not by arbitrary creatures entering. */
function computeSelfEntry(card: CardMetadata): boolean {
  const faces = card.cardFaces?.length
    ? [card.cardFaces[0]]
    : [{ name: card.name, oracleText: card.oracleText }];
  return faces.some((face) => {
    const names = [face.name, face.name.split(",")[0]]
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    return stripReminderText(face.oracleText || "")
      .split("\n")
      .some((raw) => {
        let line = stripAbilityWord(raw.trim());
        for (const name of names) line = line.split(name).join("SELF");
        return /^(?:When|Whenever) (?:SELF|this (?:creature|permanent|artifact|enchantment))(?: or another [^,]+)? enters(?: the battlefield)?(?:,|$)/i.test(
          line,
        );
      });
  });
}

/** Only the reusable self-entry lines, excluding death, cast and activated abilities.
 * Cast-from-hand entry conditions are not fulfilled by blink or a copy. */
function computeEntryEffect(card: CardMetadata): CardMetadata | undefined {
  const face = card.cardFaces?.[0] || card;
  const lines = stripReminderText(face.oracleText || "").split("\n").filter(raw => {
    let line = stripAbilityWord(raw.trim());
    for (const name of [face.name, face.name.split(",")[0]].sort((a,b) => b.length-a.length))
      if (name) line = line.split(name).join("SELF");
    return /^(?:When|Whenever) (?:SELF|this (?:creature|permanent|artifact|enchantment))(?: or another [^,]+)? enters(?: the battlefield)?(?:,|$)/i.test(line) &&
      !/\bif (?:you cast|it was cast|this spell was cast)|\bif you (?:paid|spent)\b/i.test(line);
  });
  if (!lines.length) return undefined;
  return { ...card, typeLine: "Sorcery", cardFaces: undefined, oracleText: lines.join("\n"), power: undefined, toughness: undefined, keywords: [] };
}

const entryCache = new WeakMap<CardMetadata, boolean>();
export function hasSelfEntryAbility(card: CardMetadata): boolean {
  let entry = entryCache.get(card);
  if (entry === undefined) entryCache.set(card, entry = computeSelfEntry(card));
  return entry;
}

const effectCache = new WeakMap<CardMetadata, CardMetadata | undefined>();
export function selfEntryEffect(card: CardMetadata): CardMetadata | undefined {
  if (!effectCache.has(card)) effectCache.set(card, computeEntryEffect(card));
  return effectCache.get(card);
}
