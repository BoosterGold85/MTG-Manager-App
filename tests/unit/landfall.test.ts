import { describe, it, expect } from 'vitest';
import { oracleCard } from '../upgradeCandidates';
import { compile } from '../../src/experimental/universal/compiler';
import { actions, execute, scenario } from '../../src/experimental/universal/engine';
import { discoverFocus, ASSUMED_LAND_ID } from '../../src/experimental/universal/discovery';
import { ANALYZER_VERSION } from '../../src/experimental/universal/protocol';

type Meta = ReturnType<typeof oracleCard>;
const card = (name: string, cost: string, mv: number, type: string, text: string, power?: string, toughness?: string): Meta => ({
  ...oracleCard(name, cost, mv, type, text, ['G']), ...(power ? { power, toughness } : {}), scryfallId: name.replace(/\W+/g, '-').toLowerCase(),
} as Meta);
const baloth = card('Rule Baloth', '{4}{G}{G}', 6, 'Creature — Beast', 'Landfall — Whenever a land you control enters, create a 4/4 green Beast creature token.', '4', '4');
const drawer = card('Rule Lookout', '{2}{G}', 3, 'Enchantment', 'Landfall — Whenever a land you control enters, draw a card.');
const creatureWatch = card('Rule Watcher', '{2}{G}', 3, 'Enchantment', 'Whenever a creature you control enters, draw a card.');
const forest = card('Rule Forest', '', 0, 'Basic Land — Forest', '{T}: Add {G}.');
const bear = card('Rule Bear', '{1}{G}', 2, 'Creature — Bear', '', '2', '2');
const land = (id: string) => ({ id, card: forest, zone: 'hand' as const });
const mana = { W: 0, U: 0, B: 0, R: 0, G: 4, C: 0 };

describe('landfall (generalized, with negative controls)', () => {
  it('compiles "Landfall — Whenever a land you control enters" as a land entry trigger', () => {
    const r = compile(baloth);
    expect(r.unsupported).toEqual([]);
    expect(r.abilities[0].trigger).toMatchObject({ event: 'enter', subject: { type: 'Land', controller: 'you' } });
  });

  it('offers exactly one land drop per turn, from hand, in the main phase', () => {
    const s = scenario([{ id: 'b', card: baloth, zone: 'battlefield', ready: true, tapped: false }, land('f1'), land('f2')], { mana, library: 40 });
    expect(actions(s).filter(a => a.kind === 'play-land').map(a => a.instance).sort()).toEqual(['f1', 'f2']);
    const [after] = execute(s, { kind: 'play-land', instance: 'f1' }).filter(p => p.status === 'Verified').map(p => p.terminal!);
    expect(after.objects.find(o => o.instance === 'f1')!.zone).toBe('battlefield');
    expect(actions(after).some(a => a.kind === 'play-land')).toBe(false);
  });

  it('a land drop makes a landfall creature create exactly one token, and that token does not loop', () => {
    const s = scenario([{ id: 'b', card: baloth, zone: 'battlefield', ready: true, tapped: false }, land('f1')], { mana, library: 40 });
    const proofs = execute(s, { kind: 'play-land', instance: 'f1' }).filter(p => p.status === 'Verified');
    expect(proofs.length).toBeGreaterThan(0);
    expect(proofs.every(p => p.terminal!.payoff.tokens === 1)).toBe(true);
  });

  it('negative control: a creature entering does not fire a landfall card, and a land-entry does not fire a creature-entry card', () => {
    expect(compile(creatureWatch).unsupported).toEqual([]);
    const s = scenario([{ id: 'w', card: creatureWatch, zone: 'battlefield', ready: true, tapped: false }, land('f1')], { mana, library: 40 });
    const landProofs = execute(s, { kind: 'play-land', instance: 'f1' }).filter(p => p.status === 'Verified');
    expect(landProofs.every(p => p.terminal!.payoff.draw === 0)).toBe(true);
    const cast = scenario([{ id: 'l', card: drawer, zone: 'battlefield', ready: true, tapped: false }, { id: 'c', card: bear, zone: 'hand' }], { mana, library: 40 });
    const castProofs = execute(cast, { kind: 'cast', instance: 'c' }).filter(p => p.status === 'Verified');
    expect(castProofs.length).toBeGreaterThan(0);
    expect(castProofs.every(p => p.terminal!.payoff.draw === 0)).toBe(true);
  });

  it('discovery credits a landfall card to its own assumed land drop, and names that assumption', () => {
    const r = discoverFocus({ id: 'lf', revision: 'r', version: ANALYZER_VERSION, cards: [baloth, bear], focusId: baloth.scryfallId, anchorIds: [], partnerIds: [bear.scryfallId], library: 40 });
    const finding = r.findings.find(f => f.gains.some(g => g.dimension === 'tokens' && g.added === 1));
    expect(finding).toBeTruthy();
    expect(finding!.partners).toEqual([]);
    expect(finding!.required.map(x => x.id)).toEqual([ASSUMED_LAND_ID]);
  });

  it('negative control: a vanilla focus card with the assumed land gains nothing', () => {
    const r = discoverFocus({ id: 'lf2', revision: 'r', version: ANALYZER_VERSION, cards: [bear, baloth], focusId: bear.scryfallId, anchorIds: [], partnerIds: [baloth.scryfallId], library: 40 });
    expect(r.findings.filter(f => f.gains.some(g => g.dimension === 'tokens'))).toEqual([]);
  });
});
