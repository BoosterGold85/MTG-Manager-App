import type { Ability, Action, CardPlacement, Check, Color, CompiledCard, Discovery, Effect, Event, Limits, Mana, ObjectState, Proof, Selector, State, Status, TargetRef, Zone } from './model';
import { DEFAULT_LIMITS, emptyMana, VERSION } from './model';
import { compile, fingerprint } from './compiler';

const COLORS: Color[] = ['W', 'U', 'B', 'R', 'G', 'C'];
const permanent = (c: CompiledCard) => c.types.some(t => ['Creature', 'Artifact', 'Enchantment', 'Planeswalker', 'Land', 'Battle'].includes(t));
const counterCount = (o: ObjectState) => Object.values(o.counters).reduce((a, b) => a + b, 0);
export function power(o: ObjectState): number | null { return o.card.power === null ? null : o.card.power + (o.counters['+1/+1'] || 0) - (o.counters['-1/-1'] || 0); }
export function objectId(o: ObjectState) { return `${o.instance}@${o.incarnation}`; }
export function scenario(placements: CardPlacement[], options: Partial<Pick<State, 'mana' | 'turn' | 'mainPhase' | 'stackEmpty' | 'priority' | 'library' | 'life' | 'opponentLife'>> = {}): State {
  const result: State = {
    objects: placements.map((p, i) => ({ instance: p.id || `card-${i}`, incarnation: 0, card: compile(p.card), zone: p.zone,
      controller: p.controller || 'you', owner: p.owner || p.controller || 'you', counters: { ...p.counters }, tapped: p.tapped || false, ready: p.ready ?? p.zone === 'battlefield', token: false, restrictions: [] })),
    mana: emptyMana(), manaLots: [], turn: 1, mainPhase: true, stackEmpty: true, priority: true, library: 40, unknownHand: 0,
    life: 40, opponentLife: 40, entryCounters: [], events: [],
    payoff: { draw: 0, recoveredToHand: 0, creatures: 0, tokens: 0, counters: 0, life: 0, opponentDamage: 0, manaGenerated: emptyMana(), loss: false },
    spent: { mana: emptyMana(), counters: [], tapped: [], discarded: [], sacrificed: [] },
    assumptions: ['Explicit hypothetical state; one modeled opponent; no intervening responses.', 'Only supplied objects and supported noncombat rules affect the sequence.', 'Supported optional draws and life gain choose acceptance; trigger order is one legal controller order and spell copies retain original targets. Search is not exhaustive over all choices.', 'Initial mana, library size, life totals, priority and timing are scenario inputs, not estimates of deck access.'],
    ...options,
  };
  result.mana = result.mana && { ...result.mana };
  result.manaLots = result.mana ? COLORS.map(color => ({ color, remaining: result.mana![color] })) : [];
  return result;
}
function clone(s: State): State {
  return { ...s, objects: s.objects.map(o => ({ ...o, counters: { ...o.counters }, restrictions: [...o.restrictions] })), mana: s.mana && { ...s.mana },
    manaLots: s.manaLots.map(x => ({ ...x })), entryCounters: s.entryCounters.map(x => ({ ...x })), events: [...s.events], payoff: { ...s.payoff, manaGenerated: { ...s.payoff.manaGenerated } },
    spent: { mana: { ...s.spent.mana }, counters: [...s.spent.counters], tapped: [...s.spent.tapped], discarded: [...s.spent.discarded], sacrificed: [...s.spent.sacrificed] } };
}
interface Pending { bindings?: Record<string, TargetRef[]>; sourceSnapshot: ObjectState; source: string; incarnation: number; ability: Ability; event: Event }
interface World { resolvingSource?: ObjectState; bindings: Record<string, TargetRef[]>; state: State; pending: Pending[]; copies: { original: string; parent: Event; nonlegendary: boolean }[]; checks: Check[]; steps: number; complete: boolean }
function fork(w: World): World { return { ...w, state: clone(w.state), pending: [...w.pending], copies: [...w.copies], bindings: { ...w.bindings }, checks: [...w.checks] }; }
class Rejection extends Error { constructor(readonly status: Status, message: string) { super(message); } }
function requireCheck(checks: Check[], requirement: string, value: boolean | null) {
  checks.push({ requirement, role: 'required', result: value === null ? 'unknown' : value });
  if (value !== true) throw new Rejection(value === null ? 'Conditional' : 'Invalid', requirement);
}
function unknownInfluence(o: ObjectState, source: ObjectState): boolean {
  if (o.ceased || !o.card.unsupported.length) return false;
  if (o.zone === 'battlefield' || o.instance === source.instance) return true;
  if (!['graveyard', 'exile'].includes(o.zone)) return false;
  // A narrowly recognized default battlefield-only replacement is dormant here.
  // All other unresolved off-zone text remains a blocker, not an ignored clause.
  return !o.card.unsupported.every(line => /^Each other creature you control enters with a number of additional \+1\/\+1 counters on it equal to SELF's power and as a [A-Za-z]+ in addition to its other types\.$/.test(line));
}
function active(s: State) { return s.objects.filter(o => o.zone === 'battlefield'); }
function statics(s: State, kind: Ability['static']) { return active(s).flatMap(o => o.card.abilities.filter(a => a.static === kind).map(a => ({ object: o, ability: a }))); }
function matches(o: ObjectState, sel: Selector, source: ObjectState): boolean {
  const belongsTo = ['graveyard', 'hand', 'library'].includes(o.zone) ? o.owner : o.controller;
  return !o.ceased && (!sel.nontoken || !o.token) && o.zone === sel.zone && (sel.controller === 'any' || belongsTo === source.controller) &&
    (!sel.nonland || !o.card.types.includes('Land')) && (sel.type === 'Any' || sel.type === 'ArtifactOrCreature' && (o.card.types.includes('Artifact') || o.card.types.includes('Creature')) || sel.type === 'Permanent' && permanent(o.card) || o.card.types.includes(sel.type)) &&
    (!sel.self || o.instance === source.instance && o.incarnation === source.incarnation) &&
    (!sel.another || o.instance !== source.instance || o.incarnation !== source.incarnation) &&
    (sel.maxManaValue === undefined || o.card.manaValue <= sel.maxManaValue);
}
function move(o: ObjectState, zone: Zone) {
  if (o.token && o.zone !== 'battlefield' && o.zone !== 'stack') { o.ceased = true; return; }
  if (o.baseCard && zone !== 'battlefield') { o.card = o.baseCard; o.baseCard = undefined; }
  if (o.token && o.zone === 'battlefield' && zone !== 'battlefield') o.ceased = true;
  o.zone = zone; o.incarnation++; o.counters = {}; o.tapped = false; o.ready = false;
  if (zone !== 'battlefield') o.restrictions = [];
  if (['graveyard', 'hand', 'library'].includes(zone)) o.controller = o.owner;
  o.discardedTurn = undefined;
}
/** A resolution-time property query; does not require a Vehicle to be a creature. */
export function flying(s: State, o: ObjectState): { value: boolean; sources: string[] } {
  const sources = o.zone === 'battlefield' && o.card.types.includes('Vehicle')
    ? statics(s, 'vehicle-flying').filter(x => x.object.controller === o.controller).map(x => x.object.instance) : [];
  return { value: o.card.keywords.includes('Flying') || !!o.counters.flying || sources.length > 0, sources };
}
function emit(w: World, kind: Event['kind'], subject: ObjectState, count: number, source?: ObjectState, ability?: Ability, parent?: Event, note = '', extra: string[] = [], counterType = '+1/+1'): Event {
  const ancestor = parent?.participants || [];
  const event: Event = { id: `event:${w.state.events.length}`, kind, subject: subject.instance, incarnation: subject.incarnation, count,
    source: source?.instance, ability: ability?.id, parents: parent ? [parent.id] : [],
    participants: [...new Set([...ancestor, subject.instance, ...(source ? [source.instance] : []), ...extra])].sort(),
    evidence: [...(parent?.evidence || []), ...(ability ? [ability.evidence] : [])], note, counterType: kind === 'counter' ? counterType : undefined };
  if (kind === 'die') event.snapshot = { ...subject, counters: { ...subject.counters }, restrictions: [...subject.restrictions] };
  w.state.events.push(event);
  // Capture triggers when the event happens, not when a later queue is inspected.
  for (const observer of active(w.state)) for (const a of observer.card.abilities) {
    const t = a.trigger; if (!t || t.event !== kind) continue;
    if (t.spellTypes && !t.spellTypes.some(type => subject.card.types.includes(type))) continue;
    if (t.minimumPower !== undefined || t.maximumPower !== undefined) {
      const p = power(subject); if (p === null) throw new Rejection('Unknown', 'Dynamic event-object power cannot be established.');
      if (t.minimumPower !== undefined && p < t.minimumPower || t.maximumPower !== undefined && p > t.maximumPower) continue;
    }
    const condition = conditionHolds(w.state, a, observer, subject);
    if (a.condition) w.checks.push({ requirement: `Intervening condition at trigger creation: ${JSON.stringify(a.condition)}`, role: 'branch', result: condition, evidence: a.evidence });
    if (!condition) continue;
    if (kind === 'counter' && event.counterType !== '+1/+1') continue;
    if (kind !== 'gain-life' && !matches(subject, t.subject, observer)) continue;
    if (kind === 'gain-life' && subject.controller !== observer.controller) continue;
    if (t.matchingPower) {
      const p = power(observer);
      if (p === null) throw new Rejection('Unknown', 'Cannot evaluate dynamic power for the cast trigger.');
      w.checks.push({ requirement: `At cast: mana value ${subject.card.manaValue} equals source power ${p}`, result: subject.card.manaValue === p, evidence: a.evidence });
      if (subject.card.manaValue !== p) continue;
      const previous = [...w.state.events].reverse().find(e => ['counter', 'remove-counter'].includes(e.kind) && e.subject === observer.instance && e.incarnation === observer.incarnation);
      if (previous) {
        event.parents = [...new Set([...event.parents, previous.id])];
        event.participants = [...new Set([...event.participants, ...previous.participants])].sort();
        event.evidence = [...new Map([...event.evidence, ...previous.evidence].map(e => [e.id, e])).values()];
      }
    }
    w.pending.push({ sourceSnapshot: { ...observer, counters: { ...observer.counters } }, source: observer.instance, incarnation: observer.incarnation, ability: a, event });
  }
  return event;
}
function conditionHolds(s: State, a: Ability, source: ObjectState, subject?: ObjectState): boolean {
  const c = a.condition; if (!c) return true;
  if (c.kind === 'source-counters') return counterCount(source) >= c.minimum;
  if (c.kind === 'control-creature-count') return active(s).filter(o => o.controller === source.controller && o.card.types.includes('Creature')).length >= c.minimum;
  if (c.kind === 'control-power-at-least') {
    const creatures = active(s).filter(o => o.controller === source.controller && o.card.types.includes('Creature'));
    if (creatures.some(o => power(o) === null)) throw new Rejection('Unknown', 'Intervening condition needs unsupported dynamic power.');
    return creatures.some(o => power(o)! >= c.minimum);
  }
  if (!subject) throw new Rejection('Unknown', 'Intervening name condition requires an identified event object.');
  return !s.objects.some(o => o.instance !== subject.instance && o.card.name === subject.card.name && o.card.types.includes('Creature') && (o.zone === 'battlefield' && o.controller === source.controller || o.zone === 'graveyard' && o.owner === source.controller));
}
function sacrifice(w: World, o: ObjectState, source: ObjectState, a: Ability, parent?: Event) {
  requireCheck(w.checks, 'Sacrifice payment is a current permanent you control', o.zone === 'battlefield' && o.controller === source.controller && !o.ceased);
  const event = o.card.types.includes('Creature') ? emit(w, 'die', o, 1, source, a, parent, 'Died: battlefield to graveyard, with last-known object identity.') : undefined;
  move(o, 'graveyard'); w.state.spent.sacrificed.push(o.instance);
  return emit(w, 'move', o, 1, source, a, event || parent, 'Sacrificed to its owner’s graveyard; not discarded.');
}
function placeCounters(w: World, target: ObjectState, count: number, source: ObjectState, a: Ability, parent?: Event) {
  if (target.zone !== 'battlefield' || count <= 0) return;
  const replacements = statics(w.state, 'counter-addition').filter(x => x.object.controller === target.controller && target.card.types.includes('Creature'));
  count += replacements.length;
  const cancellation = Math.min(count, target.counters['-1/-1'] || 0);
  target.counters['+1/+1'] = (target.counters['+1/+1'] || 0) + count;
  w.state.payoff.counters += count;
  const event = emit(w, 'counter', target, count, source, a, parent, `${count} +1/+1 counter(s) on ${objectId(target)}; one placement event.`, replacements.map(x => x.object.instance));
  event.evidence = [...new Map([...event.evidence, ...replacements.map(x => x.ability.evidence)].map(e => [e.id, e])).values()];
  if (cancellation) { target.counters['+1/+1'] -= cancellation; target.counters['-1/-1'] -= cancellation; }
}
function enter(w: World, o: ObjectState, source: ObjectState, a?: Ability, parent?: Event) {
  if (o.ceased) return;
  if (o.card.abilities.some(a => a.effects.some(e => e.kind === 'entry-copy'))) throw new Rejection('Unknown', 'This zone transition requires an unbound optional entry-copy choice.');
  if (o.card.unsupported.length) throw new Rejection('Unknown', `Entering object has unresolved mechanics: ${o.card.name}`);
  if (['graveyard', 'library'].includes(o.zone) && o.card.types.includes('Creature') && statics(w.state, 'graveyard-entry-prohibition').length) {
    w.checks.push({ requirement: 'An active prohibition prevents this creature-card zone transition; the surrounding spell is still legal', result: false, evidence: statics(w.state, 'graveyard-entry-prohibition')[0].ability.evidence });
    return;
  }
  move(o, 'battlefield');
  if (o.controller === 'opponent' && o.card.abilities.some(a => a.kind !== 'static')) throw new Rejection('Unknown', 'An entering opponent-controlled ability requires multiplayer resource/ordering support.');
  w.state.payoff.creatures += Number(o.controller === 'you' && o.card.types.includes('Creature'));
  if (o.card.legendary && active(w.state).some(x => x.instance !== o.instance && x.card.oracleId === o.card.oracleId && x.controller === o.controller && x.card.legendary))
    throw new Rejection('Unknown', 'Legend-rule choices are outside this prototype; no completed payoff is certified.');
  // Supported activated entry-counter grant, before the entry event.
  for (const r of w.state.entryCounters.filter(r => r.turn === w.state.turn)) {
    const grantor = w.state.objects.find(x => x.instance === r.source);
    if (o.card.types.includes('Creature') && grantor) {
      const grantAbility = grantor.card.abilities.find(x => x.effects.some(e => e.kind === 'entry-counter-permission'));
      if (grantAbility) placeCounters(w, o, r.count, grantor, grantAbility, parent);
    }
  }
  if (o.card.types.includes('Creature') && (o.card.toughness === null || o.card.toughness + (o.counters['+1/+1'] || 0) - (o.counters['-1/-1'] || 0) <= 0))
    throw new Rejection('Unknown', 'Unsupported or nonpositive toughness needs additional state-based-action handling.');
  return emit(w, 'enter', o, 1, source, a, parent, `Entered battlefield as ${objectId(o)}.`);
}
function enterSpell(w: World, spell: ObjectState, a: Ability, parent: Event, limits: Limits): World[] {
  const replacement = spell.card.abilities.flatMap(a => a.effects).find(e => e.kind === 'entry-copy');
  if (!replacement || replacement.kind !== 'entry-copy') { enter(w, spell, spell, a, parent); return [w]; }
  const candidates = w.state.objects.filter(o => matches(o, replacement.selector, spell));
  if (!candidates.length) throw new Rejection('Unknown', 'No supported nonzero-toughness entry-copy choice; unchosen copy replacement needs additional state-based-action handling.');
  return candidates.slice(0, limits.branches).map(target => {
    const next = fork(w), entrant = next.state.objects.find(o => o.instance === spell.instance)!;
    if (target.card.unsupported.length || target.card.abilities.some(a => a.effects.some(e => e.kind === 'entry-copy'))) throw new Rejection('Unknown', 'Chosen copiable values have unresolved replacement or abilities.');
    const evidence = spell.card.abilities.find(a => a.effects.includes(replacement))!;
    const copy = emit(next, 'copy', target, 1, entrant, evidence, parent, 'Optional entry replacement: copied values, not a targeted spell and not a cast.');
    entrant.baseCard = entrant.card; entrant.card = target.card;
    next.complete &&= candidates.length <= limits.branches;
    enter(next, entrant, entrant, evidence, copy); return next;
  });
}
function choices<T>(values: T[], maximum: number, limit = 33): T[][] {
  const out: T[][] = [[]];
  function visit(start: number, group: T[]) {
    if (out.length >= limit) return;
    if (group.length) out.push([...group]);
    if (group.length >= maximum) return;
    for (let i = start; i < values.length; i++) visit(i + 1, [...group, values[i]]);
  }
  visit(0, []); return out;
}
export function targetKey(a: Ability, effect: Effect): string { return `${a.id}:target:${a.effects.indexOf(effect)}`; }
function targetSpec(effect: Effect): { selector: Selector; minimum: number; maximum: number } | undefined {
  if (['return', 'blink', 'copy-permanent', 'untap', 'sacrifice'].includes(effect.kind)) {
    const e = effect as Extract<Effect, { target: Selector }>;
    if (!e.target) return undefined;
    return { selector: e.target, minimum: 1, maximum: 1 };
  }
  if (effect.kind === 'counter' && effect.recipient === 'target') return { selector: { type: 'Creature', zone: 'battlefield', controller: 'any' }, minimum: effect.minimum ?? 1, maximum: effect.maximum };
}
function boundTargets(w: World, a: Ability, effect: Effect, source: ObjectState): ObjectState[] {
  const spec = targetSpec(effect); if (!spec) return [];
  const refs = w.bindings[targetKey(a, effect)];
  if (!refs) throw new Rejection('Unknown', 'Required targets were not bound before resolution.');
  return refs.flatMap(ref => {
    const o = w.state.objects.find(x => x.instance === ref.instance && x.incarnation === ref.incarnation);
    return o && matches(o, spec.selector, source) ? [o] : [];
  });
}
function bindAbility(worlds: World[], a: Ability, source: ObjectState, limits: Limits, supplied?: Action['targets'], trigger = false): World[] {
  if (supplied) { const expected = a.effects.filter(e => targetSpec(e)).map(e => targetKey(a, e)); for (const w of worlds) requireCheck(w.checks, 'Explicit target keys exactly match this announced ability', Object.keys(supplied).length === expected.length && Object.keys(supplied).every(key => expected.includes(key))); }
  for (const effect of a.effects) {
    const spec = targetSpec(effect); if (!spec) continue;
    const key = targetKey(a, effect);
    worlds = worlds.flatMap(w => {
      const candidates = w.state.objects.filter(o => matches(o, spec.selector, source) && (effect.kind !== 'return' || !o.token));
      let groups = choices(candidates, spec.maximum, limits.branches + 2).filter(g => g.length >= spec.minimum);
      if (supplied?.[key]) {
        const refs = supplied[key];
        const objects = refs.map(ref => candidates.find(o => o.instance === ref.instance && o.incarnation === ref.incarnation));
        requireCheck(w.checks, 'Explicit targets are distinct, legal and refer to current object incarnations', refs.length >= spec.minimum && refs.length <= spec.maximum && new Set(refs.map(r => r.instance)).size === refs.length && objects.every(Boolean));
        groups = [objects as ObjectState[]];
      }
      if (!groups.length && trigger) return []; // Mandatory target trigger is removed from stack.
      requireCheck(w.checks, `Mandatory target selection for ${key}: type, zone, controller and count are legal before costs`, groups.length > 0);
      return groups.slice(0, limits.branches).map(group => {
        const next = fork(w); next.bindings[key] = group.map(o => ({ instance: o.instance, incarnation: o.incarnation }));
        next.complete &&= groups.length <= limits.branches; return next;
      });
    });
  }
  return worlds;
}
function apply(w: World, effect: Effect, sourceId: string, a: Ability, parent: Event | undefined, limits: Limits): World[] {
  const current = w.state.objects.find(o => o.instance === sourceId)!;
  const snapshot = w.resolvingSource?.instance === sourceId ? w.resolvingSource : undefined;
  const source: ObjectState = snapshot && snapshot.incarnation !== current.incarnation ? { ...snapshot, zone: 'graveyard' } : current;
  const eventObject = parent && w.state.objects.find(o => o.instance === parent.subject && o.incarnation === parent.incarnation);
  if (++w.steps > limits.automaticSteps) throw new Rejection('Unknown', 'Automatic resolution budget exhausted; no completed proof.');
  switch (effect.kind) {
    case 'entry-copy': throw new Rejection('Unknown', 'Entry-copy replacements must be applied during the zone transition.');
    case 'counted-mana': {
      const objects = w.state.objects.filter(o => matches(o, effect.selector, source));
      if (objects.length > limits.automaticSteps) throw new Rejection('Unknown', 'Counted mana exceeds materialization budget.');
      const enriched = emit(w, 'condition', source, objects.length, source, a, parent, 'Counted actual matching resource objects at resolution.', objects.map(o => o.instance));
      return apply(w, { kind: 'mana', symbols: objects.map(() => effect.color) }, sourceId, a, enriched, limits);
    }
    case 'power-branch': {
      if (!eventObject || eventObject.zone !== 'battlefield' || power(eventObject) === null) throw new Rejection('Unknown', 'Conditional payoff needs current event-object power.');
      const draws = power(eventObject)! >= effect.threshold;
      w.checks.push({ requirement: `Resolution power is at least ${effect.threshold}`, role: 'branch', result: draws, evidence: a.evidence });
      return apply(w, draws ? { kind: 'draw', count: effect.draw } : { kind: 'counter', count: effect.counters, recipient: 'event', maximum: 1 }, sourceId, a, parent, limits);
    }
    case 'artifact-tokens': {
      if (effect.count > limits.automaticSteps - w.steps) throw new Rejection('Unknown', 'Artifact token materialization exceeds budget.');
      for (let i = 0; i < effect.count; i++) {
        const id = `token-${w.state.objects.length}`;
        const ability: Ability = { id: `${id}:predefined-token`, kind: 'activated', evidence: { ...a.evidence, rule: `subset:predefined-${effect.subtype}-token` }, cost: { mana: effect.subtype === 'Treasure' ? '' : '{2}', tap: effect.subtype !== 'Clue', sacrifice: { type: 'Any', zone: 'battlefield', controller: 'you', self: true } }, effects: effect.subtype === 'Treasure' ? [{ kind: 'mana', symbols: [], choose: true }] : effect.subtype === 'Clue' ? [{ kind: 'draw', count: 1 }] : [{ kind: 'gain-life', count: 3 }] };
        const token: ObjectState = { instance: id, incarnation: 0, zone: 'stack', owner: source.controller, controller: source.controller, counters: {}, tapped: false, ready: false, token: true, restrictions: [], card: { ...source.card, key: fingerprint([effect.subtype, id]), oracleId: 'predefined-token', name: `${effect.subtype} token`, types: ['Artifact', effect.subtype], colors: [], manaValue: 0, manaCost: '', power: null, toughness: null, keywords: [], legendary: false, abilities: [ability], castCost: undefined, unsupported: [], deferred: [] } };
        w.state.objects.push(token); w.state.payoff.tokens++; enter(w, token, source, a, parent);
      }
      return [w];
    }
    case 'blink': {
      const target = boundTargets(w, a, effect, source)[0]; if (!target) return [w];
      const prior = target.incarnation;
      move(target, 'exile'); const exiled = emit(w, 'move', target, 1, source, a, parent, `Exiled object from incarnation ${prior}; counters reset, no death event.`);
      if (target.token) { target.ceased = true; return [w]; }
      target.controller = effect.ownerControl ? target.owner : source.controller;
      enter(w, target, source, a, exiled); return [w];
    }
    case 'copy-permanent': {
      const target = boundTargets(w, a, effect, source)[0]; if (!target) return [w];
      if (target.card.unsupported.length) throw new Rejection('Unknown', 'Cannot certify a copy with unresolved copiable abilities.');
      const token: ObjectState = { ...target, instance: `copy-${w.state.objects.length}`, incarnation: 0, zone: 'stack', owner: source.controller, controller: source.controller, counters: {}, tapped: false, ready: false, restrictions: [], token: true, ceased: false };
      w.state.objects.push(token); w.state.payoff.tokens++;
      const e = emit(w, 'copy', target, 1, source, a, parent, 'Copied copiable values, excluding counters, readiness and temporary grants.');
      enter(w, token, source, a, e); return [w];
    }
    case 'untap': {
      const targets = effect.self ? source.zone === 'battlefield' ? [source] : [] : effect.allCreatures ? active(w.state).filter(o => o.card.types.includes('Creature')) : boundTargets(w, a, effect, source);
      for (const target of targets) { target.tapped = false; emit(w, 'move', target, 1, source, a, parent, 'Untapped without a zone change; summoning sickness remains.'); }
      return [w];
    }
    case 'sacrifice': {
      const target = boundTargets(w, a, effect, source)[0]; if (target) sacrifice(w, target, source, a, parent); return [w];
    }
    case 'draw': {
      if (w.state.library === null) throw new Rejection('Conditional', 'A sufficient library must be available to obtain the claimed cards.');
      const drawn = Math.min(w.state.library, effect.count);
      const identified = w.state.objects.filter(o => o.zone === 'library' && o.owner === source.controller).slice(0, drawn);
      w.state.library -= drawn; w.state.unknownHand += drawn - identified.length; w.state.payoff.draw += drawn;
      w.state.payoff.loss ||= drawn < effect.count;
      const draw = emit(w, 'draw', source, drawn, source, a, parent, 'Unidentified drawn cards cannot be invented as future enablers.');
      for (const card of identified) {
        move(card, 'hand'); emit(w, 'move', card, 1, source, a, draw, 'Drawn from the declared library sequence; no discard occurred.');
      }
      return [w];
    }
    case 'gain-life':
      w.state.life += effect.count; w.state.payoff.life += effect.count;
      emit(w, 'gain-life', source, effect.count, source, a, parent); return [w];
    case 'lose-life': w.state.life -= effect.count; w.state.payoff.life -= effect.count; w.state.payoff.loss ||= w.state.life <= 0; return [w];
    case 'damage':
      if (source.card.keywords.includes('Lifelink')) { w.state.life += effect.count; w.state.payoff.life += effect.count; emit(w, 'gain-life', source, effect.count, source, a, parent, 'Lifelink applies to this damage event.'); }
      w.state.opponentLife -= effect.count; w.state.payoff.opponentDamage += effect.count;
      emit(w, 'damage', source, effect.count, source, a, parent, 'Damage to the one modeled opponent.'); return [w];
    case 'mana': {
      if (effect.choose) return (['W', 'U', 'B', 'R', 'G'] as Color[]).flatMap(color => apply(fork(w), { kind: 'mana', symbols: [color] }, sourceId, a, parent, limits));
      if (!w.state.mana) throw new Rejection('Conditional', 'Mana pool is not specified.');
      for (const color of effect.symbols as Color[]) { w.state.mana[color]++; w.state.payoff.manaGenerated[color]++; }
      const grants = a.static === 'counter-mana' ? statics(w.state, 'counter-mana').filter(g => g.object.controller === source.controller && g.ability.evidence.id === a.evidence.id).map(g => g.object.instance) : [];
      const e = emit(w, 'mana', source, effect.symbols.length, source, a, parent, grants.length ? 'Granted mana ability; a counter, readiness and tap payment are required.' : '', grants);
      for (const color of effect.symbols as Color[]) w.state.manaLots.push({ color, remaining: 1, event: e.id, source: source.instance });
      return [w];
    }
    case 'counter': {
      const targets = effect.recipient === 'self' ? source.zone === 'battlefield' ? [source] : []
        : effect.recipient === 'event' ? eventObject?.zone === 'battlefield' ? [eventObject] : []
        : active(w.state).filter(o => o.card.types.includes('Creature'));
      const groups = effect.recipient === 'target' ? [boundTargets(w, a, effect, source)] : [targets];
      return groups.slice(0, limits.branches).map(group => {
        const next = fork(w); if (groups.length > limits.branches) next.complete = false;
        for (const target of group) placeCounters(next, next.state.objects.find(o => o.instance === target.instance)!, effect.count, next.state.objects.find(o => o.instance === sourceId)!, a, parent);
        return next;
      });
    }
    case 'adapt':
      w.checks.push({ requirement: 'At Adapt resolution: source has no +1/+1 counters', result: !(source.counters['+1/+1'] || 0), evidence: a.evidence });
      if (!(source.counters['+1/+1'] || 0)) placeCounters(w, source, effect.count, source, a, parent);
      return [w];
    case 'return': {
      const targets = boundTargets(w, a, effect, source);
      if (!targets.length) return [w]; // Trigger absent or every bound target became illegal.
      return targets.slice(0, limits.branches).map(target => {
        const next = fork(w); if (targets.length > limits.branches) next.complete = false;
        const o = next.state.objects.find(x => x.instance === target.instance)!;
        next.checks.push({ requirement: `${objectId(o)} is a legal ${effect.target.type} graveyard target; mana-value restriction checked`, result: true, evidence: a.evidence });
        if (effect.destination === 'hand') {
          move(o, 'hand'); next.state.payoff.recoveredToHand++;
          emit(next, 'move', o, 1, source, a, parent, 'Recovered to hand, not cast.');
        } else { enter(next, o, source, a, parent); if (o.zone === 'battlefield') o.restrictions.push(...effect.restrictions); }
        return next;
      });
    }
    case 'tokens': {
      if (effect.count > limits.automaticSteps - w.steps) throw new Rejection('Unknown', 'Token materialization exceeds the automatic-step budget.');
      for (let i = 0; i < effect.count; i++) {
        const token: ObjectState = { instance: `token-${w.state.objects.length}`, incarnation: 0, zone: 'stack', controller: source.controller, owner: source.controller,
          counters: {}, tapped: false, ready: false, token: true, restrictions: [],
          card: { ...source.card, key: fingerprint(effect), oracleId: 'generated-token', name: `${effect.types.join(' ')} token`, types: ['Creature', ...effect.types], colors: effect.colors, manaValue: 0, manaCost: '', power: effect.power, toughness: effect.toughness, keywords: effect.keywords || [], legendary: false, abilities: [], unsupported: [], deferred: [] } };
        w.state.objects.push(token); w.state.payoff.tokens++;
        enter(w, token, source, a, parent);
      }
      return [w];
    }
    case 'entry-branch': {
      if (!eventObject || eventObject.zone !== 'battlefield') throw new Rejection('Unknown', 'This branch needs last-known-information handling not implemented by this subset.');
      const property = flying(w.state, eventObject);
      w.checks.push({ requirement: 'At trigger resolution: entering Vehicle has flying; crewing is irrelevant', result: property.value, evidence: a.evidence });
      if (property.value) {
        // Carry static-grant participants through the resulting payoff's provenance.
        const enriched = { ...parent!, participants: [...new Set([...parent!.participants, ...property.sources])], evidence: [...parent!.evidence, ...statics(w.state, 'vehicle-flying').filter(x => property.sources.includes(x.object.instance)).map(x => x.ability.evidence)] };
        return apply(w, { kind: 'draw', count: 1 }, sourceId, a, enriched, limits);
      }
      eventObject.counters.flying = 1;
      emit(w, 'counter', eventObject, 1, source, a, parent, 'Flying counter, not a +1/+1 counter; no draw from this branch.', [], 'flying');
      return [w];
    }
    case 'copy-spell':
      if (!eventObject || eventObject.zone !== 'stack') return [w];
      {
        const e = emit(w, 'copy', eventObject, 1, source, a, parent, 'Copying a spell is not casting it.');
        w.copies.push({ original: eventObject.instance, parent: e, nonlegendary: effect.nonlegendary });
        if (effect.thenCounterSelf && source.zone === 'battlefield') placeCounters(w, source, 1, source, a, e);
        return [w];
      }
    case 'entry-counter-permission': w.state.entryCounters.push({ source: sourceId, count: effect.count, turn: w.state.turn }); return [w];
    case 'discard-choice-draw': throw new Rejection('Unknown', 'Discard choice must be bound by the action before resolution.');
    case 'surveil': {
      const top = w.state.objects.filter(o => o.zone === 'library').slice(0, effect.count);
      if (top.length < effect.count) throw new Rejection('Conditional', 'Specify the surveilled library cards; their identities are not inferred.');
      return choices(top, top.length, limits.branches + 1).slice(0, limits.branches).map(group => {
        const next = fork(w);
        for (const card of group) {
          const o = next.state.objects.find(o => o.instance === card.instance)!; move(o, 'graveyard');
          if (next.state.library !== null) next.state.library--;
          emit(next, 'move', o, 1, source, a, parent, 'Library to graveyard by surveil; not a discard.');
        }
        return next;
      });
    }
  }
}
function effects(worlds: World[], list: Effect[], source: string, a: Ability, parent: Event | undefined, limits: Limits): World[] {
  const fizzled: World[] = [];
  worlds = worlds.filter(w => {
    const object = w.state.objects.find(o => o.instance === source)!;
    const targeted = list.filter(e => targetSpec(e));
    const selected = targeted.flatMap(e => w.bindings[targetKey(a, e)] || []);
    const legal = targeted.flatMap(e => boundTargets(w, a, e, object));
    if (selected.length && !legal.length) { w.checks.push({ requirement: 'All selected targets became illegal; this spell or ability does not resolve', role: 'branch', result: false, evidence: a.evidence }); fizzled.push(w); return false; }
    return true;
  });
  for (const effect of list) {
    const next = worlds.flatMap(w => apply(w, effect, source, { ...a, evidence: a.effectEvidence?.[a.effects.indexOf(effect)] || a.evidence }, parent, limits));
    worlds = next.slice(0, limits.branches); if (next.length > limits.branches) for (const w of worlds) w.complete = false;
  }
  return [...worlds, ...fizzled];
}
function announceTriggers(w: World, limits: Limits): World[] {
  const pending = w.pending; w.pending = [];
  let worlds = [w];
  for (const item of pending) {
    if (item.bindings) { worlds.forEach(world => world.pending.push(item)); continue; }
    worlds = worlds.flatMap(world => {
      const bound = bindAbility([world], item.ability, item.sourceSnapshot, limits, undefined, true);
      if (!bound.length) return [world];
      return bound.map(next => { next.pending.push({ ...item, bindings: { ...next.bindings } }); return next; });
    });
    if (worlds.length > limits.branches) throw new Rejection('Unknown', 'Trigger target-announcement branching exceeded its budget.');
  }
  return worlds;
}
function settle(worlds: World[], limits: Limits): World[] {
  const done: World[] = [], queue = [...worlds];
  while (queue.length) {
    const w = queue.shift()!;
    if (w.state.payoff.loss || w.state.opponentLife <= 0) { done.push(w); continue; }
    if (++w.steps > limits.automaticSteps) throw new Rejection('Unknown', 'Trigger/copy processing limit reached; a cycle is not certified as infinite.');
    if (w.pending.some(p => !p.bindings)) { queue.push(...announceTriggers(w, limits)); continue; }
    if (w.pending.length) {
      const trigger = w.pending.shift()!;
      const currentSource = w.state.objects.find(o => o.instance === trigger.source);
      if (!currentSource) throw new Rejection('Unknown', 'Trigger source identity was lost.');
      if (currentSource.incarnation !== trigger.incarnation && currentSource.controller !== trigger.sourceSnapshot.controller) throw new Rejection('Unknown', 'Changed trigger controller requires additional last-known-information handling.');
      const eventObject = w.state.objects.find(o => o.instance === trigger.event.subject && o.incarnation === trigger.event.incarnation) || trigger.event.snapshot;
      if (!conditionHolds(w.state, trigger.ability, trigger.sourceSnapshot, eventObject)) { w.checks.push({ requirement: 'Intervening condition is false at resolution: no effect', role: 'branch', result: false, evidence: trigger.ability.evidence }); queue.push(w); continue; }
      // New triggers/copies go above older stack items, not behind them in a FIFO queue.
      const suspendedTriggers = w.pending, suspendedCopies = w.copies, suspendedSource = w.resolvingSource;
      w.pending = []; w.copies = [];
      if (trigger.ability.condition) w.checks.push({ requirement: `Intervening condition at resolution: ${JSON.stringify(trigger.ability.condition)}`, role: 'branch', result: true, evidence: trigger.ability.evidence });
      w.bindings = { ...w.bindings, ...trigger.bindings };
      w.resolvingSource = trigger.sourceSnapshot;
      const resolved = settle(effects([w], trigger.ability.effects, trigger.source, trigger.ability, trigger.event, limits), limits);
      for (const next of resolved) {
        next.resolvingSource = suspendedSource; next.pending.push(...suspendedTriggers); next.copies.push(...suspendedCopies); queue.push(next);
      }
    } else if (w.copies.length) {
      const copy = w.copies.shift()!, original = w.state.objects.find(o => o.instance === copy.original)!;
      if (!permanent(original.card)) {
        const spellAbilities = original.card.abilities.filter(a => a.kind === 'spell');
        const copied: ObjectState = { ...original, instance: `copy-${w.state.objects.length}`, incarnation: 0, token: true, baseCard: undefined, counters: {}, restrictions: [] };
        w.state.objects.push(copied);
        const combined: Ability = { id: `${original.card.key}:cast`, kind: 'spell', effects: spellAbilities.flatMap(a => a.effects), effectEvidence: spellAbilities.flatMap(a => a.effects.map(() => a.evidence)), evidence: spellAbilities[0]?.evidence || copy.parent.evidence.at(-1)! };
        const resolved = effects([w], combined.effects, copied.instance, combined, copy.parent, limits);
        for (const next of resolved) { const object = next.state.objects.find(o => o.instance === copied.instance)!; move(object, 'exile'); object.ceased = true; }
        queue.push(...resolved); continue;
      }
      const token: ObjectState = { ...original, instance: `copy-${w.state.objects.length}`, incarnation: 0, token: true, counters: {}, restrictions: [], card: { ...original.card, legendary: copy.nonlegendary ? false : original.card.legendary } };
      w.state.objects.push(token); w.state.payoff.tokens++;
      enter(w, token, token, undefined, copy.parent); queue.push(w);
    } else done.push(w);
    if (queue.length + done.length > limits.branches) {
      queue.splice(Math.max(0, limits.branches - done.length));
      for (const x of [...queue, ...done]) x.complete = false;
    }
  }
  return done;
}
function manaPayments(pool: Mana, text: string, limit: number): { pool: Mana; spent: Mana }[] {
  const symbols = [...text.matchAll(/\{([^}]+)\}/g)].map(x => x[1]);
  if (text.replace(/\{[^}]+\}/g, '').trim() || symbols.some(x => !/^\d+$|^[WUBRGC]$/.test(x))) throw new Rejection('Unknown', 'Unsupported mana symbol or cost qualifier.');
  const rest = { ...pool }, spent = emptyMana(); let generic = 0;
  for (const symbol of symbols) {
    if (/^\d+$/.test(symbol)) generic += Number(symbol);
    else { const c = symbol as Color; if (!rest[c]) return []; rest[c]--; spent[c]++; }
  }
  const out: { pool: Mana; spent: Mana }[] = [];
  function allocate(index: number, amount: number, p: Mana, s: Mana) {
    if (out.length > limit) return;
    if (index === COLORS.length) { if (!amount) out.push({ pool: p, spent: s }); return; }
    const c = COLORS[index];
    for (let used = 0; used <= Math.min(p[c], amount); used++) allocate(index + 1, amount - used, { ...p, [c]: p[c] - used }, { ...s, [c]: s[c] + used });
  }
  if (generic > Object.values(rest).reduce((a, b) => a + b, 0)) return [];
  allocate(0, generic, rest, spent); return out;
}
export function actions(s: State): Action[] {
  const out: Action[] = [];
  for (const o of s.objects.filter(o => o.controller === 'you')) {
    if (o.zone === 'hand' && !o.card.types.includes('Land')) {
      const choice = o.card.abilities.some(a => a.effects.some(e => e.kind === 'discard-choice-draw'));
      if (choice) {
        for (const card of s.objects.filter(x => x.zone === 'hand' && x.instance !== o.instance && x.controller === 'you')) out.push({ kind: 'cast', instance: o.instance, discard: card.instance });
        for (const card of active(s).filter(x => x.controller === 'you' && x.card.types.includes('Artifact'))) out.push({ kind: 'cast', instance: o.instance, sacrifice: card.instance });
        out.push({ kind: 'cast', instance: o.instance });
      } else if (o.card.castCost?.sacrifice) for (const target of active(s).filter(x => matches(x, o.card.castCost!.sacrifice!, o))) out.push({ kind: 'cast', instance: o.instance, sacrifice: target.instance });
      else out.push({ kind: 'cast', instance: o.instance });
    }
    if (o.zone === 'graveyard') {
      if (o.card.abilities.some(a => a.permission === 'discarded-this-turn')) out.push({ kind: 'cast', instance: o.instance, mayhem: true });
      if (o.card.abilities.some(a => a.permission === 'flashback')) out.push({ kind: 'cast', instance: o.instance, flashback: true });
    }
    if (o.zone === 'battlefield') {
      for (const a of o.card.abilities.filter(a => a.kind === 'activated')) {
        if (a.cost?.removeCounter) for (const target of active(s).filter(x => matches(x, a.cost!.removeCounter!, o) && (x.counters['+1/+1'] || 0) > 0)) out.push({ kind: 'activate', instance: o.instance, ability: a.id, counterSource: target.instance });
        else if (a.cost?.sacrifice) for (const target of active(s).filter(x => matches(x, a.cost!.sacrifice!, o))) out.push({ kind: 'activate', instance: o.instance, ability: a.id, sacrifice: target.instance });
        else out.push({ kind: 'activate', instance: o.instance, ability: a.id });
      }
      if (o.card.types.includes('Creature') && counterCount(o) && statics(s, 'counter-mana').some(x => x.object.controller === o.controller)) out.push({ kind: 'activate', instance: o.instance, ability: 'granted-counter-mana' });
    }
  }
  return out.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
export function execute(input: State, action: Action, supplied: Partial<Limits> = {}): Proof[] {
  const limits = { ...DEFAULT_LIMITS, ...supplied }, checks: Check[] = [];
  const start = input.events.length;
  const dependencies = [`rules:${VERSION}`, `scenario:${fingerprint(input)}`, 'query:all-applicable-static-effects-including-absence', ...input.objects.map(o => `object:${objectId(o)}:${o.card.key}`)];
  const base = (status: Status, message: string): Proof => ({ status, executable: status === 'Conditional' || status === 'Unknown' ? 'unknown' : 'unavailable', action, checks, prerequisites: [message], participants: [action.instance], evidence: [], assumptions: input.assumptions, events: [], dependencies, complete: false });
  try {
    requireCheck(checks, 'Object instance identifiers are unique', new Set(input.objects.map(o => o.instance)).size === input.objects.length);
    requireCheck(checks, 'Resource amounts are finite nonnegative integers', (!input.mana || COLORS.every(c => Number.isSafeInteger(input.mana![c]) && input.mana![c] >= 0)) && input.objects.every(o => Object.values(o.counters).every(n => Number.isSafeInteger(n) && n >= 0)) && (input.library === null || Number.isSafeInteger(input.library) && input.library >= 0));
    const selected = input.objects.find(o => o.instance === action.instance);
    requireCheck(checks, 'Source object exists and is controlled by you', !!selected && selected.controller === 'you');
    const source = selected!;
    requireCheck(checks, 'Life totals and turn are specified as finite integers', Number.isSafeInteger(input.life) && Number.isSafeInteger(input.opponentLife) && Number.isSafeInteger(input.turn) && input.turn > 0);
    if (input.objects.some(o => (o.counters['+1/+1'] || 0) > 0 && (o.counters['-1/-1'] || 0) > 0)) throw new Rejection('Unknown', 'Initial opposing counter pairs require a prior state-based-action boundary.');
    requireCheck(checks, 'Source object has not ceased to exist', !source.ceased);
    if (source.restrictions.length) throw new Rejection('Unknown', 'Unresolved continuous restrictions on the acting object.');
    requireCheck(checks, 'The modeled game has not already ended', !input.payoff.loss && input.life > 0 && input.opponentLife > 0);
    requireCheck(checks, 'You have priority', input.priority);
    if (input.stackEmpty === false) throw new Rejection('Unknown', 'Nonempty-stack priority actions are outside this action-boundary subset.');
    requireCheck(checks, 'The current action boundary has an empty stack', input.stackEmpty);
    if (active(input).some(o => o.controller === 'opponent' && o.card.abilities.some(a => a.kind !== 'static')))
      throw new Rejection('Unknown', 'Opponent-controlled ability effects/ordering are outside this one-player action subset.');
    if (active(input).some(o => o.card.types.includes('Creature') && (o.card.toughness === null || o.card.toughness + (o.counters['+1/+1'] || 0) - (o.counters['-1/-1'] || 0) <= 0)))
      throw new Rejection('Unknown', 'Initial creature state requires unsupported toughness/state-based-action handling.');
    if (active(input).some(o => o.card.legendary && active(input).some(other => other.instance !== o.instance && other.controller === o.controller && other.card.legendary && other.card.oracleId === o.card.oracleId)))
      throw new Rejection('Unknown', 'Initial legend-rule choice is unresolved.');
    let a: Ability, cost: string;
    if (action.kind === 'cast') {
      const permission = source.card.abilities.find(a => a.permission === (action.flashback ? 'flashback' : 'discarded-this-turn'));
      requireCheck(checks, 'Only one graveyard casting permission is selected', !(action.mayhem && action.flashback));
      if (action.flashback) {
        requireCheck(checks, 'Flashback permission exists and source is in your graveyard', !!permission && source.zone === 'graveyard' && source.owner === 'you');
        requireCheck(checks, 'No active effect prohibits graveyard casting', !statics(input, 'graveyard-cast-prohibition').length);
      } else if (action.mayhem) {
        requireCheck(checks, 'A Mayhem permission is present', !!permission);
        requireCheck(checks, 'This object remains in the graveyard after being discarded this turn', source.zone === 'graveyard' && source.owner === 'you' && source.discardedTurn === input.turn);
        requireCheck(checks, 'No active effect prohibits graveyard casting', !statics(input, 'graveyard-cast-prohibition').length);
      } else requireCheck(checks, 'A normally cast card is in hand', source.zone === 'hand' && source.owner === 'you');
      if (!source.card.types.includes('Instant') && !source.card.keywords.includes('Flash')) requireCheck(checks, 'Normal casting timing: your main phase', input.mainPhase);
      requireCheck(checks, 'Lands are not cast as spells', !source.card.types.includes('Land'));
      a = { id: `${source.card.key}:cast`, kind: 'spell', effects: source.card.abilities.filter(a => a.kind === 'spell').flatMap(a => a.effects), evidence: { id: `${source.card.oracleId}:cast`, oracleId: source.card.oracleId, line: -1, text: source.card.manaCost, rule: 'subset:normal-or-permitted-cast' } };
      if (!action.mayhem && !action.flashback) requireCheck(checks, 'An ordinary cast has a payable printed mana cost', !!source.card.manaCost);
      a.cost = source.card.castCost;
      if (a.cost?.sacrifice) { const target = input.objects.find(o => o.instance === action.sacrifice); requireCheck(checks, 'Additional casting sacrifice cost has an eligible controlled permanent', !!target && matches(target, a.cost.sacrifice, source)); }
      a.effectEvidence = source.card.abilities.filter(a => a.kind === 'spell').flatMap(a => a.effects.map(() => a.evidence));
      cost = action.mayhem || action.flashback ? permission!.cost!.mana : source.card.manaCost;
    } else {
      requireCheck(checks, 'An activated source is on the battlefield', source.zone === 'battlefield');
      const grant = statics(input, 'counter-mana').find(x => x.object.controller === source.controller);
      const found = action.ability === 'granted-counter-mana' && grant && source.card.types.includes('Creature') && counterCount(source)
        ? { ...grant.ability, id: 'granted-counter-mana', kind: 'activated' as const, effects: [{ kind: 'mana' as const, symbols: ['G'] }], cost: { mana: '', tap: true } }
        : source.card.abilities.find(a => a.kind === 'activated' && a.id === action.ability);
      requireCheck(checks, 'The specified activated ability exists', !!found); a = found!; cost = a.cost?.mana || '';
      if (a.cost?.tap) {
        requireCheck(checks, 'Tap cost: source is untapped', !source.tapped);
        requireCheck(checks, 'Creature tap ability: source is ready or has haste', !source.card.types.includes('Creature') || source.ready || source.card.keywords.includes('Haste'));
      }
      if (a.cost?.sacrifice) {
        const target = input.objects.find(o => o.instance === action.sacrifice);
        requireCheck(checks, 'Sacrifice cost has an eligible controlled permanent', !!target && matches(target, a.cost.sacrifice, source));
      }
      if (a.cost?.life) requireCheck(checks, 'Life payment can be paid in full', input.life >= a.cost.life);
      if (a.cost?.removeCounter) {
        const target = input.objects.find(o => o.instance === action.counterSource);
        requireCheck(checks, 'Counter-removal cost has a compatible recipient with a counter', !!target && matches(target, a.cost.removeCounter, source) && (target.counters['+1/+1'] || 0) > 0);
      }
    }
    // Targets are chosen at announcement, before any resource is consumed.
    const initial: World = { state: clone(input), bindings: {}, pending: [], copies: [], checks, steps: 0, complete: true };
    const announced = bindAbility([initial], a, source, limits, action.targets);
    const influence = input.objects.find(o => unknownInfluence(o, source));
    if (influence) throw new Rejection('Unknown', `Unsupported potentially relevant ability on ${influence.card.name}: ${influence.card.unsupported.join(' | ')}`);
    if (input.mana && Object.values(input.mana).reduce((a, b) => a + b, 0) > 256) throw new Rejection('Unknown', 'Mana allocation exceeds the bounded pool limit of 256.');
    if (input.mana === null) throw new Rejection('Conditional', `Provide a mana payment for ${cost || 'this action'}.`);
    requireCheck(checks, 'Mana provenance lots are nonnegative integers with resolvable event identities', input.manaLots.every(l => Number.isSafeInteger(l.remaining) && l.remaining >= 0 && (!l.event || input.events.some(e => e.id === l.event))));
    if (COLORS.some(c => input.manaLots.filter(l => l.color === c).reduce((n, l) => n + l.remaining, 0) !== input.mana![c])) throw new Rejection('Unknown', 'Mana pool and resource ledger disagree.');
    const payments = manaPayments(input.mana, cost, limits.branches);
    requireCheck(checks, `Pay actual colored/generic mana cost ${cost || '(none)'}`, payments.length > 0);
    const done: World[] = [];
    for (const bound of announced) for (const payment of payments.slice(0, limits.branches)) {
      const s = clone(bound.state), o = s.objects.find(o => o.instance === source.instance)!;
      s.mana = payment.pool;
      const funding: Event[] = [];
      for (const color of COLORS) {
        let needed = payment.spent[color];
        for (const lot of s.manaLots.filter(l => l.color === color)) {
          const use = Math.min(needed, lot.remaining); needed -= use; lot.remaining -= use;
          if (use && lot.event) funding.push(s.events.find(e => e.id === lot.event)!);
        }
      }
      for (const c of COLORS) s.spent.mana[c] += payment.spent[c];
      const w: World = { state: s, bindings: { ...bound.bindings }, pending: [], copies: [], checks: [...checks, ...bound.checks.filter(c => !checks.includes(c))], steps: 0, complete: bound.complete && payments.length <= limits.branches };
      if (action.kind === 'activate') {
        let paid: Event | undefined;
        const activationSource = { ...o, counters: { ...o.counters } };
        if (a.cost?.life) { s.life -= a.cost.life; s.payoff.life -= a.cost.life; s.payoff.loss ||= s.life <= 0; }
        if (a.cost?.tap) { o.tapped = true; s.spent.tapped.push(o.instance); }
        if (a.cost?.sacrifice) paid = sacrifice(w, s.objects.find(o => o.instance === action.sacrifice)!, o, a);
        if (a.cost?.removeCounter) {
          const donor = s.objects.find(o => o.instance === action.counterSource)!; donor.counters['+1/+1']--;
          s.spent.counters.push({ instance: donor.instance, count: 1 });
          paid = emit(w, 'remove-counter', donor, 1, o, a, paid, 'Removed a +1/+1 counter as a paid cost; recompute power.');
        }
        const activated = emit(w, 'activate', activationSource, 1, activationSource, a, paid, 'Activated the specified ability after checking and paying actual costs.');
        for (const event of funding) { activated.parents = [...new Set([...activated.parents, event.id])]; activated.participants = [...new Set([...activated.participants, ...event.participants])].sort(); activated.evidence = [...new Map([...activated.evidence, ...event.evidence].map(e => [e.id, e])).values()]; }
        w.resolvingSource = activationSource;
        const manaAbility = a.effects.some(e => e.kind === 'mana' || e.kind === 'counted-mana') && !a.effects.some(e => targetSpec(e));
        if (s.payoff.loss && !manaAbility) { done.push(w); continue; }
        const beforeAbility = manaAbility ? [w] : settle([w], limits);
        done.push(...settle(effects(beforeAbility, a.effects, o.instance, a, activated, limits), limits));
      } else {
        const paid = a.cost?.sacrifice ? sacrifice(w, s.objects.find(o => o.instance === action.sacrifice)!, o, a) : undefined;
        const access = [...s.events].reverse().find(e => ['move', 'discard'].includes(e.kind) && e.subject === o.instance && e.incarnation === o.incarnation);
        move(o, 'stack');
        const cast = emit(w, 'cast', o, 1, o, a, paid || access, 'A real cast event; normal timing and costs checked.');
        for (const event of [...funding, ...(paid && access ? [access] : [])]) {
          cast.parents = [...new Set([...cast.parents, event.id])]; cast.participants = [...new Set([...cast.participants, ...event.participants])].sort();
          cast.evidence = [...new Map([...cast.evidence, ...event.evidence].map(e => [e.id, e])).values()];
        }
        const beforeOriginal = settle([w], limits);
        for (const world of beforeOriginal) {
          const spell = world.state.objects.find(x => x.instance === o.instance)!;
          if (permanent(spell.card)) { done.push(...settle(enterSpell(world, spell, a, cast, limits), limits)); }
          else {
            let list = a.effects, resolutionParent = cast;
            if (list.some(e => e.kind === 'discard-choice-draw')) {
              const target = world.state.objects.find(x => x.instance === (action.discard || action.sacrifice));
              if (action.discard) {
                requireCheck(world.checks, 'Chosen discard is another card in your hand', !!target && target.zone === 'hand' && target.controller === 'you');
                move(target!, 'graveyard'); target!.discardedTurn = s.turn; world.state.spent.discarded.push(target!.instance);
                resolutionParent = emit(world, 'discard', target!, 1, spell, a, cast, 'This specific card was discarded from hand this turn.');
              } else if (action.sacrifice) {
                requireCheck(world.checks, 'Chosen sacrifice is an artifact you control', !!target && target.zone === 'battlefield' && target.card.types.includes('Artifact') && target.controller === 'you');
                move(target!, 'graveyard'); world.state.spent.sacrificed.push(target!.instance);
                resolutionParent = emit(world, 'move', target!, 1, spell, a, cast, 'Sacrificed, not discarded.');
              }
              list = target ? [{ kind: 'draw', count: 2 }] : [];
            }
            const resolved = effects([world], list, spell.instance, a, resolutionParent, limits);
            for (const next of resolved) move(next.state.objects.find(x => x.instance === spell.instance)!, action.flashback ? 'exile' : 'graveyard');
            done.push(...settle(resolved, limits));
          }
        }
      }
    }
    return done.map(w => {
      const events = w.state.events.slice(start);
      if (w.checks.some(c => c.role === 'required' && c.result !== true)) throw new Rejection('Unknown', 'An unresolved mandatory predicate prevents certification.');
      return { status: 'Verified', executable: 'now', action, checks: w.checks, prerequisites: [], participants: [...new Set(events.flatMap(e => e.participants))].sort(), evidence: [...new Map([a.evidence, ...events.flatMap(e => e.evidence)].map(e => [e.id, e])).values()], assumptions: input.assumptions, events, dependencies, terminal: w.state, complete: true, boundTargets: w.bindings, searchTruncated: !w.complete };
    });
  } catch (error) {
    if (!(error instanceof Rejection)) throw error;
    return [base(error.status, error.message)];
  }
}
/** Claims are about a completed action/sequence, not every possible future turn. */
export function verifyClaim(proof: Proof, claim: { kind: Event['kind']; subject?: string; minimum: number; noteIncludes?: string }): { status: Status; count: number; explanation: string } {
  if (proof.status !== 'Verified') return { status: proof.status, count: 0, explanation: proof.prerequisites.join(' ') };
  const count = proof.events.filter(e => e.kind === claim.kind && (!claim.subject || e.subject === claim.subject) && (!claim.noteIncludes || e.note.includes(claim.noteIncludes))).reduce((n, e) => n + e.count, 0);
  return { status: count >= claim.minimum ? 'Verified' : 'Invalid', count, explanation: count >= claim.minimum ? 'Claim witnessed in this completed scoped sequence.' : 'The required event/payoff did not occur in this completed sequence; this is not a claim of global impossibility.' };
}
function stateKey(s: State): string {
  return fingerprint({ objects: s.objects.map(o => [o.instance, o.incarnation, o.card.key, o.baseCard?.key, o.zone, o.owner, o.controller, o.token, o.ceased, o.restrictions, o.counters, o.tapped, o.ready, o.discardedTurn]), turn: s.turn, mainPhase: s.mainPhase, priority: s.priority, stackEmpty: s.stackEmpty, mana: s.mana, entry: s.entryCounters, payoff: s.payoff, life: s.life, opponent: s.opponentLife, library: s.library, hand: s.unknownHand });
}
export function discover(input: State, supplied: Partial<Limits> = {}): Discovery {
  const limits = { ...DEFAULT_LIMITS, ...supplied }, proofs: Proof[] = [], paths: Discovery['paths'] = [];
  const queue: { state: State; actions: Action[]; checks: Check[] }[] = [{ state: input, actions: [], checks: [] }];
  const seen = new Set<string>([stateKey(input)]), signatures = new Set<string>();
  const rejections: Discovery['rejections'] = [], rejected = new Set<string>();
  let explored = 0, truncated = false;
  while (queue.length && explored < limits.states) {
    const item = queue.shift()!;
    if (item.actions.length >= limits.depth || item.state.payoff.loss || item.state.opponentLife <= 0) continue;
    for (const action of actions(item.state)) {
      if (explored >= limits.states) { truncated = true; break; }
      explored++;
      for (const proof of execute(item.state, action, limits)) {
        if ((!proof.complete || proof.searchTruncated) && proof.status === 'Verified') truncated = true;
        if (proof.status !== 'Verified' || !proof.terminal) {
          const key = fingerprint([action, proof.status, proof.prerequisites]);
          if (!rejected.has(key) && rejections.length < limits.proofs) { rejected.add(key); rejections.push({ action, status: proof.status, prerequisites: proof.prerequisites }); }
          continue;
        }
        const allEvents = proof.terminal.events.slice(input.events.length);
        const combined: Proof = { ...proof, checks: [...item.checks, ...proof.checks], events: allEvents, participants: [...new Set(allEvents.flatMap(e => e.participants))].sort(), evidence: [...new Map(allEvents.flatMap(e => e.evidence).map(e => [e.id, e])).values()] };
        // Discover actual causal chains, not keywords or a count of unrelated actions.
        const chained = allEvents.filter(e => ['cast', 'draw', 'counter', 'damage', 'move', 'copy', 'gain-life'].includes(e.kind) && e.parents.length && e.participants.length >= 2);
        for (const event of chained) {
          const signature = fingerprint([event.kind, event.subject, event.ability, event.participants, event.note]);
          if (!signatures.has(signature) && proofs.length < limits.proofs) {
            signatures.add(signature); proofs.push(combined); paths.push({ actions: [...item.actions, action], proof: combined });
          }
        }
        const key = stateKey(proof.terminal);
        if (!seen.has(key)) { seen.add(key); queue.push({ state: proof.terminal, actions: [...item.actions, action], checks: combined.checks }); }
      }
    }
  }
  if (queue.length) truncated = true;
  const cards = [...new Map(input.objects.map(o => [o.card.key, o.card])).values()];
  return { proofs, paths, explored, truncated, rejections, reasons: truncated ? ['Bounded search or branch budget reached; no completeness or infinite-loop claim.'] : [],
    coverage: { abilities: cards.reduce((n, c) => n + c.abilities.length, 0), unsupported: cards.filter(c => c.unsupported.length).map(c => ({ name: c.name, lines: c.unsupported })), deferred: cards.filter(c => c.deferred.length).map(c => ({ name: c.name, lines: c.deferred })) } };
}
/** Conservative reference invalidation: a changed input is always rebuilt from scratch. */
export class EvaluationCache {
  private results = new Map<string, Discovery>();
  evaluate(state: State, limits: Partial<Limits> = {}) {
    const key = fingerprint([VERSION, state, limits]);
    const cached = this.results.get(key);
    if (cached) return { result: structuredClone(cached), reused: true };
    const result = discover(state, limits);
    this.results.set(key, result); if (this.results.size > 8) this.results.delete(this.results.keys().next().value!);
    return { result: structuredClone(result), reused: false };
  }
}
/** Terminal holdings, not a sum of intermediate draw/mana/recursion event rewards. */
export function holdingsDelta(before: State, after: State) {
  const controlled = (s: State, zone: Zone) => s.objects.filter(o => o.controller === 'you' && o.zone === zone);
  return {
    hand: controlled(after, 'hand').length + after.unknownHand - controlled(before, 'hand').length - before.unknownHand,
    creatures: controlled(after, 'battlefield').filter(o => o.card.types.includes('Creature')).length - controlled(before, 'battlefield').filter(o => o.card.types.includes('Creature')).length,
    tokens: controlled(after, 'battlefield').filter(o => o.token).length - controlled(before, 'battlefield').filter(o => o.token).length,
    counters: controlled(after, 'battlefield').reduce((n, o) => n + (o.counters['+1/+1'] || 0), 0) - controlled(before, 'battlefield').reduce((n, o) => n + (o.counters['+1/+1'] || 0), 0),
    life: after.life - before.life, damage: before.opponentLife - after.opponentLife,
    mana: before.mana && after.mana ? Object.fromEntries(COLORS.map(c => [c, after.mana![c] - before.mana![c]])) : null,
    objective: { opponentLifeReachedZero: after.opponentLife <= 0, ownGameLost: after.payoff.loss },
  };
}

/** Replays a submitted certificate from original inputs; altered traces are not trusted. */
export function replay(initial: State, path: Action[], submitted: Proof, limits: Partial<Limits> = {}): boolean {
  if (submitted.status !== 'Verified' || !submitted.terminal || !path.length || fingerprint(path.at(-1)) !== fingerprint(submitted.action)) return false;
  let candidates: { state: State; checks: Check[] }[] = [{ state: initial, checks: [] }];
  for (const action of path) candidates = candidates.flatMap(c => execute(c.state, action, limits).flatMap(p => p.status === 'Verified' && p.terminal ? [{ state: p.terminal, checks: [...c.checks, ...p.checks] }] : []));
  return candidates.some(c => fingerprint(c.state) === fingerprint(submitted.terminal) && fingerprint(c.checks) === fingerprint(submitted.checks) && fingerprint(c.state.events.slice(initial.events.length)) === fingerprint(submitted.events));
}
