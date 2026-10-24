import type { Rule } from '../types';
import { match } from './helpers';
export const mana: Rule = c => {
 const add=match(c,'ramp',/\badd (?:\{[^}]+\}|[^.\n]{0,25}mana)/i,'Produces additional mana; ordinary lands are excluded.').filter(()=>! /\bLand\b/i.test(c.type));
 const land=match(c,'ramp',/search[^.\n]{0,130}land[^]{0,150}(?:onto|on) the battlefield/i,'Searches for lands and puts them onto the battlefield.',true).filter(()=>!/\bLand\b/i.test(c.type) || /(?:two|three|four|\d{2,})[^.\n]{0,30}lands?/i.test(c.text));
 return [...add,...land,
 ...(add.length && /Creature/i.test(c.type)?[{...add[0],tagId:'mana-dork',reason:'Creature type plus mana-production ability.',source:'derived' as const,confidence:0.99}]:[]),
 ...(add.length && /Artifact/i.test(c.type)&& !/Creature/i.test(c.type)?[{...add[0],tagId:'mana-rock',reason:'Noncreature artifact type plus mana-production ability.',source:'derived' as const,confidence:0.99}]:[]),
 ...match(c,'cost-reduction',/cost[^.\n]{0,70}(?:less|reduced)/i,'Reduces mana costs instead of directly producing mana.'),
 ...match(c,'mana-fixing',/mana of any (?:one )?colou?r|mana in any combination of colou?rs|search[^.\n]{0,100}basic land/i,'Provides flexible colors or finds basic lands.',true)];
};
