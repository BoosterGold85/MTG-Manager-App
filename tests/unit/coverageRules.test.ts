import { describe, it, expect } from 'vitest';
import { compile } from '../../src/experimental/universal/compiler';
import { oracleCard } from '../upgradeCandidates';

const read = (name: string, type: string, text: string) => compile(oracleCard(name, '{2}', 2, type, text, []));

describe('coverage rules (generalized, with negative controls)', () => {
  it('reads mana abilities with a generic cost before {T}', () => {
    const r = read('Rule Rock', 'Artifact', '{1}, {T}: Add {W}{U}.');
    expect(r.unsupported).toEqual([]);
    expect(r.abilities[0].cost).toMatchObject({ mana: '{1}', tap: true });
  });
  it('reads a two-color choice and self-damage as a life loss', () => {
    const r = read('Rule Talisman', 'Artifact', '{T}: Add {W} or {U}. SELF deals 1 damage to you.');
    expect(r.unsupported).toEqual([]);
    expect(r.abilities[0].effects).toEqual([{ kind: 'mana', symbols: [], options: ['W', 'U'] }, { kind: 'lose-life', count: 1 }]);
  });
  it('sets aside combat-only triggers and self-contained keyword costs instead of blocking the card', () => {
    const r = read('Rule Raider', 'Creature — Pirate', 'Whenever a creature you control deals combat damage to a player, you may draw a card.\nWhenever a Vehicle you control attacks, choose one —\n• Untap SELF.\n• SELF gains first strike until end of turn.\nCycling {2}\nWard {1}\nEquip {3}');
    expect(r.unsupported).toEqual([]);
    expect(r.deferred).toHaveLength(7);
    expect(r.abilities).toHaveLength(0);
  });
  it('reads cast triggers over a list of types and one negated type', () => {
    const list = read('Rule Smith', 'Creature — Dwarf', 'Whenever you cast an Aura, Equipment, or Vehicle spell, draw a card.');
    expect(list.unsupported).toEqual([]);
    expect(list.abilities[0].trigger).toMatchObject({ event: 'cast', spellTypes: ['Aura', 'Equipment', 'Vehicle'] });
    const non = read('Rule Sage', 'Creature — Human', 'Whenever you cast a noncreature spell, draw a card.');
    expect(non.abilities[0].trigger).toMatchObject({ event: 'cast', excludedSpellTypes: ['Creature'] });
  });
  it('negative controls: rule-changing statics, noncombat damage and unknown modes stay unsupported', () => {
    expect(read('Rule Anthem', 'Enchantment', 'Creatures you control with flying get +1/+1.').unsupported).toHaveLength(1);
    expect(read('Rule Pinger', 'Creature — Goblin', 'Whenever a creature you control deals damage to a player, draw a card.').unsupported).toHaveLength(1);
    expect(read('Rule Lure', 'Artifact', '{1}{U}, {T}: Creatures your opponents control attack this turn if able.').unsupported).toHaveLength(1);
    expect(read('Rule Modal', 'Sorcery', 'Choose one —\n• Destroy all creatures.\n• Draw a card.').unsupported.length).toBeGreaterThan(0);
    expect(read('Rule Identity', 'Artifact', "{T}: Add one mana of any color in your commander's color identity.").unsupported).toHaveLength(1);
    expect(read('Rule Cast', 'Creature — Elf', 'Whenever you cast a spell that targets SELF, draw a card.').unsupported).toHaveLength(1);
  });
});

import { scenario, actions, execute } from '../../src/experimental/universal/engine';
describe('two-color mana choice executes', () => {
  it('branches into exactly the two named colors and records the life loss', () => {
    const rock = oracleCard('Rule Talisman', '{2}', 2, 'Artifact', '{T}: Add {W} or {U}. SELF deals 1 damage to you.', []);
    const s = scenario([{ id: 'rock', card: rock, zone: 'battlefield' }]);
    const proofs = execute(s, actions(s).find(a => a.kind === 'activate')!).filter(p => p.status === 'Verified');
    const colors = new Set(proofs.map(p => Object.entries(p.terminal!.payoff.manaGenerated).filter(([, n]) => n > 0).map(([c]) => c).join('')));
    expect([...colors].sort()).toEqual(['U', 'W']);
    expect(proofs.every(p => p.terminal!.life === 39)).toBe(true);
  });
});

import { discoverFocus } from '../../src/experimental/universal/discovery';
import { ANALYZER_VERSION } from '../../src/experimental/universal/protocol';
describe('creature-type entry triggers', () => {
  const queen = { ...oracleCard('Rule Queen', '{4}{R}', 5, 'Legendary Creature — Dragon', 'Flying\nWhenever another nontoken Dragon you control enters, create a 5/5 red Dragon creature token with flying.', ['R']), power: '4', toughness: '4' };
  const whelp = { ...oracleCard('Rule Whelp', '{2}{R}', 3, 'Creature — Dragon', 'Flying', ['R']), power: '2', toughness: '2' };
  const goblin = { ...oracleCard('Rule Goblin', '{R}', 1, 'Creature — Goblin', '', ['R']), power: '1', toughness: '1' };
  it('compiles the type, "another" and "nontoken" qualifiers', () => {
    const r = compile(queen);
    expect(r.unsupported).toEqual([]);
    expect(r.abilities[0].trigger).toMatchObject({ event: 'enter', subject: { subtype: 'Dragon', another: true, nontoken: true } });
  });
  it('fires for a nontoken Dragon, not for another type, and never for its own token (no loop)', () => {
    const run = (other: typeof whelp) => discoverFocus({ id: 'q', revision: 'r', version: ANALYZER_VERSION, cards: [queen, other], focusId: queen.scryfallId, anchorIds: [], partnerIds: [other.scryfallId], library: 40 });
    const dragon = run(whelp);
    expect(dragon.findings.some(f => f.gains.some(g => g.dimension === 'tokens' && g.added === 1) && f.partners.some(p => p.name === 'Rule Whelp'))).toBe(true);
    expect(run(goblin).findings.filter(f => f.partners.some(p => p.name === 'Rule Goblin'))).toEqual([]);
  });
  it('negative controls: changeling, "SELF or another" and non-type words stay unsupported', () => {
    expect(read('Rule Shifter', 'Creature — Shapeshifter', 'Changeling').unsupported).toHaveLength(1);
    expect(read('Rule Valkas', 'Creature — Dragon', 'Whenever SELF or another Dragon you control enters, draw a card.').unsupported).toHaveLength(1);
    expect(read('Rule Flier', 'Enchantment', 'Whenever a creature you control with flying enters, draw a card.').unsupported).toHaveLength(1);
  });
});
