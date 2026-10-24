import type { Rule } from '../types';
import { match, positive, positiveGain } from './helpers';
export const life: Rule = c => {
 const gain=positive(c.text,positiveGain) || (/\blifelink\b/i.test(c.text) ? 'Lifelink' : undefined);
 const loss=match(c,'life-loss',/\bloses? (?:\d+|x|that much|that many|one|two|three) life\b/i,'Explicitly causes a player to lose life.');
 return [...(gain?[{tagId:'lifegain',snippet:gain.slice(0,180),reason:'Positively causes life gain; restrictions are excluded.'}]:[]),...loss,
 ...match(c,'lifegain-payoff',/whenever you gain life|if you gained life|for each[^.\n]{0,45}life you(?:'ve| have)? gained/i,'Rewards a life-gain event or accumulated life gain.',true),
 ...(gain && (loss.length || /deals?[^.\n]{0,45}damage[^.\n]{0,45}(?:opponent|player)/i.test(c.text)) ? [{tagId:'drain',snippet:gain.slice(0,180),reason:'Combines life gain with life loss or damage to an opponent/player.',source:'derived' as const,confidence:0.95}]:[])];
};
