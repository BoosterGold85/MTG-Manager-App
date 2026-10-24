import type { Rule } from '../types';
import { match } from './helpers';
export const graveyard: Rule = c => {
 const mill=match(c,'mill',/\bmill(?:s)?\b|put[^.\n]{0,50}top[^.\n]{0,50}(?:library|libraries)[^.\n]{0,60}graveyard/i,'Moves cards from a library into a graveyard.');
 const self=match(c,'self-mill',/\byou mill\b|\bmill (?:a|one|two|three|four|five|six|seven|x|\d+|that many) cards?\b|put[^.\n]{0,40}top[^.\n]{0,45}your library[^.\n]{0,45}(?:your|into a) graveyard|\bsurveil\b/i,'Moves your own library cards into your graveyard.');
 // Bare imperative mill excludes clauses with another player as the subject.
 const selfHits= /(?:opponent|target player|each player|each opponent|that player) mills?\b/i.test(c.text) && !/you mill|your library|surveil/i.test(c.text) ? [] : self;
 let recursion=match(c,'recursion',/(?:return|put)[^.\n]{0,120}(?:from|in) [^.\n]{0,35}graveyard[^.\n]{0,95}(?:hand|battlefield)|(?:cast|play)[^.\n]{0,90}(?:from|in) [^.\n]{0,25}graveyard/i,'Returns graveyard cards or permits casting/playing them.');
 let reanimate=match(c,'reanimator',/(?:return|put)[^.\n]{0,65}creature[^.\n]{0,65}(?:from|in)[^.\n]{0,25}graveyard[^.\n]{0,90}battlefield/i,'Returns a creature card from a graveyard directly to the battlefield.');
 if(/(?:target|chosen) creature cards? (?:in|from) [^.\n]{0,25}graveyard/i.test(c.text) && /return (?:it|that card|the chosen cards)[^.\n]{0,70}(?:battlefield|hand)/i.test(c.text)) {
  const snippet=c.text.match(/return (?:it|that card|the chosen cards)[^.\n]{0,70}(?:battlefield|hand)/i)![0];
  recursion=[...recursion,{tagId:'recursion',snippet,reason:'References graveyard creature targets, then returns those same cards.',source:'derived',confidence:.95}];
  if(/return (?:it|that card|the chosen cards)[^.\n]{0,70}battlefield/i.test(c.text)) reanimate=[...reanimate,{tagId:'reanimator',snippet,reason:'The referenced graveyard creature returns directly to the battlefield.',source:'derived',confidence:.95}];
 }
 const hate=match(c,'graveyard-hate',/exile[^.\n]{0,90}(?:from|in|all)[^.\n]{0,30}graveyards?|cards? in graveyards? can't|if[^.\n]{0,70}put into[^.\n]{0,30}graveyard[^.\n]{0,50}exile it instead/i,'Exiles graveyard cards or restricts graveyard use.');
 return [...mill,...selfHits,...recursion,...reanimate,...hate,
 ...match(c,'graveyard-payoff',/(?:for each|number of|as long as|if there are)[^.\n]{0,100}(?:in|from) your graveyard|whenever[^.\n]{0,80}(?:leaves? your graveyard|put into your graveyard)/i,'Rewards the contents of or events involving your graveyard.',true),
 ...(selfHits.length||recursion.length||reanimate.length|| /(?:in|from) your graveyard/i.test(c.text) ? [{tagId:'graveyard',snippet:c.text.slice(0,160),reason:'Self-mill, recursion or explicit use of your graveyard supports graveyard strategies.',source:'derived' as const,confidence:0.96}]:[]),
 ...match(c,'discard-outlet',/(?:^|\n|[.:])[^.\n]{0,35}discard (?:a|an|two|three|x|\d+|your hand)[^.:\n]{0,45}:|you may discard (?:a|an|two|three|x|\d+) cards?/i,'Offers discarding as an activated cost or optional choice.')];
};
