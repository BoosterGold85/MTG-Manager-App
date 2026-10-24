import type { Rule } from '../types';
import { match } from './helpers';
export const counters: Rule = c => [
 ...match(c,'plus-counters',/\+1\/\+1 counters?/i,'Explicitly places, uses or references +1/+1 counters.'),
 ...match(c,'minus-counters',/-1\/-1 counters?/i,'Explicitly places, uses or references -1/-1 counters.'),
 ...match(c,'proliferate',/\bproliferate\b/i,'Uses the proliferate mechanic.'),
 ...match(c,'counter-payoff',/(?:whenever|for each|if|additional|twice|double)[^.\n]{0,100}(?:\+1\/\+1|-1\/-1|one or more) counters?|counters? [^.\n]{0,65}(?:instead|additional|double)/i,'Counter conditions or counter amplification provide a payoff.',true),
];
