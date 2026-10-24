import type { Rule } from '../types';
import { match } from './helpers';
export const permanents: Rule = c => [
 ...match(c,'artifacts',/(?:whenever|for each|number of|if you control|cost)[^.\n]{0,65}artifacts?|artifacts? (?:you control|spells you cast)[^.\n]{0,65}(?:get|have|gain|cost)|search[^.\n]{0,80}artifact card/i,'Explicit artifact payoff or enabler; artifact type alone is insufficient.',true),
 ...match(c,'enchantments',/(?:whenever|for each|number of|if you control)[^.\n]{0,65}enchantments?|enchantments? (?:you control|spells you cast)[^.\n]{0,65}(?:get|have|gain|cost)|search[^.\n]{0,80}enchantment card/i,'Explicit enchantment payoff or enabler; enchantment type alone is insufficient.',true),
 ...match(c,'equipment',/\bequip(?:ment)?\b/i,'Uses or explicitly supports Equipment.'),
 ...match(c,'auras',/\bauras?\b|\benchant creature\b/i,'Is or supports an Aura attached to a creature.'),
 ...match(c,'vehicles',/\bcrew\b|vehicles? you control/i,'Uses crew or explicitly supports Vehicles.'),
 ...match(c,'planeswalkers',/(?:planeswalkers? you control|loyalty abilities|loyalty counters? on)/i,'Explicitly supports planeswalkers or their loyalty.',true),
 ...match(c,'voltron',/(?:for each|each|number of)[^.\n]{0,65}(?:auras?|equipment)[^.\n]{0,55}(?:attached|you control)|whenever[^.\n]{0,65}(?:becomes attached|you attach)/i,'Rewards Equipment/Aura attachments or stacking them.',true),
 ...(/\bEquipment\b/i.test(c.type)?[{tagId:'equipment',field:'typeLine',snippet:c.type,reason:'Equipment subtype defines an attachment role.'}]:[]),
 ...(/\bAura\b/i.test(c.type)?[{tagId:'auras',field:'typeLine',snippet:c.type,reason:'Aura subtype defines an attachment role.'}]:[])];
