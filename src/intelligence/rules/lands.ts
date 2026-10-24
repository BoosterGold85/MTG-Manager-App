import type { Rule } from '../types';
import { match } from './helpers';
export const lands: Rule = c => {
 const landfall=match(c,'landfall',/\blandfall\b|whenever (?:a|another|one or more) lands? (?:you control )?enters?[^.\n]{0,55}(?:under your control|you control)/i,'Triggers when a land enters under your control.');
 const recursion=match(c,'land-recursion',/(?:return[^.\n]{0,85}land[^.\n]{0,85}(?:from|in) [^.\n]{0,30}graveyard|(?:play|put)[^.\n]{0,50}lands?[^.\n]{0,60}(?:from|in) [^.\n]{0,25}graveyard)/i,'Reuses lands from a graveyard.');
 const extra=match(c,'extra-land-drops',/(?:play|may play)[^.\n]{0,30}(?:additional|extra) lands?/i,'Allows additional land plays.');
 return [...landfall,...recursion,...extra,
 ...match(c,'land-sacrifice',/sacrifice (?:(?:a|an|two|three|\d+|x|any number of) lands?|this land)/i,'Sacrifices lands you control.'),
 ...(landfall.length || recursion.length || extra.length ? [{tagId:'lands-matter',snippet:(landfall[0]||recursion[0]||extra[0]).snippet,reason:'Land triggers, extra land plays or land recursion support land strategies.',source:'derived' as const,confidence:0.98}] : []),
 ...match(c,'lands-matter',/(?:for each|number of|whenever)[^.\n]{0,60}lands? (?:you control|enters?)/i,'Explicitly rewards or counts lands.',true)];
};
