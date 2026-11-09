import {compile as frozenCompile} from '../../research/universal-remediated/compiler';
import {it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {sha256} from '../../src/experimental/universal/sha256';
import {compile,fingerprint} from '../../src/experimental/universal/compiler';
import {analyze,ANALYZER_VERSION} from '../../src/experimental/universal/analyze';
import {scenario,execute,actions,discover} from '../../src/experimental/universal/engine';
import {emptyMana, VERSION} from '../../src/experimental/universal/model';
import {oracleCard} from '../upgradeCandidates';
import {card} from '../fixtures/browserUniversal';
import {readFileSync} from 'node:fs';
it('browser SHA-256 matches Node for UTF-8, boundary lengths and canonical cards',()=>{
 for(const text of ['', 'abc','Magic — 龍',...Array.from({length:130},(_,i)=>'a'.repeat(i)),JSON.stringify(card('Llanowar Elves'))])expect(sha256(text)).toBe(createHash('sha256').update(text).digest('hex'));
 // A new interpreter revision intentionally invalidates only ephemeral compiled identities.
 expect(compile(card('Llanowar Elves')).key).not.toBe(frozenCompile(card('Llanowar Elves')).key);
 const c=card('Llanowar Elves'); expect(compile(c).key).toBe(fingerprint([VERSION,c.oracleId,c.name,c.oracleText,c.typeLine,c.power,c.toughness,c.manaCost,c.manaValue,c.colors,c.cardFaces]));
 expect(fingerprint({x:1})).toBe(createHash('sha256').update(JSON.stringify({x:1})).digest('hex'));
});
it('reports actual partial coverage without treating unsupported cards as fully understood or changing inputs',()=>{
 const vanilla=oracleCard('Plain body','{1}',1,'Creature — Human','',[]),unknown=oracleCard('Unknown engine','{1}',1,'Artifact','Whenever you roll a die, celebrate.',[]);
 const request={id:'one',revision:'v',version:ANALYZER_VERSION,cards:[vanilla,unknown,card('Llanowar Elves')],selected:[],mana:emptyMana(),library:40};
 const before=JSON.stringify(request),result=analyze(request);expect(result.proofs).toEqual([]);expect(result.explored).toBe(0);expect(result.cards.find(c=>c.name==='Unknown engine')!.unsupported.length).toBeGreaterThan(0);expect(JSON.stringify(request)).toBe(before);
 expect(compile({...vanilla,oracleText:undefined}).unsupported).toContain('Missing canonical Oracle text.');
});
it('bounds inputs and validates hypothetical resources',()=>{
 const r={id:'x',revision:'x',version:ANALYZER_VERSION,cards:[card('Llanowar Elves')],selected:[],mana:emptyMana(),library:40};
 expect(()=>analyze({...r,cards:Array(501).fill(r.cards[0])})).toThrow();expect(()=>analyze({...r,library:-1})).toThrow();expect(()=>analyze({...r,selected:[{id:'absent',zone:'hand'}]})).toThrow();
});
it('additional sacrifice events cite the actual cost clause, not a synthetic cast citation',()=>{
 const spell=oracleCard('Costed spell','{B}',1,'Sorcery','As an additional cost to cast this spell, sacrifice a creature.\nDraw two cards.',['B']);
 const body={...oracleCard('Payment body','{1}',1,'Creature — Human','',[]),power:'1',toughness:'1'};
 const s=scenario([{card:spell,zone:'hand',id:'spell'},{card:body,zone:'battlefield',id:'body'}],{mana:{...emptyMana(),B:1}});
 const proofs=execute(s,{kind:'cast',instance:'spell',sacrifice:'body'});const proof=proofs.find(p=>p.status==='Verified')!;expect(proof,JSON.stringify(proofs)).toBeDefined();
 for(const e of proof.events.filter(e=>e.kind==='die'||e.note.includes('Sacrificed')))expect(e.evidence.some(v=>v.rule==='subset:additional-sacrifice-cost'&&/additional cost/.test(v.text))).toBe(true);
});
it('ordinary permanent entries carry an explicit rules citation',()=>{
 const s=scenario([{card:card('Llanowar Elves'),zone:'hand',id:'elf'}],{mana:{...emptyMana(),G:1}});
 const proof=execute(s,actions(s).find(a=>a.kind==='cast')!).find(p=>p.status==='Verified')!;
 const entry=proof.events.find(e=>e.kind==='enter')!;expect(entry.evidence.some(e=>e.rule.includes('CR608.3'))).toBe(true);
});
it('production storage and recommendation files remain byte-identical to the release baseline',()=>{
 // Snapshot hashes captured from main before feature integration, not refreshed from modified files.
 const hashes=JSON.parse(readFileSync('tests/data/analyzer-protected-baseline.json','utf8')) as Record<string,string>;
 for(const [file,hash] of Object.entries(hashes))expect(createHash('sha256').update(readFileSync(file)).digest('hex'),file).toBe(hash);
});

it('does not reuse valid blank-text or normal-layout cache entries after metadata becomes unsupported',()=>{
 const c={...oracleCard('Cached body','{1}',1,'Creature — Human','',[]),power:'1',toughness:'1',layout:'normal'};
 const valid=compile(c);c.oracleText=undefined as unknown as string;
 const missing=compile(c);expect(missing.key).not.toBe(valid.key);expect(missing.unsupported.length).toBeGreaterThan(0);
 c.oracleText='';c.layout='token';const token=compile(c);expect(token.key).not.toBe(valid.key);expect(token.unsupported.length).toBeGreaterThan(0);
});

it('bounds serialized output before it can be posted from a worker',()=>{
 const c=oracleCard('Verbose source','{1}',1,'Enchantment',Array(5000).fill('Whenever another creature enters, you gain 1 life.').join('\n'),[]);
 expect(()=>analyze({id:'large',revision:'r',version:ANALYZER_VERSION,cards:[c],selected:[],mana:emptyMana(),library:40})).toThrow(/output exceeded/);
});
it('reports a depth-limited search as truncated when further modeled actions exist',()=>{
 const s=scenario([{card:card('Llanowar Elves'),zone:'hand'}],{mana:{...emptyMana(),G:1}});
 const r=discover(s,{depth:0,states:10});expect(r.truncated).toBe(true);expect(r.proofs).toEqual([]);
});
