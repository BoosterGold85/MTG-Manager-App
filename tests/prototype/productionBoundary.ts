import {readFileSync} from 'node:fs';
// Explicit v0.6.26 activation exceptions, NOT a refreshed protection snapshot.
// Strip only the reviewed UI mount and app-version fields; all other bytes still
// have to match the original frozen production hashes, including storage/scorers.
export function productionBoundaryBytes(path:string):Buffer{
 let text=readFileSync(new URL('../../'+path,import.meta.url),'utf8');
 if(path==='src/components/DeckLibrary.tsx')text=text.replace('import {ExperimentalSynergyAnalyzer} from "./ExperimentalSynergyAnalyzer";\n','').replace('          {tab === "overview" && (formatOf(deck)==="commander" || formatOf(deck)==="legacy") && <ExperimentalSynergyAnalyzer key={`experimental:${deck.id}:${state.revision}`} state={state} deck={deck} />}\n','');
 if(path==='package.json')text=text.replace('"version": "0.6.26"','"version": "0.6.25"');
 if(path==='package-lock.json')text=text.replace('"version": "0.6.26"','"version": "0.6.25"').replace('"version": "0.6.26"','"version": "0.6.25"');
 if(path==='tests/browser/lookupTransport.spec.ts')text=text.replace("import pkg from '../../package.json' with {type:'json'};\n",'').replace("version:pkg.version,transport:","version:'0.6.23',transport:");
 return Buffer.from(text);
}
