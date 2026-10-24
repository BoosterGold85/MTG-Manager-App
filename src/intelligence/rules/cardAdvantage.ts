import type { Rule } from '../types';
import { match, positive, positiveDraw } from './helpers';
export const cardAdvantage: Rule = c => {
 const draw=positive(c.text,positiveDraw);
 return [ ...(draw?[{tagId:'card-draw',snippet:draw.slice(0,180),reason:'A positive instruction draws cards; restrictions are excluded.'}]:[]),
 ...match(c,'looting',/(?:draw[^.\n]{0,80}discard|discard[^.\n]{0,80}draw)/i,'Combines drawing and discarding in an effect.',true).filter(()=>Boolean(draw)),
 ...match(c,'impulse-draw',/exile[^.\n]{0,65}top[^.\n]{0,65}library[^]{0,160}(?:play|cast)[^.\n]{0,60}(?:those cards|that card|them|it)/i,'Exiles library cards and gives permission to play them.',true),
 ...match(c,'tutor',/search[^.\n]{0,60}(?:library|libraries)[^.\n]{0,100}(?:card|land)/i,'Searches a library for a card.').filter(()=>!/can't search|cannot search/i.test(c.text)),
 ...match(c,'topdeck',/\bscry\b|\bsurveil\b|look at[^.\n]{0,45}top[^.\n]{0,60}library[^]{0,100}(?:any order|on top|on the bottom)/i,'Scries, surveils or arranges cards on top of the library.')];
};
