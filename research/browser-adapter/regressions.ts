import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {normalizeCard} from '../../src/import/scryfall';
import {infer} from './infer';
import type {Input} from './infer';
import {grade,metrics,wilson} from './grade';
import type {Gold} from './grade';
export function run(archive?:string){
 const read=<T>(path:string):T=>JSON.parse(readFileSync(path,'utf8')) as T;
 const root=archive?archive+'/research/validation-phase4/data/':'research/browser-adapter/regression-data/';
 const raw=[...read<Parameters<typeof normalizeCard>[0][]>(root+'cards.scryfall.json'),...read<Parameters<typeof normalizeCard>[0][]>(root+'legacy-cards.scryfall.json'),...read<Parameters<typeof normalizeCard>[0][]>('tests/audit/blind617/canonical.json'),...read<Parameters<typeof normalizeCard>[0][]>('tests/audit/recall/cards.scryfall.json')];
 const key=(s:string)=>s.replaceAll('’',"'").toLowerCase();const catalog=new Map(raw.map(c=>{const card=normalizeCard(c);return[key(card.name),card] as const;}));
 for(const c of catalog.values())for(const f of c.cardFaces||[])catalog.set(key(f.name),c);
 const lookup=(name:string)=>{const c=catalog.get(key(name));if(!c)throw new Error(name);return c;};
 const input=read<Input[]>(root+'inputs.json');const start=performance.now();const predictions=input.map(i=>infer(i,lookup));
 mkdirSync('research/browser-adapter/results',{recursive:true});
 const save=(name:string,value:unknown)=>writeFileSync('research/browser-adapter/results/'+name,JSON.stringify(value,null,2)+'\n');
 save('regression-predictions.json',predictions); // Read exposed gold only after raw inference is saved.
 const labels=read<Gold[]>(root+'labels.json'),rows=labels.map(l=>grade(l,predictions.find(p=>p.id===l.id)!));
 const issues:unknown[]=[];let verified=0,unique=0;const seen=new Set<string>();
 const oracle=new Map(raw.map(c=>[c.oracle_id||c.id,c.oracle_text||'']));
 for(const p of predictions)for(const o of [...p.primary,...p.paths])if(o.status==='Verified'){
  verified++;const signature=JSON.stringify([p.id,o.actions,o.events,o.checks]);if(seen.has(signature))continue;seen.add(signature);unique++;const prior=new Set<string>();
  if(o.checks.some(c=>c.role==='required'&&c.result!==true))issues.push({id:p.id,kind:'failed-required-check'});
  for(const e of o.events){if(e.parents.some(parent=>!prior.has(parent)))issues.push({id:p.id,event:e.id,kind:'causal-parent'});prior.add(e.id);
   for(const v of e.evidence)if(v.line>=0&&oracle.get(v.oracleId)?.split('\n')[v.line]!==v.text)issues.push({id:p.id,event:e.id,kind:'oracle-line-fidelity'});
   if(!['cast','activate'].includes(e.kind)&&!e.evidence.some(v=>v.line>=0||v.kind==='rules'||v.rule.startsWith('CR')))issues.push({id:p.id,event:e.id,kind:'missing-clause-or-rule-reference'});
  }
 }
 const result={version:'phase4-browser.2',sourceInputSha256:createHash('sha256').update(readFileSync(root+'inputs.json')).digest('hex'),milliseconds:performance.now()-start,mechanical:metrics(rows),discovery:wilson(rows.filter(r=>r.truth&&r.independentDiscovery).length,labels.filter(l=>l.truth).length),proofAudit:{verifiedOutcomes:verified,uniqueVerifiedOutcomes:unique,issues,independentExplanationAccuracy:null},independentlyAdjudicated:false,activationApproved:false,caveat:'Previously exposed operator-labeled regression pack. Direct engine limits differ from the more conservative browser transport budgets; actual worker behavior is measured separately.'};
 save('regression-graded.json',rows);save('regression-failures.json',rows.filter(r=>r.falsePositive||r.missedPositive));save('regression-summary.json',result);return result;
}
