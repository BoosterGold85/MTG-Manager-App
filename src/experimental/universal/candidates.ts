import type { CompiledCard, Effect, Zone, Mana } from './model';
import type { AnalyzerRequest } from './protocol';
type Card = CompiledCard & { id: string };
export interface Candidate { selected: AnalyzerRequest['selected'] }
const MAX_CASES = 64, MAX_COMPARISONS = 4000;
const permanent = (c: Card) => c.types.some(t => ['Creature','Artifact','Enchantment','Planeswalker','Land','Battle'].includes(t));
function outputs(e: Effect): string[] {
  switch(e.kind) {
    case 'tokens': case 'artifact-tokens': return ['enter'];
    case 'return': return e.destination === 'battlefield' ? ['enter','move'] : ['move'];
    case 'entry-copy': case 'copy-permanent': return ['copy','enter'];
    case 'blink': return ['move','enter'];
    case 'adapt': case 'counter': return ['counter'];
    case 'power-branch': return ['draw','counter'];
    case 'entry-branch': return ['draw','counter'];
    case 'copy-spell': return ['copy','enter'];
    case 'mana': case 'counted-mana': return ['mana'];
    case 'remove': return e.destination === 'graveyard' ? ['die','move'] : ['move'];
    case 'gain-life': return ['gain-life'];
    case 'draw': case 'draw-put-back': return ['draw'];
    default: return [];
  }
}
function canAlreadyPay(cost: string, pool?: Mana): boolean {
  if (!pool) return false;
  const symbols = [...cost.matchAll(/\{([^}]+)\}/g)].map(m => m[1]);
  if (!symbols.length || symbols.some(s => !/^\d+$|^[WUBRGC]$/.test(s))) return false;
  const rest = {...pool}; let generic=0;
  for(const symbol of symbols) { if(/^\d+$/.test(symbol))generic+=Number(symbol);else {const color=symbol as keyof Mana;if(!rest[color])return false;rest[color]--;}}
  return Object.values(rest).reduce((n,v)=>n+v,0)>=generic;
}
/** A semantic candidate index, never a verifier or ranking score. Every case is
 * executed by the same strict engine, in its own explicit hypothetical state. */
export function candidates(cards: Card[], excluded?: string, pool?: Mana) {
  const known = cards.filter(c => c.id !== excluded && !c.unsupported.length).sort((a,b)=>a.id.localeCompare(b.id));
  const cases: Candidate[] = [], seen = new Set<string>(); let comparisons = 0, truncated = false;
  const add = (selected: AnalyzerRequest['selected']) => {
    const key = JSON.stringify(selected);
    if (!seen.has(key)) { seen.add(key); cases.push({selected}); }
  };
  outer: for(const source of known) {
    const modes: Zone[] = [...(!source.types.includes('Land') ? ['hand' as const] : []), ...(source.abilities.some(a=>a.kind==='activated') ? ['battlefield' as const] : [])];
    for(const zone of modes) for(const consumer of known) {
      if(comparisons >= MAX_COMPARISONS || cases.length >= MAX_CASES) { truncated = true; break outer; }
      comparisons++;
      if(consumer.id===source.id)continue;
      const abilities=source.abilities.filter(a=>zone==='hand'?a.kind==='spell'||a.kind==='triggered'||a.kind==='replacement':a.kind==='activated');
      const events=new Set(abilities.flatMap(a=>a.effects.flatMap(outputs)));
      if(zone==='hand')events.add('cast');
      if(zone==='hand'&&permanent(source))events.add('enter');
      const returnEffect=abilities.flatMap(a=>a.effects).find(e=>e.kind==='return');
      const sacrifice=zone==='hand'?source.castCost?.sacrifice:abilities.find(a=>a.cost?.sacrifice)?.cost?.sacrifice;
      const relevant=consumer.abilities.some(a=>a.trigger&&events.has(a.trigger.event)&&(!a.trigger.spellTypes||a.trigger.spellTypes.some(t=>source.types.includes(t)))&&(!a.trigger.subject.self||a.trigger.event==='counter'));
      const consumesBody=!!sacrifice&&consumer.types.some(t=>t==='Creature'||t==='Artifact');
      const manaToCast=events.has('mana')&&!consumer.types.includes('Land')&&!!consumer.manaCost&&!canAlreadyPay(consumer.manaCost,pool);
      if(!returnEffect&&!relevant&&!consumesBody&&!manaToCast)continue;
      const consumerZone: Zone=returnEffect?'graveyard':manaToCast&&!relevant&&!consumesBody?'hand':'battlefield';
      const pair=[{id:source.id,zone},{id:consumer.id,zone:consumerZone}]; add(pair);
      // Relay effects may enable a third observer. No payoff or named partner
      // enters the query; successful causal chains must be witnessed in execution.
      const relay=new Set(consumer.abilities.flatMap(a=>a.effects.flatMap(outputs)));
      if(returnEffect&&returnEffect.kind==='return'&&returnEffect.destination==='battlefield')relay.add('enter');
      for(const third of known) {
        if(comparisons >= MAX_COMPARISONS || cases.length>=MAX_CASES) {truncated=true;break outer;}
        comparisons++;
        if(third.id===source.id||third.id===consumer.id)continue;
        if(third.abilities.some(a=>a.trigger&&relay.has(a.trigger.event)))add([...pair,{id:third.id,zone:'battlefield'}]);
      }
    }
  }
  return { cases, comparisons, truncated, supportedDistinct: known.length };
}
