// Prepare read-only public-deck load fixtures; no engine calls or gold labels.
import { createServer } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import console from 'node:console';
const archive=process.argv[2];if(!archive)throw new Error('Supply the preserved Phase 4 archive checkout.');
const json=path=>JSON.parse(readFileSync(path,'utf8'));
const raw=[...json(resolve(archive,'research/validation-phase4/data/cards.scryfall.json')),...json(resolve(archive,'research/validation-phase4/data/legacy-cards.scryfall.json')),...json('tests/audit/blind617/canonical.json'),...json('tests/audit/recall/cards.scryfall.json')];
const server=await createServer({configFile:false,cacheDir:"node_modules/.vite-analyzer-research",optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom'});
try{
 const {normalizeCard}=await server.ssrLoadModule('/src/import/scryfall.ts');
 const key=s=>s.replaceAll('’',"'").toLowerCase().trim(),lookup=new Map();
 for(const c of raw){const card=normalizeCard(c);lookup.set(key(card.name),card);for(const face of card.cardFaces||[])lookup.set(key(face.name),card);}
 const commander=json('tests/audit/blind617/capture.json').decks.map(d=>({name:d.commander,format:'commander',rows:d.cards,url:d.url}));
 const legacy=json(resolve(archive,'research/validation-phase4/data/legacy/manifest.json')).decks.map(d=>({name:d.name,format:'legacy',rows:d.main,url:d.source}));
 const decks=[...commander,...legacy].map((d,index)=>{
  const cards=new Map(),copies={};
  for(const row of d.rows){const c=lookup.get(key(row.name));if(!c)throw new Error('Missing preserved metadata: '+row.name);cards.set(c.scryfallId,c);copies[c.scryfallId]=(copies[c.scryfallId]||0)+row.quantity;}
  const count=Object.values(copies).reduce((a,b)=>a+b,0);if(count!==(d.format==='commander'?100:60))throw new Error('Incomplete source deck: '+d.name);
  return {id:`public-${index}`,name:d.name,format:d.format,url:d.url,copies,cards:[...cards.values()]};
 });
 writeFileSync('research/browser-adapter/public-decks.json',JSON.stringify(decks,null,2)+'\n');console.log(JSON.stringify({decks:decks.length,commander:commander.length,legacy:legacy.length}));
}finally{await server.close();}
