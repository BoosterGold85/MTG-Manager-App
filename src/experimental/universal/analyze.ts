import type {CardMetadata} from '../../models/collection';
import {compile} from './compiler';
import {discover,scenario,holdingsDelta} from './engine';
import {emptyMana} from './model';
import type {Mana,Zone} from './model';
export const ANALYZER_VERSION='0.6.26-experimental.1';
export interface AnalyzerRequest { id:string; revision:string; version:string; cards:CardMetadata[]; selected:{id:string;zone:Zone}[]; mana:Mana; library:number }
export function analyze(request:AnalyzerRequest){
 if(request.version!==ANALYZER_VERSION || request.cards.length>500 || new TextEncoder().encode(JSON.stringify(request)).length>1024*1024)throw new Error('Analysis input exceeds the supported limit.');
 if(request.selected.length>3 || new Set(request.selected.map(s=>s.id)).size!==request.selected.length)throw new Error('Select up to three distinct cards.');
 if(!Object.keys(emptyMana()).every(c=>Number.isInteger(request.mana[c as keyof Mana])&&request.mana[c as keyof Mana]>=0&&request.mana[c as keyof Mana]<=20)||!Number.isInteger(request.library)||request.library<0||request.library>500)throw new Error('Invalid hypothetical resources.');
 const cards=request.cards.map(c=>({id:c.scryfallId,...compile(c)}));
 const placements=request.selected.map(s=>{const card=request.cards.find(c=>c.scryfallId===s.id);if(!card||!['hand','battlefield','graveyard'].includes(s.zone))throw new Error('Invalid selected card or zone.');return {card,zone:s.zone,ready:s.zone==='battlefield',tapped:false};});
 const initial=scenario(placements,{mana:request.mana,library:request.library});
 const found=placements.length?discover(initial,{depth:3,states:200,branches:12,automaticSteps:48,proofs:12}):null;
 const result={id:request.id,revision:request.revision,version:ANALYZER_VERSION,cards,selected:placements.map((p,i)=>({id:`card-${i}`,name:p.card.name,zone:p.zone})),assumptions:initial.assumptions,explored:found?.explored||0,truncated:found?.truncated||false,reasons:found?.reasons||[],rejections:found?.rejections||[],proofs:(found?.paths||[]).map(path=>({actions:path.actions,status:path.proof.status,complete:path.proof.complete,evidence:path.proof.evidence,events:path.proof.events,checks:path.proof.checks,participants:path.proof.participants,prerequisites:path.proof.prerequisites,assumptions:path.proof.assumptions,payoff:path.proof.terminal?.payoff,holdings:path.proof.terminal?holdingsDelta(initial,path.proof.terminal):null,searchTruncated:path.proof.searchTruncated}))};
 if(new TextEncoder().encode(JSON.stringify(result)).length>1024*1024)throw new Error('Analysis output exceeded the limit. Search is incomplete; saved data is unchanged.');
 return result;
}
export type AnalyzerResult=ReturnType<typeof analyze>;
