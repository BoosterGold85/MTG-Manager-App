import type { CardMetadata } from "../models/collection";
import { stripAbilityWord, stripReminderText } from "../utils/rulesText";

/** An ability triggered by this permanent's own entry, not by arbitrary creatures entering. */
export function hasSelfEntryAbility(card: CardMetadata): boolean {
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
