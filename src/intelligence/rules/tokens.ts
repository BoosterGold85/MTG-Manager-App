import type { Rule } from '../types';
import { match } from './helpers';
export const tokens: Rule = c => {
 const create=match(c,'tokens',/\bcreate(?:s)?\b[^.\n]{0,160}\bcreature tokens?\b/i,'Creates creature tokens; token restrictions alone do not qualify.');
 return [...create,
 ...match(c,'token-payoff',/(?:whenever|for each|if|twice|double|additional)[^.\n]{0,90}tokens?[^.\n]{0,90}(?:you control|enters?|create|instead|gets?|have|gain)|tokens? you control (?:get|have|gain)/i,'Rewards token events, scales with tokens or amplifies token production.',true),
 ...match(c,'go-wide',/creatures you control get \+\d+\/\+\d+|for each creature you control|number of creatures you control|(?:three|four|five|six|seven|x|\d\d+) [^.\n]{0,60}creature tokens?/i,'Scales with a wide board or creates several creatures.',true),
 ...match(c,'treasure',/(?:create[^.\n]{0,90}treasure|sacrifice[^.\n]{0,35}treasures?|treasures? you control)/i,'Creates or uses Treasure tokens.'),
 ...match(c,'food',/(?:create[^.\n]{0,90}food|sacrifice[^.\n]{0,35}foods?|foods? you control)/i,'Creates or uses Food tokens.'),
 ...match(c,'clue',/\binvestigate\b|create[^.\n]{0,90}clue|clues? you control/i,'Investigates or creates/uses Clue tokens.'),
 ...match(c,'populate',/\bpopulate\b/i,'Uses populate; separate from explicit token creation.')];
};
