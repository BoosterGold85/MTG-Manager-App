import type { Rule } from '../types';
import { match, positiveGain } from './helpers';
export const sacrifice: Rule = c => {
 const payoff=match(c,'sacrifice-payoff',/whenever[^.\n]{0,100}(?:you sacrifice|creatures?[^.\n]{0,40}dies?|another[^.\n]{0,35}dies?)/i,'Rewards sacrificing your permanents or creature deaths.',true);
 const outlet=match(c,'sacrifice-outlet',/(?:^|\n|[.])[^.\n]{0,65}sacrifice (?:a|an|another|two|three|x|\d+|any number of) (?:other )?(?:creatures?|artifacts?|permanents?|lands?|tokens?)[^.:\n]{0,45}:|you may sacrifice (?:a|an|another) (?:creature|artifact|permanent)/i,'An activated cost or optional effect lets you sacrifice your own permanents.',true);
 const aristocrats=payoff.length && /(?:(?:opponent|target player)[^.\n]{0,45}loses?[^.\n]{0,20}life|deal[^.\n]{0,45}damage to each opponent)/i.test(c.text) && positiveGain.test(c.text);
 return [...payoff,...outlet,
 ...(aristocrats ? [{tagId:'aristocrats',snippet:payoff[0].snippet,reason:'Creature death/sacrifice trigger drains opponents and gains you life.',source:'derived' as const,confidence:0.98}]:[]),
 ...match(c,'sacrifice-fodder',/sacrifice (?:this (?:creature|artifact|permanent|token)|~)|when[^.\n]{0,60}dies[^.\n]{0,90}return[^.\n]{0,50}battlefield/i,'Explicit self-sacrifice or a death-return loop supplies sacrifice material.',true)];
};
