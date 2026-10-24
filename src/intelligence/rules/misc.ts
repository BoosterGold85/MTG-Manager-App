import type { Rule } from '../types';
import { match } from './helpers';
export const misc: Rule = c => [
 ...match(c,'blink',/exile (?:target|another|up to|any number)[^]{0,170}return[^]{0,140}battlefield/i,'Exiles a permanent and returns it to the battlefield.',true),
 ...match(c,'untap',/\buntap (?:target|all|each|up to|another|that|it|two|three)/i,'Explicitly untaps permanents.'),
 ...match(c,'tap-matters',/whenever[^.\n]{0,80}(?:becomes? tapped|you tap)|tap (?:an?|another|two|three|\d+) untapped (?:creatures?|artifacts?)[^.\n]{0,50}:/i,'Rewards tapping or uses tapping your permanents as a cost.',true),
 ...match(c,'extra-combat',/additional combat (?:phase|step)|another combat phase/i,'Creates an extra combat phase.'),
 ...match(c,'extra-turns',/take(?:s)? (?:an?|two|three|\d+) extra turns?/i,'Grants an extra turn.'),
 ...match(c,'monarch',/\bmonarch\b/i,'Explicitly introduces or refers to the monarch.'),
 ...match(c,'initiative',/\binitiative\b/i,'Explicitly takes or refers to the initiative.'),
 ...match(c,'energy',/\{e\}|energy counters?/i,'Creates, spends or rewards energy.'),
 ...match(c,'poison',/\binfect\b|\btoxic \d+|poison counters?/i,'Uses poison, infect or toxic.')];
