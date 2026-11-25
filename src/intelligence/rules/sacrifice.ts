import type { Rule } from '../types';
import { match, positiveGain } from './helpers';
export const sacrifice: Rule = c => {
 // Food, Clue and Treasure are resources. Sacrificing one as a cost, or rewarding it, is a resource plan, not a sacrifice plan.
 const RESOURCE_SACRIFICE=/sacrifice[^.\n]{0,40}\b(?:food|clue|treasure)s?\b/i;
 // A creature that sacrifices itself is sacrifice material. A mana rock, treasure or Food that is spent for one effect is a resource,
 // so "Sacrifice this artifact: draw a card" does not make a sacrifice plan. Death-and-return loops count for any card.
 const isCreature=/\bCreature\b/.test((c.card.cardFaces?.[0]?.typeLine || c.card.typeLine || '').split('—')[0]);
 const deathReturn=/when[^.\n]{0,60}dies[^.\n]{0,90}return[^.\n]{0,50}battlefield/i;
 const fodderPattern=isCreature?new RegExp(`sacrifice (?:this creature|~)|${deathReturn.source}`,'i'):deathReturn;
 const payoff=match(c,'sacrifice-payoff',/whenever[^.\n]{0,100}(?:you sacrifice|(?:a|another|one or more)[^.\n]{0,45}(?:is|are) sacrificed)/i,'Rewards an explicit sacrifice event, not a generic creature death.',true).filter(e=>!RESOURCE_SACRIFICE.test(e.snippet));
 const foodPayoff=match(c,'food',/whenever[^.\n]{0,100}you sacrifice[^.\n]{0,40}\bfood\b/i,'Rewards sacrificing Food, a resource; not a sacrifice plan.',true);
 const cluePayoff=match(c,'clue',/whenever[^.\n]{0,100}you sacrifice[^.\n]{0,40}\bclues?\b/i,'Rewards sacrificing a Clue, a resource; not a sacrifice plan.',true);
 const death=match(c,'death-triggers',/whenever[^.\n]{0,100}\bdies?\b/i,'Creature-death event, independently of its cause.');
 const outlet=match(c,'sacrifice-outlet',/(?:^|\n|[.])[^.\n]{0,65}sacrifice (?:a|an|another|two|three|x|\d+|any number of) (?:other )?(?:creatures?|artifacts?|permanents?|lands?|tokens?)[^.:\n]{0,45}:|you may sacrifice (?:a|an|another) (?:creature|artifact|permanent)/i,'An activated cost or optional effect lets you sacrifice your own permanents.',true);
 const aristocrats=(payoff.length || death.length) && /(?:(?:opponent|target player)[^.\n]{0,45}loses?[^.\n]{0,20}life|deal[^.\n]{0,45}damage to each opponent)/i.test(c.text) && positiveGain.test(c.text);
 return [...payoff,...foodPayoff,...cluePayoff,...outlet,
 ...(aristocrats ? [{tagId:'aristocrats',snippet:(payoff[0] || death[0]).snippet,reason:'Creature death/sacrifice trigger drains opponents and gains you life.',source:'derived' as const,confidence:0.98}]:[]),
 ...match(c,'sacrifice-fodder',fodderPattern,'Explicit self-sacrifice or a death-return loop supplies sacrifice material.',true)];
};
