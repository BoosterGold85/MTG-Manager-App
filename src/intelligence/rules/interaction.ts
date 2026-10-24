import type { Rule } from '../types';
import { match } from './helpers';
export const interaction: Rule = c => {
 const withoutYard=c.text.split(/(?<=[.!?])\s+|\n/).filter(s=>!/graveyard/i.test(s)&& !/exile[^.]{0,60}return[^.]{0,80}battlefield/i.test(s)).join('\n');
 const combatType=/\bInstant\b/i.test(c.type);
 const removal=match({...c,text:withoutYard},'removal',/(?:destroy|exile) (?:target|all|each) [^.\n]{0,70}(?:creatures?|permanents?|artifacts?|enchantments?|planeswalkers?|lands?)|return target [^.\n]{0,60}(?:creature|permanent)[^.\n]{0,70}(?:owner's|their) hand|(?:opponent|target player)[^.\n]{0,30}sacrifices? (?:a|an|two|\d+) (?:creature|permanent)/i,'Removes a target, board, or forces an opponent sacrifice.');
 return [...removal,
 ...(removal.length && /creature/i.test(removal[0].snippet)?[{...removal[0],tagId:'creature-removal',reason:'Removal effect explicitly includes creatures.'}]:[]),
 ...(removal.length && /permanent/i.test(removal[0].snippet)?[{...removal[0],tagId:'permanent-removal',reason:'Removal effect targets a broad permanent class.'}]:[]),
 ...(removal.length && /artifact|enchantment/i.test(removal[0].snippet)?[{...removal[0],tagId:'artifact-enchantment-removal',reason:'Removal effect explicitly includes artifacts or enchantments.'}]:[]),
 ...match(c,'board-wipe',/(?:destroy|exile) (?:all|each) [^.\n]{0,50}(?:creatures?|permanents?|artifacts?|enchantments?|lands?)/i,'Mass removal affects all or each of a permanent class.'),
 ...match(c,'counterspell',/counter (?:target|that|each|all)[^.\n]{0,50}(?:spell|ability|abilities)/i,'Explicitly counters a spell or ability.'),
 ...match(c,'protection',/\bindestructible\b|\bhexproof\b|\bward\b|protection from|prevent (?:all|the next)[^.\n]{0,70}damage/i,'Provides explicit protection, prevention, indestructible, hexproof or ward.'),
 ...match(c,'hexproof-ward',/\bhexproof\b|\bward\b/i,'Has or grants hexproof or ward.'),
 ...(combatType?match(c,'combat-trick',/gets? \+\d+\/\+\d+|gains? (?:indestructible|hexproof|first strike|double strike)/i,'Instant-speed effect boosts or protects a creature in combat.',true):[])];
};
