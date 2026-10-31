// Offline reporting only. Human desk labels never enter production scoring.
// Usage: node scripts/summarize-ranking.mjs results.json ablations.json holdouts.json performance.json
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import console from 'node:console';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const [resultPath,ablationPath,holdoutPath,perfPath]=process.argv.slice(2);
if(!perfPath)throw new Error('Expected four captured audit JSON paths');
const report=read(resultPath), ablations=read(ablationPath), holdouts=read(holdoutPath), perf=read(perfPath);
const review=read('tests/audit/ranking/precision-review.json');
const labels=new Map(review.reviews.map(r=>[JSON.stringify([r.deck,r.candidate]),r]));
const good=new Set(['Excellent contextual fit','Good obvious fit']);
function metrics(r){
 const rows=r.results.flatMap(d=>d.expected);
 const rate=kind=>{const a=rows.filter(x=>x.kind===kind);return {successes:a.filter(x=>kind==='trap'?!x.hit:x.hit).length,total:a.length};};
 let p10=0,p20=0;
 for(const d of r.results)for(const [i,c]of d.candidates.entries()){
  const review=labels.get(JSON.stringify([d.deck,c.name]));
  if(!review)throw new Error(`Unreviewed precision row: ${d.deck}/${c.name}`);
  if(good.has(review.label)){p20++;if(i<10)p10++;}
 }
 return {obviousRecallAt20:rate('obvious'),hiddenRecallAt20:rate('hidden'),trapRejection:rate('trap'),deskPrecisionAt10:{successes:p10,total:120},deskPrecisionAt20:{successes:p20,total:240}};
}
const compact=r=>r.results.map(d=>({deck:d.deck,misses:d.missed.map(x=>({candidate:x.candidate,kind:x.kind,rank:x.rank})),top20:d.candidates.map((c,i)=>({rank:i+1,name:c.name,score:c.brew.score,synergy:c.brew.synergy,components:c.brew.components,penalties:c.brew.penalties,review:labels.get(JSON.stringify([d.deck,c.name]))}))}));
const baseline=read('tests/audit/ranking/baseline-classification.json');
const all=report.results.flatMap(d=>d.expected.map(e=>({deck:d.deck,...e})));
const classification=baseline.rows.map(r=>({deck:r.deck,candidate:r.candidate,category:r.classification,before:r.rank,after:all.find(e=>e.deck===r.deck&&e.candidate===r.candidate)?.rank}));
const priorHoldouts=read('docs/recall/completed-real-decks.json');
const holdoutReview=holdouts.results.map(d=>{
 const prior=priorHoldouts.results.find(p=>p.id===d.id),before=new Set(prior.top20.map(c=>c.name)),after=new Set(d.top20.map(c=>c.name));
 return {id:d.id,commander:d.commander,kind:d.kind,expectation:d.expectation,deckCards:d.deckCards,missingOracleData:d.missingOracleData,entered:[...after].filter(n=>!before.has(n)),left:[...before].filter(n=>!after.has(n)),top20:d.top20};
});
const output={baseline:'919407a',version:'0.6.16',ordering:'Inherited production Brew ordering; Explore Synergy remains secondary.',snapshotHashes:report.snapshotHashes,expectationsHash:report.corpusHash,metrics:metrics(report),precisionCaveat:review.author,classification,remainingMisses:compact(report).flatMap(d=>d.misses.map(c=>({deck:d.deck,...c}))),ablations:ablations.map(a=>({removed:a.removed,metrics:metrics(a.report)})),decks:compact(report)};
writeFileSync('docs/ranking/results-v0.6.16.json',JSON.stringify(output,null,2)+'\n');
writeFileSync('docs/ranking/holdouts-v0.6.16.json',JSON.stringify({baseline:'919407a',version:'0.6.16',notUsedForTuning:true,results:holdoutReview},null,2)+'\n');
writeFileSync('docs/ranking/performance-v0.6.16.json',JSON.stringify({...perf,baseline:'919407a',version:'0.6.16'},null,2)+'\n');
console.log(JSON.stringify({metrics:output.metrics,classification,remaining:output.remainingMisses,holdouts:holdoutReview.map(d=>({id:d.id,entered:d.entered,left:d.left}))},null,2));
