import { it, expect, vi, afterEach } from 'vitest';
import { castingMana, discoverFocus, DISCOVERY_BOUNDS } from '../../src/experimental/universal/discovery';
import type { DiscoveryRequest } from '../../src/experimental/universal/discovery';
import { DiscoveryClient } from '../../src/experimental/universal/discoveryClient';
import type { DiscoveryResponse, DiscoveryWorker } from '../../src/experimental/universal/discoveryClient';
import { discoveryInput } from '../../src/experimental/universal/discoveryInput';
import { ANALYZER_VERSION } from '../../src/experimental/universal/protocol';
import { reignOfDragonsFixture } from '../recommendationFixtures';
import { oracleCard } from '../upgradeCandidates';
import type { CardMetadata } from '../../src/models/collection';
vi.mock('../../src/experimental/universal/activation', () => ({ analyzerAvailable: vi.fn(() => true), ANALYZER_BLOCKED_MESSAGE: 'Execution is not enabled.' }));
afterEach(() => vi.useRealTimers());

// Synthetic cards only: the pass must work from typed Oracle text, never from card names.
const captain = oracleCard('Test Captain', '{1}{W}{U}', 3, 'Legendary Creature — Fox Pilot', 'Flying\nWhenever a Vehicle you control enters, draw a card if it has flying. Otherwise, put a flying counter on it.', ['W', 'U'], { keywords: ['Flying'], power: '1', toughness: '3' });
const marshal = oracleCard('Test Marshal', '{3}{W}', 4, 'Creature — Human Pilot', 'Flying\nVehicles you control have flying.', ['W'], { keywords: ['Flying'], power: '3', toughness: '1' });
const wagon = oracleCard('Test Wagon', '{3}', 3, 'Artifact — Vehicle', 'Crew 2', [], { keywords: ['Crew'], power: '5', toughness: '4' });
const cart = oracleCard('Test Cart', '{2}', 2, 'Artifact — Vehicle', 'Crew 1', [], { keywords: ['Crew'], power: '3', toughness: '3' });
const glider = oracleCard('Test Glider', '{2}', 2, 'Artifact — Vehicle', 'Flying\nCrew 1', [], { keywords: ['Flying', 'Crew'], power: '2', toughness: '2' });
const levitator = oracleCard('Test Levitator', '{2}{U}{U}', 4, 'Enchantment', 'Creatures you control have flying.', ['U']);
const scholar = oracleCard('Test Scholar', '{4}{U}', 5, 'Creature — Elemental', 'Flying\nWhen this creature enters, draw two cards.', ['U'], { keywords: ['Flying'], power: '2', toughness: '2' });
const observer = oracleCard('Test Observer', '{W}', 1, 'Creature — Human Cleric', 'Whenever another creature enters, you gain 1 life.', ['W'], { power: '1', toughness: '1' });
const bear = oracleCard('Test Bear', '{1}', 1, 'Creature — Bear', '', [], { power: '2', toughness: '2' });
const brute = oracleCard('Test Brute', '{2}', 2, 'Creature — Ogre', '', [], { power: '3', toughness: '3' });
const exile = oracleCard('Test Exile', '{W}', 1, 'Instant', "Exile target creature. Its controller gains life equal to its power.", ['W']);

const request = (focus: CardMetadata, deck: CardMetadata[], anchors: CardMetadata[] = [captain]): DiscoveryRequest => ({
  id: '1', revision: 'r', version: ANALYZER_VERSION, cards: [...new Set([...anchors, ...deck, focus])], focusId: focus.scryfallId,
  anchorIds: anchors.map(c => c.scryfallId), partnerIds: deck.map(c => c.scryfallId), library: 40,
});
const names = (cards: { name: string }[]) => cards.map(c => c.name).sort();

it('finds a static enabler that changes the commander payoff, with the commander named as required', () => {
  const input = request(marshal, [wagon, cart, glider, bear]), before = JSON.stringify(input);
  const result = discoverFocus(input);
  const draw = result.findings.find(f => f.gains.some(g => g.dimension === 'draw'))!;
  expect(draw).toBeDefined();
  expect(draw.role).toBe('standing');
  expect(names(draw.required)).toEqual(['Test Captain']);
  // The Vehicle that already flies draws without the focus card, so it is not credited to it.
  expect(names(draw.partners)).toEqual(['Test Cart', 'Test Wagon']);
  expect(draw.gains).toEqual([{ dimension: 'draw', added: 1, withFocus: 1, withoutFocus: 0, focusAlone: 0 }]);
  expect(draw.evidence.some(line => line.startsWith('Test Marshal: Vehicles you control have flying'))).toBe(true);
  expect(draw.evidence.some(line => line.startsWith('Test Captain: Whenever a Vehicle you control enters'))).toBe(true);
  expect(draw.example.mana.C).toBeGreaterThan(0);
  expect(result.truncated).toBe(false);
  expect(JSON.stringify(input)).toBe(before);
});

it('loses that chain when the required commander is absent', () => {
  const result = discoverFocus(request(marshal, [wagon, cart, glider, bear], []));
  expect(result.findings.filter(f => f.gains.some(g => g.dimension === 'draw'))).toEqual([]);
});

it('reports an unreadable card as Unknown rather than inventing or denying a chain', () => {
  const result = discoverFocus(request(levitator, [wagon, cart, bear]));
  expect(result.findings).toEqual([]);
  expect(result.interpretation.unsupported.length).toBeGreaterThan(0);
});

it('does not credit a card for what it produces alone or for being another card\'s target', () => {
  expect(discoverFocus(request(scholar, [wagon, bear])).findings.filter(f => f.gains.some(g => g.dimension === 'draw'))).toEqual([]);
  expect(discoverFocus(request(brute, [exile, bear], [])).findings).toEqual([]);
});

it('drops a bystander commander from a chain that does not need it', () => {
  const result = discoverFocus(request(observer, [bear, brute]));
  const life = result.findings.find(f => f.partners.length > 0 && f.gains.some(g => g.dimension === 'life'))!;
  expect(life).toBeDefined();
  expect(life.required).toEqual([]);
  expect(names(life.partners)).toEqual(['Test Bear', 'Test Brute']);
  expect(life.evidence.every(line => line.startsWith('Test Observer'))).toBe(true);
});

it('stops at its time budget and says the pass is incomplete', () => {
  let clock = 0;
  const result = discoverFocus(request(marshal, [wagon, cart, glider, bear]), () => (clock += DISCOVERY_BOUNDS.budgetMs));
  expect(result.truncated).toBe(true);
  expect(result.scenariosRun).toBeLessThan(result.scenariosPlanned);
  expect(result.reasons.join(' ')).toMatch(/budget reached/);
});

it('rejects malformed requests before searching', () => {
  const good = request(marshal, [wagon]);
  expect(() => discoverFocus({ ...good, version: 'old' })).toThrow(/Malformed/);
  expect(() => discoverFocus({ ...good, focusId: 'missing' })).toThrow(/Unknown focus/);
  expect(() => discoverFocus({ ...good, partnerIds: ['missing'] })).toThrow(/Unknown anchor or partner/);
  expect(() => discoverFocus({ ...good, cards: [...good.cards, good.cards[0]] })).toThrow();
});

it('assumes exactly the printed casting mana and refuses unsupported symbols', () => {
  expect(castingMana([{ manaCost: '{2}{W}{U}' }, { manaCost: '{1}{W/U}' }])).toEqual({ W: 2, U: 1, B: 0, R: 0, G: 0, C: 3 });
  expect(castingMana([{ manaCost: '{S}' }])).toBeNull();
  expect(castingMana([{}])).toEqual({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
});

it('offers only owned, in-identity, nonland cards that are not already in the deck, without touching saved data', () => {
  const f = reignOfDragonsFixture(), commander = f.state.metadata[f.deck.commanders[0].scryfallId];
  const inColor = oracleCard('Owned In Color', '{1}', 1, 'Artifact', '', []), offColor = oracleCard('Owned Off Color', '{G}', 1, 'Creature — Elf', '', ['G']);
  const land = oracleCard('Owned Land', '', 0, 'Land', '{T}: Add {C}.', []), unowned = oracleCard('Not Owned', '{1}', 1, 'Artifact', '', []);
  const item = (card: CardMetadata, quantityOwned: number) => ({ id: `item:${card.name}`, scryfallId: card.scryfallId, setCode: 'cnd', collectorNumber: card.name, finish: 'nonfoil' as const, language: 'en', condition: 'NM', binderName: '', binderType: '', quantityOwned, quantityAssigned: 0, quantityUnassigned: quantityOwned, sourceRows: [] });
  for (const card of [inColor, offColor, land, unowned]) f.state.metadata[card.scryfallId] = card;
  f.state.items.push(item(inColor, 1), item(offColor, 1), item(land, 2), item(unowned, 0));
  const before = JSON.stringify([f.state, f.deck]);
  const input = discoveryInput(f.state, f.deck);
  expect(input.anchorIds).toEqual([commander.scryfallId]);
  expect(input.candidates.map(c => c.name)).toContain('Owned In Color');
  for (const excluded of ['Owned Off Color', 'Owned Land', 'Not Owned', commander.name]) expect(input.candidates.map(c => c.name)).not.toContain(excluded);
  expect(input.outsideIdentity).toBeGreaterThanOrEqual(1);
  const deckOracles = new Set(input.deckCards.map(c => c.oracleId));
  expect(input.candidates.some(c => deckOracles.has(c.oracleId))).toBe(false);
  expect(new Set(input.deckCards.map(c => c.oracleId)).size).toBe(input.deckCards.length);
  expect(JSON.stringify([f.state, f.deck])).toBe(before);
});

class FakeWorker implements DiscoveryWorker {
  onmessage: DiscoveryWorker['onmessage'] = null; onerror: DiscoveryWorker['onerror'] = null; onmessageerror: DiscoveryWorker['onmessageerror'] = null;
  request!: DiscoveryRequest; terminated = 0;
  postMessage(request: DiscoveryRequest) { this.request = request; }
  terminate() { this.terminated++; }
  reply(data: DiscoveryResponse) { this.onmessage?.({ data } as MessageEvent<DiscoveryResponse>); }
}
const clientInput = () => { const { id, version, ...rest } = request(marshal, [wagon, cart]); void id; void version; return rest; };

it('client returns a real result, terminates its worker and ignores stale replies', async () => {
  const workers: FakeWorker[] = [], client = new DiscoveryClient(() => { const w = new FakeWorker(); workers.push(w); return w; });
  const first = client.run(clientInput()); first.catch(() => undefined);
  const second = client.run(clientInput());
  await expect(first).rejects.toMatchObject({ name: 'AbortError' });
  expect(workers[0].terminated).toBe(1);
  const stale = discoverFocus({ ...workers[0].request });
  workers[1].reply({ id: workers[0].request.id, revision: 'r', version: ANALYZER_VERSION, result: stale });
  const fresh = discoverFocus(workers[1].request);
  workers[1].reply({ id: workers[1].request.id, revision: 'r', version: ANALYZER_VERSION, result: fresh });
  await expect(second).resolves.toEqual(fresh);
  expect(workers[1].terminated).toBe(1);
});

it('client rejects a finding with no added production and times out a silent worker', async () => {
  vi.useFakeTimers();
  const workers: FakeWorker[] = [], client = new DiscoveryClient(() => { const w = new FakeWorker(); workers.push(w); return w; });
  const bad = client.run(clientInput());
  const result = discoverFocus(workers[0].request);
  workers[0].reply({ id: workers[0].request.id, revision: 'r', version: ANALYZER_VERSION, result: { ...result, findings: result.findings.map(f => ({ ...f, gains: [] })) } });
  await expect(bad).rejects.toThrow(/missing its evidence/);
  const silent = client.run(clientInput()); const caught = expect(silent).rejects.toThrow(/timed out/);
  await vi.advanceTimersByTimeAsync(DISCOVERY_BOUNDS.timeoutMs + 1);
  await caught;
  expect(workers[1].terminated).toBe(1);
});
