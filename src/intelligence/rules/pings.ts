import type { Rule } from '../types';
import { match } from './helpers';
// Opponent life loss ("pings"), punisher triggers and symmetric draw: the pieces of a punisher / group-chaos plan.
// "You lose N life" is a cost, never an opponent-life-loss signal.
const victim = String.raw`(?:each opponent|each player|each other player|target opponent|target player|that player|defending player|its controller|that creature's controller|the chosen player|that opponent|an opponent)`;
export const pings: Rule = c => [
 ...match(c,'opponent-life-loss',new RegExp(String.raw`\b${victim} (?:loses?|lose) (?:\d+|x|that much|half|one|two|three|life)|\bdeals?\b[^.\n]{0,70}\bdamage\b[^.\n]{0,50}\bto ${victim}`,'i'),'Makes opponents (or every player) lose life or take damage.'),
 ...match(c,'opponent-life-loss',/\b(?:an? opponent|each opponent|a player|target opponent|target player)\b[^.]{0,90}\bdeals?\b[^.]{0,60}\bdamage to them\b/i,'Damages the opponent or player who triggered it ("them").'),
 ...match(c,'punisher',/\bif an? opponent would lose life\b[^.]*\b(?:twice|double)\b/i,'Multiplies the life opponents lose, amplifying every ping.'),
 ...match(c,'punisher',/(?:whenever (?:a player|an opponent|each opponent|a creature[^,]{0,40}(?:an opponent|a player))[^,.]{0,90}|at the beginning of (?:each opponent's|each player's) (?:upkeep|draw step|end step))[^.]{0,120}(?:damage to (?:that player|its controller|that creature's controller)|damage[^.]{0,50} to any (?:other )?target|that player loses \w+ life|unless (?:that player|they) (?:sacrifices?|pays?|discards?))/i,'Punishes what players or opponents do with damage or life loss.'),
 ...match(c,'symmetric-draw',/\beach player draws\b|\bthat player draws an additional\b|\beach player (?:who [^.\n]{0,40})?discards (?:their|his or her) hand,? then draws\b|\bdiscards their hand, then draws seven/i,'Gives every player cards, which punisher effects then charge for.'),
];
