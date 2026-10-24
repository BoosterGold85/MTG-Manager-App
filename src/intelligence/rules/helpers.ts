import type { Hit, RuleContext } from '../types';
export function match(c: RuleContext, tagId: string, pattern: RegExp, reason: string, derived = false): Hit[] {
  const found = c.text.match(pattern);
  return found ? [{ tagId, snippet: found[0].slice(0, 180), reason, source: derived ? 'derived' : 'rule', confidence: derived ? 0.95 : 1 }] : [];
}
export function keyword(c: RuleContext, word: string) { return c.keywords.some(k => k.toLowerCase() === word); }
export const positiveDraw = /\bdraw(?:s)? (?:a|an|one|two|three|four|five|six|seven|x|\d+|that many) cards?\b/i;
export const positiveGain = /\bgain(?:s)? (?:\d+|x|that much|that many|one|two|three) life\b/i;
export function sentences(text: string) { return text.split(/(?<=[.!?])\s+|\n/); }
export function positive(text: string, pattern: RegExp) {
 return sentences(text).map(s=>s.replace(/^(?:When(?:ever)?|If)\b[^,]*,\s*/i,'')).filter(s => !/\b(?:can't|cannot|don't|doesn't|instead of|rather than)\b/i.test(s)).find(s => pattern.test(s));
}
