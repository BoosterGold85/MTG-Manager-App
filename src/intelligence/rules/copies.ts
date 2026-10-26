import type { Hit, Rule } from '../types';
import { sentences } from './helpers';
// Reminder text (populate, myriad, encore…) describes a separate keyword; it is not proof of a clone plan.
const withoutReminders = (text: string) => text.replace(/\([^)]*\)/g, '');
const clone = /\benters?(?: the battlefield)?(?: tapped)?[^.\n]{0,40}\bas a copy of\b|\bbecomes? a copy of\b|\btokens? (?:that's|that is|that are) (?:a )?cop(?:y|ies) of\b|\bcreate[^.\n]{0,80}\bcop(?:y|ies) of\b/i;
export const copiesCreatureSpell = (sentence: string) =>
  /\bcopy\b[^.\n]{0,60}\bspells?\b/i.test(sentence) && /\bcreature spells?\b/i.test(sentence) && !/\b(?:instant|sorcery|noncreature)\b/i.test(sentence);
export const copies: Rule = c => {
  const text = withoutReminders(c.text);
  const hits: Hit[] = [];
  const cloneSentence = sentences(text).find(s => clone.test(s));
  if (cloneSentence) hits.push({ tagId: 'clones', snippet: cloneSentence.trim().slice(0, 180), reason: 'Enters as, becomes, or creates a copy of a permanent or creature.' });
  const creatureSpell = sentences(text).find(copiesCreatureSpell);
  if (creatureSpell) hits.push({ tagId: 'copy-creature-spells', snippet: creatureSpell.trim().slice(0, 180), reason: 'Copies creature spells, so the copies resolve as additional creatures.' });
  return hits;
};
