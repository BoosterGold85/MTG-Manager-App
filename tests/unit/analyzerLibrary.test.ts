import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {normalizeCard} from '../../src/import/scryfall';
import {scenario,execute,holdingsDelta} from '../../src/experimental/universal/engine';
import {emptyMana} from '../../src/experimental/universal/model';
import {card as developmentCard} from '../fixtures/browserUniversal';
const raw=JSON.parse(readFileSync('tests/audit/recall/cards.scryfall.json','utf8')) as Parameters<typeof normalizeCard>[0][];
const brainstorm=raw.map(normalizeCard).find(c=>c.name==='Brainstorm')!;
const mana={...emptyMana(),U:2,C:2};
it('models actual Brainstorm draw/put-back without inventing card identities or advantage',()=>{
 const s=scenario([{card:brainstorm,id:'brain',zone:'hand'}],{mana});
 const before=JSON.stringify(s),p=execute(s,{kind:'cast',instance:'brain'}).find(p=>p.status==='Verified')!;
 expect(p).toBeDefined();expect(p.terminal!.payoff.draw).toBe(3);expect(p.terminal!.unknownHand).toBe(1);expect(p.terminal!.library).toBe(39);expect(p.terminal!.libraryOrder!.slice(0,2)).toEqual([null,null]);expect(p.terminal!.spent.discarded).toEqual([]);expect(holdingsDelta(s,p.terminal!).hand).toBe(0);expect(JSON.stringify(s)).toBe(before);
});
it('preserves chosen top-card order and object incarnations through subsequent draws',()=>{
 const s=scenario([{card:brainstorm,id:'brain',zone:'hand'},{card:developmentCard('Divination'),id:'draw',zone:'hand'},...['a','b','c','d','e'].map(id=>({card:developmentCard('Llanowar Elves'),id,zone:'library' as const}))],{mana,library:5});
 const first=execute(s,{kind:'cast',instance:'brain',putBack:[{instance:'c',incarnation:1},{instance:'a',incarnation:1}]}).find(p=>p.status==='Verified')!;
 expect(first.terminal!.libraryOrder).toEqual(['c','a','d','e']);
 const second=execute(first.terminal!,{kind:'cast',instance:'draw'}).find(p=>p.status==='Verified')!;
 expect(second.terminal!.libraryOrder).toEqual(['d','e']);expect(second.events.filter(e=>e.note.startsWith('Drawn from')).map(e=>e.subject)).toEqual(['c','a']);expect(second.terminal!.objects.find(o=>o.instance==='c')!.incarnation).toBe(3);
});
it('rejects stale, duplicated, and unavailable hand choices',()=>{
 const s=scenario([{card:brainstorm,id:'brain',zone:'hand'},...['a','b','c'].map(id=>({card:developmentCard('Llanowar Elves'),id,zone:'library' as const}))],{mana,library:3});
 for(const putBack of [[{instance:'a',incarnation:0},{instance:'b',incarnation:1}],[{instance:'a',incarnation:1},{instance:'a',incarnation:1}],[null,null]])expect(execute(s,{kind:'cast',instance:'brain',putBack})[0].status).toBe('Invalid');
});
it('rejects inconsistent known library identities rather than inventing a card',()=>{
 const s=scenario([{card:brainstorm,id:'brain',zone:'hand'}],{mana});s.libraryOrder![0]='missing';
 expect(execute(s,{kind:'cast',instance:'brain'})[0].status).toBe('Unknown');
});
it('finishes the instruction as far as possible while preserving a failed draw game loss',()=>{
 const s=scenario([{card:brainstorm,id:'brain',zone:'hand'}],{mana,library:1});
 const p=execute(s,{kind:'cast',instance:'brain'}).find(p=>p.status==='Verified')!;expect(p.terminal!.payoff.loss).toBe(true);expect(p.terminal!.payoff.draw).toBe(1);expect(p.terminal!.unknownHand).toBe(0);expect(p.terminal!.library).toBe(1);
});
