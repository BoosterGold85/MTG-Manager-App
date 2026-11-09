import {createServer} from 'vite';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import process from 'node:process';
import console from 'node:console';
const server=await createServer({configFile:false,cacheDir:'node_modules/.vite-analyzer-research',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom'});
try {
 if(!process.argv[2])throw new Error('Supply an extracted a3c20b3 baseline directory.');
 const old=await server.ssrLoadModule('/@fs'+resolve(process.argv[2])+'/src/experimental/universal/compiler.ts');
 const next=await server.ssrLoadModule('/src/experimental/universal/compiler.ts');
 const decks=JSON.parse(readFileSync('research/browser-adapter/public-decks.json','utf8'));
 const result={baseline:'a3c20b374dd457de1903a9a3b1ab9a61d1ff3523',definition:'Copy-weighted saved-type-line nonlands with no unsupported noncombat clauses; deferred combat may remain.',rows:[]};
 for(const d of decks)for(const card of d.cards){if(card.typeLine.includes('Land'))continue;const a=old.compile(card),b=next.compile(card);result.rows.push({deck:d.name,format:d.format,name:card.name,copies:d.copies[card.scryfallId],before:!a.unsupported.length,after:!b.unsupported.length,unsupportedBefore:a.unsupported,unsupportedAfter:b.unsupported,deferred:b.deferred});}
 writeFileSync('research/browser-adapter/results/coverage-comparison.json',JSON.stringify(result,null,2)+'\n');
 for(const format of ['commander','legacy']){const rows=result.rows.filter(r=>r.format===format);console.log(format,JSON.stringify({total:rows.reduce((n,r)=>n+r.copies,0),before:rows.filter(r=>r.before).reduce((n,r)=>n+r.copies,0),after:rows.filter(r=>r.after).reduce((n,r)=>n+r.copies,0),newCards:[...new Set(rows.filter(r=>!r.before&&r.after).map(r=>r.name))]}));}
}finally{await server.close();}
