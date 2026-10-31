import type { CardMetadata } from '../models/collection';
import type { Assignment, AutoAnalysis, IntelligenceState, Override, Rule } from './types';
import { RULESET_VERSION } from './types';
import { tagDefinition } from './taxonomy';
import { creatureTypeSignals, typalHits } from './creatureTypes';
import { counters } from './rules/counters';
import { lands } from './rules/lands';
import { tokens } from './rules/tokens';
import { graveyard } from './rules/graveyard';
import { sacrifice } from './rules/sacrifice';
import { cardAdvantage } from './rules/cardAdvantage';
import { mana } from './rules/mana';
import { interaction } from './rules/interaction';
import { permanents } from './rules/permanents';
import { creatures } from './rules/creatures';
import { spells } from './rules/spells';
import { life } from './rules/life';
import { misc } from './rules/misc';
import { copies } from './rules/copies';
import { discard } from './rules/discard';
import { pings } from './rules/pings';
const rules: Rule[] = [counters,lands,tokens,graveyard,sacrifice,cardAdvantage,mana,interaction,permanents,creatures,spells,life,misc,copies,discard,pings];
export const cardIdentity = (card: CardMetadata) => card.oracleId || `name:${card.name.normalize('NFKC').trim().toLowerCase()}`;
export function inputFingerprint(card:CardMetadata) {
 const input=JSON.stringify([card.name,card.oracleText,card.typeLine,card.keywords,card.cardFaces,card.producedMana,card.power,card.toughness,card.loyalty,card.layout]);
 let hash=2166136261;for(let i=0;i<input.length;i++) hash=Math.imul(hash^input.charCodeAt(i),16777619);
 return (hash>>>0).toString(16);
}
export function needsAnalysis(card:CardMetadata,existing:AutoAnalysis|undefined) {return !existing || existing.rulesetVersion!==RULESET_VERSION || existing.inputFingerprint!==inputFingerprint(card);}
export function analyze(card:CardMetadata): AutoAnalysis {
 const creatureTypes=creatureTypeSignals(card);
 const identity=cardIdentity(card); const assignments=new Map<string,Assignment>();
 const faces=card.cardFaces?.length ? card.cardFaces : [{name:card.name,oracleText:card.oracleText,typeLine:card.typeLine,keywords:card.keywords}];
 for (const [index,face] of faces.entries()) {
  const c={card,text:(face.oracleText||'').replace(/[’‘]/g,"'"),type:face.typeLine||card.typeLine,
   keywords:face.keywords || (card.cardFaces?.length ? [] : card.keywords || []),field:card.cardFaces?.length?`cardFaces[${index}].oracleText`:'oracleText',face:card.cardFaces?.length?face.name:undefined};
  // Keywords are canonical semantic input even when omitted from face text.
  const keywordText=c.keywords.filter(k=>!c.text.toLowerCase().includes(k.toLowerCase())).join('. ');
  const contexts=[c,...(keywordText?[{...c,text:keywordText,field:'keywords'}]:[])];
  for(const context of contexts) for(const hit of [...rules.flatMap(rule=>rule(context)), ...typalHits({...card,oracleText:context.text,cardFaces:undefined,typeLine:c.type},context===c&&!card.cardFaces?.length?creatureTypes:undefined)]) {
   if(!tagDefinition(hit.tagId)) continue;
   const evidence={field:hit.field || context.field,snippet:hit.snippet,reason:hit.reason,...(context.face?{face:context.face}:{})};
   const existing=assignments.get(hit.tagId);
   if(existing) {
    if(!existing.evidence.some(e=>JSON.stringify(e)===JSON.stringify(evidence))) existing.evidence.push(evidence);
    if((hit.confidence??1)>existing.confidence) {existing.confidence=hit.confidence??1; existing.source=hit.source||'rule';}
   } else assignments.set(hit.tagId,{cardIdentity:identity,tagId:hit.tagId,source:hit.source||'rule',confidence:hit.confidence??1,evidence:[evidence],rulesetVersion:RULESET_VERSION});
  }
 }
 return {inputFingerprint:inputFingerprint(card),cardIdentity:identity,rulesetVersion:RULESET_VERSION,assignments:[...assignments.values()].sort((a,b)=>a.tagId.localeCompare(b.tagId)),creatureTypes};
}
export function effectiveAssignments(auto:AutoAnalysis|undefined, override:Override|undefined): Assignment[] {
 const hidden=new Set(override?.suppressed || []);
 const result=(auto?.assignments||[]).filter(a=>!hidden.has(a.tagId));
 for(const id of override?.added || []) if(tagDefinition(id)) {
  const original=auto?.assignments.find(a=>a.tagId===id);
  const saved=override?.assignments?.find(a=>a.tagId===id && a.source==='manual-add');
  const assignment:Assignment=saved || {cardIdentity:auto?.cardIdentity||'',tagId:id,source:'manual-add',confidence:1,evidence:[{field:'user',snippet:'Added by you',reason:'Your manual correction takes precedence over automatic rules.'}],rulesetVersion:RULESET_VERSION};
  const index=result.findIndex(a=>a.tagId===id);
  const merged={...assignment,evidence:[...assignment.evidence,...(original?.evidence||[])]};
  if(index>=0) result[index]=merged;else result.push(merged);
 }

 return result;
}
export const emptyIntelligence = (): IntelligenceState => ({auto:{},overrides:{}});
