import type { Rule } from '../types';
import { match } from './helpers';
export const creatures: Rule = c => [
 ...match(c,'etb',/when(?:ever)?[^.\n]{0,110}enters?(?: the battlefield)?(?:,| under|\.)/i,'Has or rewards an enters-the-battlefield trigger.'),
 ...match(c,'death-triggers',/when(?:ever)?[^.\n]{0,100}\bdies?\b/i,'Has or rewards a creature death trigger; this alone does not imply Aristocrats.'),
 ...match(c,'attack-triggers',/when(?:ever)?[^.\n]{0,100}\battacks?\b/i,'Triggers when a creature attacks.'),
 ...match(c,'combat-damage-triggers',/when(?:ever)?[^.\n]{0,100}deals? combat damage/i,'Triggers on combat damage.'),
 ...match(c,'go-tall',/(?:double[^.\n]{0,55}power|gets? \+x\/\+x|put[^.\n]{0,45}(?:three|four|five|x|\d\d+) \+1\/\+1 counters)/i,'Builds an individual creature into a large threat.',true)];
