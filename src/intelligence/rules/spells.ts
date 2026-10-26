import type { Rule } from '../types';
import { match, sentences } from './helpers';
import { copiesCreatureSpell } from './copies';
export const spells: Rule = c => [
 ...match(c,'instants-sorceries',/(?:whenever|when|for each|return|search)[^.\n]{0,90}(?:instant|sorcery)|(?:instant|sorcery)[^.\n]{0,60}(?:cost|from your graveyard)/i,'Explicitly enables or rewards instants and sorceries.',true),
 ...match(c,'spellslinger',/(?:whenever|when)[^.\n]{0,75}(?:cast|copy)[^.\n]{0,65}(?:instant|sorcery|noncreature) spell/i,'Rewards casting or copying instants, sorceries or noncreature spells.',true),
 // Copying creature spells is a clone effect (copies.ts), not spellslinger support.
 ...match({...c,text:sentences(c.text).filter(s=>!copiesCreatureSpell(s)).join(' ')},'copy-spells',/copy (?:target|that|the|an?|each)[^.\n]{0,65}(?:spell|instant|sorcery)/i,'Copies instant, sorcery or noncreature spells rather than creatures.'),
 ...match(c,'cast-exile',/exile[^.\n]{0,65}top[^.\n]{0,65}library[^]{0,160}(?:play|cast)[^.\n]{0,60}(?:those cards|that card|them|it)|(?:cast|play)[^.\n]{0,80}(?:from exile|exiled (?:cards?|with))|(?:exiled|those|that) cards?[^.\n]{0,50}(?:may cast|may play)|you may (?:cast|play) (?:it|them)[^.\n]{0,45}exile/i,'Allows casting or playing exiled cards.'),
 ...match(c,'flash',/as though[^.\n]{0,45}flash|whenever[^.\n]{0,90}(?:during an opponent's turn|not your turn)/i,'Enables instant-speed casting or rewards playing during opposing turns.',true)];
