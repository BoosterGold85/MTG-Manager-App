import {productionBoundaryBytes} from './productionBoundary';
// Browser-compatible fork: same mechanical regressions; frozen research files remain unchanged.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { compile } from '../../src/experimental/universal/compiler';
import { actions, discover, EvaluationCache, execute, flying, holdingsDelta, power, replay, scenario, verifyClaim } from '../../src/experimental/universal/engine';
import { card, cards, carnage, follow, jackal, mana, novel, rishkar, tails } from '../fixtures/browserUniversal';
import type { Action, State } from '../../src/experimental/universal/model';
const cast = (instance: string): Action => ({ kind: 'cast', instance });
const first = (state: State, action: Action) => execute(state, action).find(p => p.status === 'Verified')!;
const activation = (state: State, id: string, effect: string, counterSource?: string): Action => ({ kind: 'activate', instance: id, ability: state.objects.find(o => o.instance === id)!.card.abilities.find(a => a.effects.some(e => e.kind === effect))!.id, counterSource });

describe('Oracle compilation and conservative boundaries', () => {
  it('compiles actual Oracle abilities into shared typed costs, selectors, triggers and effects', () => {
    const witness = compile(card('Evolution Witness'));
    expect(witness.unsupported).toEqual([]);
    expect(witness.abilities.find(a => a.trigger)?.trigger?.subject.self).toBe(true);
    expect(witness.abilities.find(a => a.kind === 'activated')?.cost?.mana).toBe('{1}{G}');
    expect(compile(card('Jackal, Genius Geneticist')).unsupported).toEqual([]);
    expect(compile(card('Carnage, Crimson Chaos')).abilities.find(a => a.permission)?.cost?.mana).toBe('{B}{R}');
  });
  it('does not promote partially parsed relevant abilities into proof', () => {
    const s = scenario([{ card: card('Master Biomancer'), zone: 'battlefield' }, { card: card('Divination'), zone: 'hand', id: 'draw' }], { mana: mana({ U: 1, C: 2 }) });
    expect(execute(s, cast('draw'))[0].status).toBe('Unknown');
  });
  it('preserves missing information as Conditional and semantic limits as Unknown', () => {
    const s = tails(); s.mana = null; s.manaLots = [];
    expect(execute(s, cast('vehicle'))[0].status).toBe('Conditional');
    const pending = tails(); pending.stackEmpty = false;
    expect(execute(pending, cast('vehicle'))[0].status).toBe('Unknown');
  });
  it('rejects unsupported mana symbols without interpreting them as generic mana', () => {
    const base = card('Divination');
    const s = scenario([{ card: { ...base, manaCost: '{X}{U}' }, zone: 'hand', id: 'x' }], { mana: mana({ U: 1, C: 5 }) });
    expect(execute(s, cast('x'))[0].status).toBe('Unknown');
  });
});

describe('Tails static grant, entry event and resolution-time payoff', () => {
  it('discovers the uncrewed three-card dependency', () => {
    const s = tails(), p = first(s, cast('vehicle'));
    expect(p.status).toBe('Verified'); expect(p.terminal!.payoff.draw).toBe(1);
    expect(p.participants).toEqual(['admiral', 'tails', 'vehicle']);
    expect(p.events.find(e => e.kind === 'draw')!.participants).toEqual(['admiral', 'tails', 'vehicle']);
    expect(s.objects.find(o => o.instance === 'vehicle')!.card.types).not.toContain('Creature');
    expect(discover(s, { depth: 1 }).proofs.some(p => p.events.some(e => e.kind === 'draw'))).toBe(true);
  });
  it('without the grant creates a flying counter but does not draw', () => {
    const p = first(tails(false), cast('vehicle'));
    expect(p.terminal!.payoff.draw).toBe(0);
    expect(p.terminal!.objects.find(o => o.instance === 'vehicle')!.counters.flying).toBe(1);
    expect(verifyClaim(p, { kind: 'draw', minimum: 1 }).status).toBe('Invalid');
  });
  it('recomputes a static grant from the state at the check, rather than cached printed keywords', () => {
    const s = tails(); const vehicle = s.objects.find(o => o.instance === 'vehicle')!; vehicle.zone = 'battlefield';
    expect(flying(s, vehicle).value).toBe(true);
    s.objects.find(o => o.instance === 'admiral')!.zone = 'graveyard';
    expect(flying(s, vehicle).value).toBe(false);
  });
});

describe('Jackal, self-recipient recursion, paid power manipulation and recasting', () => {
  it('proves Adapt places two counters in one event and creates one recovery, not two', () => {
    const s = jackal(), p = first(s, activation(s, 'witness', 'adapt'));
    expect(p.terminal!.payoff.recoveredToHand).toBe(1);
    expect(p.events.filter(e => e.kind === 'counter')).toHaveLength(1);
    expect(p.events.find(e => e.kind === 'counter')!.count).toBe(2);
    expect(p.events.some(e => e.kind === 'cast')).toBe(false);
  });
  it('does not confuse Jackal putting counters on itself with Witness receiving counters', () => {
    const s = jackal();
    s.objects.find(o => o.instance === 'one-drop')!.zone = 'hand';
    s.objects.find(o => o.instance === 'jackal')!.counters['+1/+1'] = 0;
    const p = first(s, cast('one-drop'));
    expect(p.events.filter(e => e.kind === 'copy')).toHaveLength(1);
    expect(p.events.filter(e => e.kind === 'counter').every(e => e.subject === 'jackal')).toBe(true);
    expect(p.terminal!.payoff.recoveredToHand).toBe(0);
  });
  it('requires mana value to equal actual power at cast', () => {
    const s = jackal(); s.objects.find(o => o.instance === 'one-drop')!.zone = 'hand';
    const p = first(s, cast('one-drop'));
    expect(power(s.objects.find(o => o.instance === 'jackal')!)).toBe(2);
    expect(verifyClaim(p, { kind: 'copy', minimum: 1 }).status).toBe('Invalid');
  });
  it('counter removal restores access to the one-drop mana value, with actual costs and no fake cast from recursion', () => {
    const s = jackal();
    const paths = follow(s, [activation(s, 'witness', 'adapt'), activation(s, 'power-control', 'draw', 'jackal'), cast('one-drop')]);
    expect(paths.length).toBeGreaterThan(0);
    const after = paths.find(p => p.events.some(e => e.kind === 'copy'))!;
    expect(after.events.filter(e => e.kind === 'cast')).toHaveLength(1);
    expect(after.events.filter(e => e.kind === 'copy')).toHaveLength(1);
    expect(after.objects.filter(o => o.zone === 'battlefield' && o.card.name === 'Llanowar Elves')).toHaveLength(2);
    expect(after.spent.counters).toEqual([{ instance: 'jackal', count: 1 }]);
    expect(after.spent.mana.U).toBe(1);
    const copy = after.events.find(e => e.kind === 'copy')!;
    expect(copy.participants).toContain('power-control');
    expect(after.events.findIndex(e => e.kind === 'counter' && e.subject === 'jackal')).toBeLessThan(after.events.findIndex(e => e.kind === 'enter' && e.subject.startsWith('copy-')));
  });
  it('independently searches the multi-action recovery/retuning/copy chain', () => {
    const result = discover(jackal(), { depth: 3, states: 1500, proofs: 100 });
    expect(result.paths.some(p => p.proof.events.some(e => e.kind === 'move' && e.subject === 'one-drop') && p.proof.events.some(e => e.kind === 'copy') && p.actions.some(a => a.counterSource === 'jackal'))).toBe(true);
  });
  it('Adapt with existing counters is legal but does not place more counters or retrigger recovery', () => {
    const s = jackal(); s.objects.find(o => o.instance === 'witness')!.counters['+1/+1'] = 1;
    const p = first(s, activation(s, 'witness', 'adapt'));
    expect(p.terminal!.payoff.recoveredToHand).toBe(0); expect(p.events.filter(e => e.kind !== 'activate')).toHaveLength(0);
  });
  it('does not recover a permanent from an opponent graveyard by treating it as yours', () => {
    const s = jackal(); s.objects.find(o => o.instance === 'one-drop')!.owner = 'opponent';
    const p = first(s, activation(s, 'witness', 'adapt'));
    expect(p.terminal!.payoff.recoveredToHand).toBe(0);
  });
});

describe('Carnage history, choices, timing, targets and prohibitions', () => {
  it('uses actual discard history and pays both spell and Mayhem costs', () => {
    const s = carnage(); const discarded = first(s, { ...cast('discard-spell'), discard: 'carnage' }).terminal!;
    const p = first(discarded, { ...cast('carnage'), mayhem: true });
    expect(p.status).toBe('Verified'); expect(p.terminal!.objects.find(o => o.instance === 'carnage')!.zone).toBe('battlefield');
    expect(p.terminal!.spent.discarded).toEqual(['carnage']);
    expect(p.terminal!.spent.mana.R).toBeGreaterThanOrEqual(2); expect(p.terminal!.spent.mana.B).toBeGreaterThanOrEqual(1);
  });
  it('surveilling Carnage does not grant Mayhem', () => {
    const states = execute(carnage('library'), cast('surveil-spell')).flatMap(p => p.terminal ? [p.terminal] : []);
    const milled = states.find(s => s.objects.find(o => o.instance === 'carnage')!.zone === 'graveyard')!;
    expect(milled).toBeDefined(); expect(execute(milled, { ...cast('carnage'), mayhem: true })[0].status).toBe('Invalid');
  });
  it('rejects wrong-turn discard and ordinary creature casting outside the main phase', () => {
    const s = first(carnage(), { ...cast('discard-spell'), discard: 'carnage' }).terminal!;
    s.turn++; expect(execute(s, { ...cast('carnage'), mayhem: true })[0].status).toBe('Invalid');
    s.turn--; s.mainPhase = false; expect(execute(s, { ...cast('carnage'), mayhem: true })[0].status).toBe('Invalid');
  });
  it('an active casting prohibition overrides a permission', () => {
    const s = first(carnage(), { ...cast('discard-spell'), discard: 'carnage' }).terminal!;
    s.objects.push(scenario([{ card: card("Grafdigger's Cage"), zone: 'battlefield', id: 'cage' }]).objects[0]);
    expect(execute(s, { ...cast('carnage'), mayhem: true })[0].status).toBe('Invalid');
  });
  it('recursion excludes creatures above the printed mana-value limit and retains granted restrictions', () => {
    const s = scenario([{ card: card('Carnage, Crimson Chaos'), zone: 'hand', id: 'c' }, { card: card('Llanowar Elves'), zone: 'graveyard', id: 'small' }, { card: card('Master Biomancer'), zone: 'graveyard', id: 'large' }], { mana: mana({ B: 1, R: 1, C: 2 }) });
    const results = execute(s, cast('c')).filter(p => p.status === 'Verified');
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) { expect(p.terminal!.objects.find(o => o.instance === 'large')!.zone).toBe('graveyard'); expect(p.terminal!.objects.find(o => o.instance === 'small')!.restrictions.join(' ')).toContain('sacrifice'); }
  });
  it('a prohibited recursion effect does not make the surrounding normally cast spell illegal', () => {
    const s = scenario([{ card: card('Carnage, Crimson Chaos'), zone: 'hand', id: 'c' }, { card: card('Llanowar Elves'), zone: 'graveyard', id: 'small' }, { card: card("Grafdigger's Cage"), zone: 'battlefield', id: 'cage' }], { mana: mana({ B: 1, R: 1, C: 2 }) });
    const p = first(s, cast('c'));
    expect(p.status).toBe('Verified'); expect(p.terminal!.objects.find(o => o.instance === 'c')!.zone).toBe('battlefield');
    expect(p.terminal!.objects.find(o => o.instance === 'small')!.zone).toBe('graveyard');
    expect(verifyClaim(p, { kind: 'enter', subject: 'small', minimum: 1 }).status).toBe('Invalid');
  });
});

describe('independent combinations, accounting and contextual ablations', () => {
  it('discovers a three-card token -> life -> counter chain without a named rule', () => {
    const result = discover(novel(), { depth: 1 });
    const chain = result.proofs.find(p => p.events.some(e => e.kind === 'counter' && e.subject === 'pridemate'))!;
    expect(chain).toBeDefined(); expect(chain.status).toBe('Verified');
    expect(chain.participants).toEqual(expect.arrayContaining(['token-spell', 'warden', 'pridemate']));
    expect(chain.terminal!.payoff.life).toBe(2); expect(chain.terminal!.payoff.counters).toBe(2);
    const order = chain.events.filter(e => ['gain-life', 'counter'].includes(e.kind)).map(e => e.kind);
    expect(order).toEqual(['gain-life', 'counter', 'gain-life', 'counter']);
  });
  it('measures irreducible three-card counter surplus through subset ablations', () => {
    const values = [[], ['warden'], ['pridemate'], ['warden', 'pridemate']].map(support => {
      const before = novel(support), after = first(before, cast('token-spell')).terminal!;
      return holdingsDelta(before, after);
    });
    expect(values.map(v => v.counters)).toEqual([0, 0, 0, 2]);
    expect(values[3].counters - values[1].counters - values[2].counters + values[0].counters).toBe(2);
    expect(values[3].hand).toBe(-1); expect(values[3].creatures).toBe(2);
    expect(values[3].mana).toEqual({ W: -1, U: 0, B: 0, R: 0, G: 0, C: -1 });
  });
  it('generalizes token-entry damage with different Oracle effects', () => {
    const s = scenario([{ card: card('Impact Tremors'), zone: 'battlefield', id: 'payoff' }, { card: card('Dragon Fodder'), zone: 'hand', id: 'tokens' }], { mana: mana({ R: 1, C: 1 }) });
    const p = first(s, cast('tokens')); expect(p.terminal!.payoff.opponentDamage).toBe(2); expect(p.terminal!.payoff.tokens).toBe(2);
  });
  it('reports a terminal win objective only when the modeled opponent actually reaches zero life', () => {
    const s = scenario([{ card: card('Impact Tremors'), zone: 'battlefield', id: 'payoff' }, { card: card('Dragon Fodder'), zone: 'hand', id: 'tokens' }], { mana: mana({ R: 1, C: 1 }), opponentLife: 2 });
    const p = first(s, cast('tokens'));
    expect(holdingsDelta(s, p.terminal!).objective.opponentLifeReachedZero).toBe(true);
    expect(execute(p.terminal!, cast('tokens'))[0].status).toBe('Invalid');
  });
  it('generates and spends real mana without counting spent mana as retained payoff', () => {
    const s = scenario([{ card: card('Sol Ring'), zone: 'battlefield', id: 'ring' }, { card: card('Raise the Alarm'), zone: 'hand', id: 'tokens' }], { mana: mana({ W: 1 }) });
    const generated = first(s, activation(s, 'ring', 'mana')).terminal!;
    const p = first(generated, cast('tokens'));
    expect(p.events.find(e => e.kind === 'cast')!.participants).toContain('ring');
    expect(holdingsDelta(s, p.terminal!).mana!.C).toBe(1);
    expect(execute(generated, activation(s, 'ring', 'mana'))[0].status).toBe('Invalid');
  });
  it('cannot spend one mana pool twice or tap a summoning-sick creature', () => {
    const base = card('Raise the Alarm');
    const s = scenario([{ card: base, zone: 'hand', id: 'a' }, { card: base, zone: 'hand', id: 'b' }], { mana: mana({ W: 1, C: 1 }) });
    const after = first(s, cast('a')).terminal!; expect(execute(after, cast('b'))[0].status).toBe('Invalid');
    const elves = scenario([{ card: card('Llanowar Elves'), zone: 'battlefield', id: 'e', ready: false }]);
    expect(execute(elves, activation(elves, 'e', 'mana'))[0].status).toBe('Invalid');
  });
  it('draws each identified library card only once and does not duplicate access', () => {
    const placements = [
      ...['a', 'b'].map(id => ({ card: card('Divination'), zone: 'hand' as const, id })),
      ...['first', 'second', 'third', 'fourth'].map(id => ({ card: card('Llanowar Elves'), zone: 'library' as const, id })),
    ];
    const s = scenario(placements, { mana: mana({ U: 2, C: 4 }), library: 4 });
    const after = follow(s, [cast('a'), cast('b')])[0];
    expect(after.objects.filter(o => o.zone === 'hand')).toHaveLength(4);
    expect(after.objects.filter(o => o.zone === 'library')).toHaveLength(0);
    expect(after.unknownHand).toBe(0); expect(after.payoff.draw).toBe(4);
  });
  it('a counter replacement amplifies a real event but cannot bootstrap one', () => {
    const s = jackal(); s.objects.push(scenario([{ card: card('Hardened Scales'), zone: 'battlefield', id: 'scales' }]).objects[0]);
    const p = first(s, activation(s, 'witness', 'adapt'));
    expect(p.events.find(e => e.kind === 'counter')!.count).toBe(3); expect(p.terminal!.payoff.recoveredToHand).toBe(1);
    expect(actions(s).some(a => a.instance === 'scales')).toBe(false);
  });
  it('renaming every card preserves discovered mechanical outcomes', () => {
    const original = novel(); const renamed = structuredClone(original);
    for (const [i, o] of renamed.objects.entries()) o.card.name = `Unfamiliar card ${i}`;
    expect(discover(renamed, { depth: 1 }).proofs.map(p => p.terminal!.payoff)).toEqual(discover(original, { depth: 1 }).proofs.map(p => p.terminal!.payoff));
  });
  it('compiler recognizes renamed Oracle self-references, not just renamed compiled objects', () => {
    const c = card('Jackal, Genius Geneticist');
    const renamed = { ...c, name: 'Independent Subject', oracleText: c.oracleText!.replaceAll('Jackal', 'Independent Subject') };
    expect(compile(renamed).unsupported).toEqual([]);
    expect(compile(renamed).abilities[0].trigger?.matchingPower).toBe(true);
  });
  it('rejects altered proof traces when replayed from the original scenario', () => {
    const initial = novel(), path = discover(initial, { depth: 1 }).paths.find(p => p.proof.events.some(e => e.subject === 'pridemate' && e.kind === 'counter'))!;
    expect(replay(initial, path.actions, path.proof)).toBe(true);
    const altered = structuredClone(path.proof); altered.events.find(e => e.kind === 'counter')!.count = 99;
    expect(replay(initial, path.actions, altered)).toBe(false);
  });
  it('refreshes semantics when an existing metadata object changes', () => {
    const c = { ...card('Aeronaut Admiral') };
    expect(compile(c).abilities.some(a => a.static === 'vehicle-flying')).toBe(true);
    c.oracleText = 'Flying';
    expect(compile(c).abilities).toHaveLength(0);
  });
  it('does not certify an automatic chain after its processing budget is exhausted', () => {
    const result = execute(novel(), cast('token-spell'), { automaticSteps: 2 });
    expect(result.every(p => p.status === 'Unknown')).toBe(true);
    expect(result.every(p => !p.terminal)).toBe(true);
  });
});

describe('dependency invalidation and isolation', () => {
  it('removing the only external enabler removes downstream recovery proofs', () => {
    const before = discover(rishkar(), { depth: 1 }); const after = discover(rishkar(false), { depth: 1 });
    expect(before.proofs.some(p => p.events.some(e => e.kind === 'move' && e.subject === 'target'))).toBe(true);
    expect(after.proofs.some(p => p.events.some(e => e.kind === 'move' && e.subject === 'target'))).toBe(false);
  });
  it('cache invalidation matches a fresh whole-deck calculation, including additions and same-ID semantic changes', () => {
    const cache = new EvaluationCache(); const before = tails();
    expect(cache.evaluate(before, { depth: 1 }).reused).toBe(false);
    expect(cache.evaluate(before, { depth: 1 }).reused).toBe(true);
    const after = tails(false);
    expect(cache.evaluate(after, { depth: 1 }).result).toEqual(discover(after, { depth: 1 }));
    const changed = tails(); changed.objects[1].card = { ...changed.objects[1].card, abilities: [] };
    expect(cache.evaluate(changed, { depth: 1 }).result).toEqual(discover(changed, { depth: 1 }));
  });
  it('does not erase counters already placed when an enabler subsequently leaves', () => {
    const s = rishkar(); const p = execute(s, cast('rishkar')).find(p => p.terminal?.objects.find(o => o.instance === 'witness')!.counters['+1/+1'] === 2)!;
    const after = p.terminal!; after.objects.find(o => o.instance === 'rishkar')!.zone = 'graveyard';
    expect(after.objects.find(o => o.instance === 'witness')!.counters['+1/+1']).toBe(2);
  });
  it('retains real Witness self-setup when it has no counters, even without Rishkar', () => {
    const s = rishkar(false); s.objects.find(o => o.instance === 'witness')!.counters['+1/+1'] = 0;
    expect(first(s, activation(s, 'witness', 'adapt')).terminal!.payoff.recoveredToHand).toBe(1);
  });
  it('explicitly reports limits, preserves inputs and structured-clones reports', () => {
    const s = jackal(), original = JSON.stringify(s);
    const result = discover(s, { states: 1, depth: 3 });
    expect(result.truncated).toBe(true); expect(JSON.stringify(s)).toBe(original);
    expect(structuredClone(result)).toEqual(result);
  });
  it('preserves existing source, scoring, collection and frozen-test files byte for byte', () => {
    const hashes: Record<string, string> = JSON.parse(readFileSync(new URL('../../research/universal/data/protected-sha256.json', import.meta.url), 'utf8'));
    for (const [path, hash] of Object.entries(hashes)) expect(createHash('sha256').update(productionBoundaryBytes(path)).digest('hex'), path).toBe(hash);
  });
  it('keeps all corpus card names out of compiler and verifier implementation', () => {
    for (const filename of ['model.ts', 'compiler.ts', 'engine.ts']) {
      const text = readFileSync(new URL('../../research/universal-remediated/' + filename, import.meta.url), 'utf8');
      for (const c of cards) expect(text.includes(c.name), `${filename}: ${c.name}`).toBe(false);
    }
  });
});
