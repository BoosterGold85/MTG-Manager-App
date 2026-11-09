// Browser-compatible fork: same mechanical regressions; frozen research files remain unchanged.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalizeCard } from '../../src/import/scryfall';
import type { CardMetadata } from '../../src/models/collection';
import { compile } from '../../src/experimental/universal/compiler';
import { actions, discover, execute, holdingsDelta, replay, scenario, targetKey } from '../../src/experimental/universal/engine';
import { emptyMana } from '../../src/experimental/universal/model';
import type { Action, State } from '../../src/experimental/universal/model';
const raw = JSON.parse(readFileSync(new URL('../../research/validation-phase4/data/cards.scryfall.json', import.meta.url), 'utf8')) as Parameters<typeof normalizeCard>[0][];
const cards = raw.map(normalizeCard);
const card = (name: string) => cards.find(c => c.name === name)!;
const mana = { W: 10, U: 10, B: 10, R: 10, G: 10, C: 10 };
const cast: Action = { kind: 'cast', instance: 'root' };
const verified = (s: State, action = cast) => { const p = execute(s, action).find(p => p.status === 'Verified'); expect(p, JSON.stringify(execute(s, action))).toBeDefined(); return p!; };
const modified = (name: string, oracleText: string): CardMetadata => ({ ...card(name), oracleText });
const recur = (name: string, target = card('Grizzly Bears')) => scenario([{ card: card(name), id: 'root', zone: 'hand' }, { card: target, id: 'target', zone: 'graveyard' }], { mana });

describe('mandatory targets and proof safety', () => {
  for (const name of ['Zombify', 'Breath of Life', 'Resurrection', 'Disentomb']) {
    it(`${name} rejects an artifact-only graveyard before paying costs`, () => {
      const s = recur(name, card('Fellwar Stone')), before = JSON.stringify(s), p = execute(s, cast)[0];
      expect(p.status).toBe('Invalid'); expect(p.terminal).toBeUndefined(); expect(JSON.stringify(s)).toBe(before);
      expect(p.checks.some(c => c.role === 'required' && c.result === false)).toBe(true);
    });
    it(`${name} succeeds with a legal creature card`, () => { const p = verified(recur(name)); expect(p.terminal!.objects.find(o => o.instance === 'target')!.zone).toBe(name === 'Disentomb' ? 'hand' : 'battlefield'); });
  }
  it('rejects stale explicit target identities', () => {
    const s = recur('Zombify'), a = { id: `${s.objects[0].card.key}:cast`, effects: s.objects[0].card.abilities.flatMap(a => a.effects) };
    const key = targetKey(a as Parameters<typeof targetKey>[0], a.effects[0]);
    expect(execute(s, { ...cast, targets: { [key]: [{ instance: 'target', incarnation: 9 }] } })[0].status).toBe('Invalid');
  });
  for (const mutation of ['owner', 'zone', 'mana', 'priority', 'timing', 'duplicates', 'negative-mana', 'fractional-counters']) it(`rejects ${mutation} mismatch`, () => {
    const s = recur('Zombify');
    if (mutation === 'owner') s.objects[1].owner = 'opponent';
    if (mutation === 'zone') s.objects[1].zone = 'exile';
    if (mutation === 'mana') { s.mana = emptyMana(); s.manaLots = []; }
    if (mutation === 'priority') s.priority = false;
    if (mutation === 'timing') s.mainPhase = false;
    if (mutation === 'duplicates') s.objects[1].instance = 'root';
    if (mutation === 'negative-mana') s.mana!.B = -1;
    if (mutation === 'fractional-counters') s.objects[1].counters['+1/+1'] = .5;
    expect(execute(s, cast).some(p => p.status === 'Verified')).toBe(false);
  });
  it('never certifies unresolved relevant text, including an entering reanimation target', () => {
    expect(execute(recur('Zombify', modified('Grizzly Bears', 'All spells cost {1} more to cast.')), cast)[0].status).toBe('Unknown');
    expect(execute(recur('Zombify', modified('Grizzly Bears', 'Whenever this creature enters, draw X cards.')), cast)[0].status).toBe('Unknown');
  });
  it('does not treat a mandatory target as an optional up-to target', () => {
    const root = modified('Zombify', 'Put a +1/+1 counter on target creature.');
    expect(execute(scenario([{ card: root, id: 'root', zone: 'hand' }], { mana }), cast)[0].status).toBe('Invalid');
    expect(compile(modified('Zombify', 'Put a +1/+1 counter on each of up to two target creatures.')).abilities[0].effects[0]).toMatchObject({ minimum: 0 });
  });
  it('explains spell effects with the actual Oracle clause rather than only casting cost', () => {
    const p = verified(recur('Zombify'));
    expect(p.events.find(e => e.kind === 'enter')!.evidence.some(e => e.text === card('Zombify').oracleText && e.line === 0)).toBe(true);
    expect(p.checks.filter(c => c.role === 'required').every(c => c.result === true)).toBe(true);
  });
});

describe('general reusable mechanics', () => {
  it('blinks an entry-draw creature as a new object and removes old counters', () => {
    const s = scenario([{ card: card('Cloudshift'), id: 'root', zone: 'hand' }, { card: card('Elvish Visionary'), id: 'body', zone: 'battlefield', counters: { '+1/+1': 4 } }], { mana });
    const p = verified(s), body = p.terminal!.objects.find(o => o.instance === 'body')!;
    expect(body.incarnation).toBe(2); expect(body.counters).toEqual({}); expect(body.ready).toBe(false); expect(p.terminal!.payoff.draw).toBe(1);
    expect(p.events.some(e => e.kind === 'die')).toBe(false); expect(p.events.find(e => e.kind === 'draw')!.participants).toEqual(['body', 'root']);
    expect(discover(s, { depth: 1 }).paths.length).toBeGreaterThan(0); expect(replay(s, [cast], p)).toBe(true);
  });
  it('blinking a token does not return it', () => {
    const s = scenario([{ card: card('Cloudshift'), id: 'root', zone: 'hand' }, { card: card('Grizzly Bears'), id: 'body', zone: 'battlefield' }], { mana });
    s.objects[1].token = true;
    const p = verified(s); expect(p.terminal!.objects[1].zone).toBe('exile'); expect(p.terminal!.objects[1].ceased).toBe(true);
    expect(p.events.some(e => e.kind === 'enter')).toBe(false);
  });
  it('pays a sacrifice once, captures its own death trigger and creates an independent body', () => {
    const s = scenario([{ card: card("Ashnod's Altar"), id: 'altar', zone: 'battlefield' }, { card: card('Doomed Dissenter'), id: 'body', zone: 'battlefield' }]);
    const action = actions(s).find(a => a.sacrifice === 'body')!, p = verified(s, action);
    expect(p.terminal!.spent.sacrificed).toEqual(['body']); expect(p.terminal!.payoff.tokens).toBe(1); expect(p.terminal!.mana!.C).toBe(2);
    expect(p.events.filter(e => e.kind === 'die')).toHaveLength(1); expect(p.events.filter(e => e.kind === 'cast')).toHaveLength(0);
    expect(execute(p.terminal!, action)[0].status).toBe('Invalid'); expect(holdingsDelta(s, p.terminal!).creatures).toBe(0);
  });
  it('cannot sacrifice an opposing object or spend an already-sacrificed object', () => {
    const s = scenario([{ card: card("Ashnod's Altar"), id: 'altar', zone: 'battlefield' }, { card: card('Grizzly Bears'), id: 'body', zone: 'battlefield', controller: 'opponent' }]);
    expect(execute(s, { kind: 'activate', instance: 'altar', ability: s.objects[0].card.abilities[0].id, sacrifice: 'body' })[0].status).toBe('Invalid');
  });
  it('does not invent death when a creature is blinked', () => {
    const p = verified(scenario([{ card: card('Cloudshift'), id: 'root', zone: 'hand' }, { card: card('Doomed Dissenter'), id: 'body', zone: 'battlefield' }], { mana }));
    expect(p.terminal!.payoff.tokens).toBe(0); expect(p.events.some(e => e.kind === 'die')).toBe(false);
  });
  it('supports mana color choices without treating one mana as five', () => {
    const s = scenario([{ card: card('Phyrexian Altar'), id: 'altar', zone: 'battlefield' }, { card: card('Grizzly Bears'), id: 'body', zone: 'battlefield' }]);
    const proofs = execute(s, actions(s)[0]); expect(proofs).toHaveLength(5);
    for (const p of proofs) { expect(p.status).toBe('Verified'); expect(Object.values(p.terminal!.mana!).reduce((a,b) => a+b)).toBe(1); }
  });
  it('supports flashback costs and exile replacement without an extra fake cast', () => {
    const s = scenario([{ card: card('Think Twice'), id: 'root', zone: 'graveyard' }], { mana });
    const p = verified(s, { ...cast, flashback: true }); expect(p.terminal!.payoff.draw).toBe(1); expect(p.terminal!.objects[0].zone).toBe('exile'); expect(p.events.filter(e => e.kind === 'cast')).toHaveLength(1);
    expect(execute(s, cast)[0].status).toBe('Invalid');
  });
  it('checks power filters and intervening-if conditions instead of unconditional keyword matches', () => {
    for (const [name, body, draws] of [['Elemental Bond', 'Grizzly Bears', 0], ['Elemental Bond', 'Nessian Courser', 1]] as const) {
      const s = scenario([{ card: card(name), id: 'observer', zone: 'battlefield' }, { card: card(body), id: 'root', zone: 'hand' }], { mana });
      expect(verified(s).terminal!.payoff.draw).toBe(draws);
    }
    const oracle = 'When this creature enters, if you control a creature with power 4 or greater, draw a card.';
    const s = scenario([{ card: modified('Grizzly Bears', oracle), id: 'root', zone: 'hand' }], { mana });
    expect(verified(s).terminal!.payoff.draw).toBe(0);
  });
  it('copies creature copiable values and entry abilities, but not counters', () => {
    const spell = modified('Zombify', "Create a token that's a copy of target creature you control.");
    const s = scenario([{ card: spell, id: 'root', zone: 'hand' }, { card: card('Elvish Visionary'), id: 'body', zone: 'battlefield', counters: { '+1/+1': 4 } }], { mana });
    const p = verified(s); expect(p.terminal!.payoff.draw).toBe(1); expect(p.terminal!.objects.find(o => o.token)!.counters).toEqual({}); expect(p.events.filter(e => e.kind === 'cast')).toHaveLength(1);
  });
  it('copies spell effects without casting the copy or recursively triggering cast observers', () => {
    const doubler = modified('Grizzly Bears', 'Whenever you cast an instant or sorcery spell, copy that spell. You may choose new targets for the copy.');
    const s = scenario([{ card: doubler, id: 'observer', zone: 'battlefield' }, { card: card('Concentrate'), id: 'root', zone: 'hand' }], { mana });
    const p = verified(s); expect(p.terminal!.payoff.draw).toBe(6); expect(p.events.filter(e => e.kind === 'cast')).toHaveLength(1); expect(p.events.filter(e => e.kind === 'copy')).toHaveLength(1);
  });
  it('keeps stack-targeted ability copies and delayed blink explicitly unsupported', () => {
    expect(compile(modified('Grizzly Bears', 'Copy target activated or triggered ability you control. You may choose new targets for the copy.')).unsupported.length).toBeGreaterThan(0);
    expect(compile(card('Eerie Interlude')).unsupported.length).toBeGreaterThan(0);
  });
});

describe('resource conversion, entry copies and state-dependent payoffs', () => {
  it('casts a copy creature with entry triggers, then restores its printed identity when it leaves', () => {
    const s = scenario([{ card: card('Clone'), id: 'root', zone: 'hand' }, { card: card('Elvish Visionary'), id: 'body', zone: 'battlefield', counters: { '+1/+1': 5 } }], { mana });
    const p = verified(s), copy = p.terminal!.objects.find(o => o.instance === 'root')!;
    expect(copy.card.name).toBe('Elvish Visionary'); expect(copy.baseCard!.name).toBe('Clone'); expect(copy.counters).toEqual({}); expect(p.terminal!.payoff.draw).toBe(1);
    p.terminal!.objects.push(...scenario([{ card: card('Cloudshift'), id: 'blink', zone: 'hand' }]).objects);
    const proof = execute(p.terminal!, { kind: 'cast', instance: 'blink' }).find(p => p.status === 'Verified')!;
    // A blink targeting the other creature is supported; re-entering Clone needs a new replacement choice and abstains.
    expect(proof?.events.some(e => e.kind === 'enter' && e.subject === 'root')).not.toBe(true);
  });
  it('can copy an entry-draw creature card from a graveyard without casting that card', () => {
    const s = scenario([{ card: card('Body Double'), id: 'root', zone: 'hand' }, { card: card('Elvish Visionary'), id: 'body', zone: 'graveyard' }], { mana });
    const p = verified(s); expect(p.terminal!.payoff.draw).toBe(1); expect(p.terminal!.objects[1].zone).toBe('graveyard');
  });
  it('enforces an additional sacrifice cost before drawing and creates a spendable Treasure', () => {
    const s = scenario([{ card: card('Deadly Dispute'), id: 'root', zone: 'hand' }, { card: card('Grizzly Bears'), id: 'body', zone: 'battlefield' }], { mana: { ...emptyMana(), B: 1, C: 1 } });
    expect(execute(s, cast)[0].status).toBe('Invalid');
    const p = verified(s, { ...cast, sacrifice: 'body' }); expect(p.terminal!.payoff.draw).toBe(2); expect(p.terminal!.payoff.tokens).toBe(1); expect(p.terminal!.spent.sacrificed).toEqual(['body']);
    const treasure = p.terminal!.objects.find(o => o.token)!;
    const a = actions(p.terminal!).find(a => a.instance === treasure.instance)!;
    for (const next of execute(p.terminal!, a)) { expect(next.status).toBe('Verified'); expect(Object.values(next.terminal!.mana!).reduce((a,b) => a+b)).toBe(1); expect(next.terminal!.objects.find(o => o.instance === treasure.instance)!.ceased).toBe(true); }
  });
  it('does not select a sacrificed body as a new resolution-time target', () => {
    const root = modified('Zombify', 'As an additional cost to cast this spell, sacrifice a creature.\nPut a +1/+1 counter on target creature.');
    const s = scenario([{ card: root, id: 'root', zone: 'hand' }, { card: card('Grizzly Bears'), id: 'body', zone: 'battlefield' }], { mana });
    const p = verified(s, { ...cast, sacrifice: 'body' }); expect(p.terminal!.payoff.counters).toBe(0); expect(p.terminal!.spent.sacrificed).toEqual(['body']);
  });
  it('does not let a cast trigger create a target that was missing at announcement', () => {
    const observer = modified('Grizzly Bears', 'Whenever you cast an instant or sorcery spell, create a 1/1 white Soldier creature token.');
    observer.typeLine = 'Enchantment';
    const root = modified('Zombify', 'Put a +1/+1 counter on target creature.');
    const s = scenario([{ card: observer, id: 'observer', zone: 'battlefield' }, { card: root, id: 'root', zone: 'hand' }], { mana });
    expect(execute(s, cast)[0].status).toBe('Invalid');
  });
  it('counts actual resources for mana and records each supporting participant', () => {
    const s = scenario([{ card: card('Battle Hymn'), id: 'root', zone: 'hand' }, { card: card('Grizzly Bears'), id: 'one', zone: 'battlefield' }, { card: card('Nessian Courser'), id: 'two', zone: 'battlefield' }], { mana: { ...emptyMana(), R: 1, C: 1 } });
    const p = verified(s); expect(p.terminal!.mana!.R).toBe(2); expect(p.events.find(e => e.kind === 'mana')!.participants).toEqual(['one', 'root', 'two']);
    expect(holdingsDelta(s, p.terminal!).mana!.R).toBe(1);
  });
  it('uses current power for a conditional draw-or-counters payoff', () => {
    const s = scenario([{ card: card('Tribute to the World Tree'), id: 'observer', zone: 'battlefield' }, { card: card('Grizzly Bears'), id: 'root', zone: 'hand' }], { mana });
    const p = verified(s); expect(p.terminal!.payoff.draw).toBe(0); expect(p.terminal!.payoff.counters).toBe(2); expect(p.checks.filter(c => c.role === 'required').every(c => c.result === true)).toBe(true);
    const high = scenario([{ card: card('Tribute to the World Tree'), id: 'observer', zone: 'battlefield' }, { card: card('Nessian Courser'), id: 'root', zone: 'hand' }], { mana });
    expect(verified(high).terminal!.payoff.draw).toBe(1);
  });
  it('keeps unknown graveyard continuous effects from being silently ignored', () => {
    const s = scenario([{ card: card('Grizzly Bears'), id: 'root', zone: 'hand' }, { card: modified('Nessian Courser', 'As long as this card is in your graveyard, creature spells cost {1} more to cast.'), id: 'unknown', zone: 'graveyard' }], { mana });
    expect(execute(s, cast)[0].status).toBe('Unknown');
  });
  it('does not mutate the caller’s mana object when a scenario is edited', () => {
    const supplied = { ...mana }; const s = scenario([], { mana: supplied }); s.mana!.W = 0; expect(supplied.W).toBe(10);
  });
  it('allows a complete chosen payment path while explicitly reporting truncated alternatives', () => {
    const s = recur('Zombify'); const p = verified(s); expect(p.complete).toBe(true); expect(p.searchTruncated).toBe(true);
    expect(execute(s, cast, { automaticSteps: 0 })[0].status).toBe('Unknown');
  });
});

it('does not resolve untargeted clauses when every selected target becomes illegal', () => {
  const root = modified('Zombify', 'As an additional cost to cast this spell, sacrifice a creature.\nPut a +1/+1 counter on target creature. Draw a card.');
  const s = scenario([{ card: root, id: 'root', zone: 'hand' }, { card: card('Grizzly Bears'), id: 'body', zone: 'battlefield' }], { mana });
  const p = verified(s, { ...cast, sacrifice: 'body' }); expect(p.terminal!.payoff.draw).toBe(0); expect(p.terminal!.payoff.counters).toBe(0);
});
it('rejects foreign target keys instead of silently choosing a different target', () => {
  expect(execute(recur('Zombify'), { ...cast, targets: { typo: [{ instance: 'target', incarnation: 0 }] } })[0].status).toBe('Invalid');
});
it('does not interpret an absent mana cost as a free normal cast', () => {
  const root = { ...card('Grizzly Bears'), manaCost: '' };
  expect(execute(scenario([{ card: root, id: 'root', zone: 'hand' }], { mana }), cast)[0].status).toBe('Invalid');
});
it('derives basic-land mana abilities from land types and pays the tap cost', () => {
  const s = scenario([{ card: card('Forest'), id: 'land', zone: 'battlefield' }]);
  const p = verified(s, actions(s)[0]); expect(p.terminal!.mana!.G).toBe(1); expect(p.terminal!.objects[0].tapped).toBe(true);
  expect(execute(p.terminal!, actions(s)[0])[0].status).toBe('Invalid');
});
it('preserves exact Oracle line provenance across blank lines and multiline reminders', () => {
  const root = modified('Zombify', '(Reminder\ntext.)\n\nDraw two cards.');
  const p = verified(scenario([{ card: root, id: 'root', zone: 'hand' }], { mana }));
  expect(p.events.find(e => e.kind === 'draw')!.evidence.some(e => e.line === 3 && e.text === 'Draw two cards.')).toBe(true);
});
it('does not resolve a stack-using ability after its life cost causes game loss', () => {
  const root = modified('Grizzly Bears', 'Pay 40 life: Draw a card.');
  const s = scenario([{ card: root, id: 'root', zone: 'battlefield' }]);
  const p = verified(s, actions(s)[0]); expect(p.terminal!.payoff.loss).toBe(true); expect(p.terminal!.payoff.draw).toBe(0);
});
it('keeps copied spell identities separate from the original spell', () => {
  const observer = modified('Grizzly Bears', 'Whenever you cast an instant or sorcery spell, copy that spell. You may choose new targets for the copy.');
  const s = scenario([{ card: observer, id: 'observer', zone: 'battlefield' }, { card: card('Concentrate'), id: 'root', zone: 'hand' }], { mana });
  const p = verified(s); const sources = new Set(p.events.filter(e => e.kind === 'draw').map(e => e.source));
  expect(sources.has('root')).toBe(true); expect(sources.size).toBe(2); expect(p.terminal!.objects.find(o => o.instance.startsWith('copy-'))!.ceased).toBe(true);
});
it('abstains when blink gives an entry-trigger creature to the modeled opponent', () => {
  const spell = modified('Cloudshift', "Exile target creature you control, then return it to the battlefield under its owner's control.");
  const s = scenario([{ card: spell, id: 'root', zone: 'hand' }, { card: card('Elvish Visionary'), id: 'body', zone: 'battlefield', owner: 'opponent' }], { mana });
  expect(execute(s, cast)[0].status).toBe('Unknown');
});
