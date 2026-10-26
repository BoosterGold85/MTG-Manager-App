/** Reminder text describes nested/keyword rules; it is not another ability of this card. */
export function stripReminderText(text: string) {
  let depth = 0,
    output = "";
  for (const character of text) {
    if (character === "(") depth++;
    else if (character === ")" && depth) depth--;
    else if (!depth) output += character;
  }
  return output;
}
/** Ability words carry no independent rules; retain the following condition verbatim. */
export function stripAbilityWord(text: string) {
  return text.replace(
    /^[A-Za-z][A-Za-z '-]*\s+—\s*(?=(?:when|whenever|at the beginning|if|as long as)\b)/i,
    "",
  );
}
