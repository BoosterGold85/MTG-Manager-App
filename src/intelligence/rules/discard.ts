import type { Rule } from '../types';
import { keyword, match } from './helpers';
// Discard-cast mechanics: the card rewards being discarded, so discard effects become enablers.
export const discard: Rule = c => [
 ...(keyword(c,'mayhem') || /(?:^|\n)mayhem\b/i.test(c.text)
  ? [{tagId:'mayhem',snippet:(c.text.match(/[^\n]*\bmayhem\b[^\n]*/i)?.[0] || 'Mayhem').slice(0,180),reason:'Mayhem: castable from your graveyard in a turn you discarded it, so discarding it is card advantage.'}]
  : []),
 ...(keyword(c,'madness') || /(?:^|\n)madness\b/i.test(c.text)
  ? [{tagId:'madness',snippet:(c.text.match(/[^\n]*\bmadness\b[^\n]*/i)?.[0] || 'Madness').slice(0,180),reason:'Madness: castable for its madness cost when discarded.'}]
  : []),
 ...match(c,'discard-payoff',/whenever (?:you|a player) discards?\b|if you(?:'ve)? discarded|for each card (?:you )?discarded|cards? (?:you )?discarded this turn|discarded (?:a|one or more) cards? this turn/i,'Rewards discarding cards.'),
];
