import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalizeCard } from '../../src/import/scryfall';
import { actions, execute, scenario } from '../../src/experimental/universal/engine';
import { compile } from '../../src/experimental/universal/compiler';
const paths = ['../../research/validation-phase4/data/cards.scryfall.json', '../audit/recall/cards.scryfall.json'];
const cards = paths.flatMap(path => (JSON.parse(readFileSync(new URL(path, import.meta.url),'utf8')) as Parameters<typeof normalizeCard>[0][]).map(normalizeCard));
const card = (name: string) => cards.find(c=>c.name===name)!;
const spell = (oracleText: string) => ({ ...card('Disentomb'), manaCost: '{W}', oracleText });
const mana = {W:1,U:0,B:0,R:0,G:0,C:0};
for (const destination of ['Destroy', 'Exile']) it(`${destination} validates a mandatory type-specific target before costs`, () => {
 const s = scenario([{card:spell(`${destination} target creature.`),id:'root',zone:'hand'},{card:card('Fellwar Stone'),id:'target',zone:'battlefield'}], {mana});
 expect(execute(s,{kind:'cast',instance:'root'})[0].status).toBe('Invalid');
});
it('gains life for the prior controller using last-known power including counters', () => {
 const s=scenario([{card:card('Swords to Plowshares'),id:'root',zone:'hand'},{card:card('Grizzly Bears'),id:'target',zone:'battlefield',controller:'opponent',counters:{'+1/+1':3}}],{mana});
 const p=execute(s,{kind:'cast',instance:'root'})[0]; expect(p.status).toBe('Verified');expect(p.terminal!.objects[1].zone).toBe('exile');expect(p.terminal!.opponentLife).toBe(45);expect(p.terminal!.life).toBe(40);expect(p.events.some(e=>e.kind==='die')).toBe(false);
});
it('exile is not a death or sacrifice, and destruction triggers death without paying sacrifice costs', () => {
 for(const verb of ['Destroy','Exile']) {
 const s=scenario([{card:spell(`${verb} target creature.`),id:'root',zone:'hand'},{card:card('Doomed Dissenter'),id:'target',zone:'battlefield'}],{mana});
 const p=execute(s,{kind:'cast',instance:'root'})[0];expect(p.status).toBe('Verified');expect(p.terminal!.payoff.tokens).toBe(verb==='Destroy'?1:0);expect(p.terminal!.spent.sacrificed).toEqual([]);
 }
});
it('does not emit a life-gain trigger for a zero-power removed creature', () => {
 const s=scenario([{card:spell('Exile target creature. Its controller gains life equal to its power.'),id:'root',zone:'hand'},{card:card('Ornithopter'),id:'target',zone:'battlefield'},{card:card('Celestial Unicorn'),id:'observer',zone:'battlefield'}],{mana});
 const p=execute(s,{kind:'cast',instance:'root'})[0];expect(p.status).toBe('Verified');expect(p.terminal!.payoff.counters).toBe(0);expect(p.events.some(e=>e.kind==='gain-life')).toBe(false);
});
it('supports reusable artifact-or-enchantment targeting without accepting creatures', () => {
 expect(compile(spell('Destroy target artifact or enchantment.')).unsupported).toEqual([]);
 const s=scenario([{card:spell('Destroy target artifact or enchantment.'),id:'root',zone:'hand'},{card:card('Grizzly Bears'),id:'target',zone:'battlefield'}],{mana});
 expect(execute(s,actions(s)[0])[0].status).toBe('Invalid');
});
it('abstains on unresolved destruction prevention',()=>{
 const s=scenario([{card:spell('Destroy target creature.'),id:'root',zone:'hand'},{card:card('Grizzly Bears'),id:'target',zone:'battlefield',counters:{shield:1}}],{mana});
 expect(execute(s,{kind:'cast',instance:'root'})[0].status).toBe('Unknown');
});
it('does not treat a partially parsed removal spell as verified',()=>{
 const s=scenario([{card:spell('Exile target creature. Then its controller chooses a card from outside the game.'),id:'root',zone:'hand'},{card:card('Grizzly Bears'),id:'target',zone:'battlefield'}],{mana});
 expect(execute(s,{kind:'cast',instance:'root'})[0].status).toBe('Unknown');
});
