// Automatic Brew Lab discovery pass. Read-only and ephemeral: it only builds
// hypothetical scenarios and hands each one to the same strict engine the
// targeted Brew Lab scenario uses. It never scores, ranks by value, or persists.
//
// For one focus card it tries the card beside each anchor (the commander) and
// every deck card, then repeats the identical scenario without the focus card.
// Only chains that need the focus card AND change what the scenario produces
// are reported. Nothing here names a card or a payoff in advance.
import type { CardMetadata } from '../../models/collection';
import { analyze } from './analyze';
import { compile } from './compiler';
import { actions, execute, scenario } from './engine';
import { emptyMana } from './model';
import type { CompiledCard, Mana, Payoff, Zone } from './model';
import { ANALYZER_BOUNDS, ANALYZER_VERSION, byteSize } from './protocol';

export const DISCOVERY_BOUNDS = Object.freeze({ scenarios: 400, budgetMs: 6000, timeoutMs: 9000, findings: 24, partnersListed: 60, baselineStates: 60 });
export type DiscoveryRole = 'standing' | 'arriving' | 'from-graveyard' | 'recovers';
export const ROLE_TEXT: Record<DiscoveryRole, string> = {
  standing: 'already on the battlefield when another card is cast',
  arriving: 'cast from hand onto an established board',
  'from-graveyard': 'starting in your graveyard',
  recovers: 'with the other card starting in your graveyard',
};
export const DIMENSIONS = ['draw', 'recoveredToHand', 'tokens', 'creatures', 'counters', 'life', 'opponentDamage', 'mana'] as const;
export type Dimension = typeof DIMENSIONS[number];
export const DIMENSION_TEXT: Record<Dimension, string> = { draw: 'cards drawn', recoveredToHand: 'cards returned to hand', tokens: 'tokens created', creatures: 'creatures added', counters: 'counters placed', life: 'life gained', opponentDamage: 'damage to an opponent', mana: 'mana produced' };

export interface DiscoveryRequest { id: string; revision: string; version: string; cards: CardMetadata[]; focusId: string; anchorIds: string[]; partnerIds: string[]; library: number }
/** `added` is what the combination produced beyond the same scenario without the focus card and beyond the focus card alone. */
export interface DiscoveryChange { dimension: Dimension; added: number; withFocus: number; withoutFocus: number; focusAlone: number }
export interface DiscoveryFinding {
  role: DiscoveryRole;
  /** Non-partner cards the witnessed chain needed besides the focus card. */
  required: { id: string; name: string }[];
  /** Deck cards that each completed the same chain in their own scenario. */
  partners: { id: string; name: string }[];
  partnersTruncated: boolean;
  gains: DiscoveryChange[];
  /** Oracle lines the engine cited, as "Card: text". */
  evidence: string[];
  branches: string[];
  example: { placements: { id: string; name: string; zone: Zone }[]; mana: Mana; steps: number };
}
export interface DiscoveryResult {
  id: string; revision: string; version: string; focusId: string; focusName: string;
  findings: DiscoveryFinding[];
  interpretation: { modeled: number; unsupported: string[]; deferred: string[] };
  scenariosPlanned: number; scenariosRun: number; partnersConsidered: number; partnersNotTestable: number; statesExplored: number; truncated: boolean; reasons: string[];
}

type Placement = { id: string; zone: Zone };
interface Plan { role: DiscoveryRole; placements: Placement[]; partner?: string }

/** Mana needed to cast the cards assumed to start in hand. Hypothetical input, never deck-generated. */
export function castingMana(cards: { manaCost?: string }[]): Mana | null {
  const pool = emptyMana();
  for (const card of cards) for (const [, symbol] of (card.manaCost || '').matchAll(/\{([^}]+)\}/g)) {
    if (/^\d+$/.test(symbol)) pool.C += Number(symbol);
    else if (symbol === 'X') continue;
    else { const color = symbol.split('/').find(part => /^[WUBRGC]$/.test(part)); if (!color) return null; pool[color as keyof Mana]++; }
  }
  return Object.values(pool).some(n => n > 20) ? null : pool;
}

const usesGraveyard = (card: CompiledCard) => card.abilities.some(a => a.kind === 'permission' || a.effects.some(e => e.kind === 'return'));
const isLand = (card: CompiledCard) => card.types.includes('Land');

export function plan(compiled: Map<string, CompiledCard>, focusId: string, anchorIds: string[], partnerIds: string[]): Plan[] {
  const focus = compiled.get(focusId)!, plans: Plan[] = [], seen = new Set<string>();
  const add = (role: DiscoveryRole, placements: Placement[], partner?: string) => {
    if (new Set(placements.map(p => p.id)).size !== placements.length) return;
    const key = JSON.stringify(placements.map(p => [p.id, p.zone]).sort());
    if (!seen.has(key)) { seen.add(key); plans.push({ role, placements, partner }); }
  };
  const anchors = anchorIds.filter(id => id !== focusId && compiled.has(id));
  const partners = partnerIds.filter(id => id !== focusId && !anchors.includes(id) && compiled.has(id) && !isLand(compiled.get(id)!));
  const focusPermanent = focus.types.some(t => ['Creature', 'Artifact', 'Enchantment', 'Planeswalker', 'Battle'].includes(t));
  // Focus beside each anchor alone first: the cheapest and most central question.
  for (const anchor of anchors) {
    add('arriving', [{ id: focusId, zone: 'hand' }, { id: anchor, zone: 'battlefield' }]);
    if (focusPermanent) add('standing', [{ id: focusId, zone: 'battlefield' }, { id: anchor, zone: 'hand' }]);
  }
  const board = (anchor?: string): Placement[] => anchor ? [{ id: anchor, zone: 'battlefield' }] : [];
  // Beside each anchor first, then without one: an anchor the engine cannot read must not
  // hide a two-card chain that never needed it.
  for (const anchor of [...anchors, undefined]) for (const partner of partners) {
    const other = compiled.get(partner)!;
    if (focusPermanent) add('standing', [{ id: focusId, zone: 'battlefield' }, ...board(anchor), { id: partner, zone: 'hand' }], partner);
    if (other.types.some(t => ['Creature', 'Artifact', 'Enchantment', 'Planeswalker', 'Battle'].includes(t))) add('arriving', [{ id: focusId, zone: 'hand' }, ...board(anchor), { id: partner, zone: 'battlefield' }], partner);
    const graveyardMatters = usesGraveyard(focus) || usesGraveyard(other) || !!anchor && usesGraveyard(compiled.get(anchor)!);
    if (graveyardMatters) {
      add('recovers', [{ id: focusId, zone: focusPermanent ? 'battlefield' : 'hand' }, ...board(anchor), { id: partner, zone: 'graveyard' }], partner);
      add('from-graveyard', [{ id: focusId, zone: 'graveyard' }, ...board(anchor), { id: partner, zone: other.types.includes('Instant') || other.types.includes('Sorcery') ? 'hand' : 'battlefield' }], partner);
    }
  }
  return plans;
}

const measure = (payoff: Payoff | undefined): Record<Dimension, number> => ({
  draw: payoff?.draw || 0, recoveredToHand: payoff?.recoveredToHand || 0, tokens: payoff?.tokens || 0, creatures: payoff?.creatures || 0,
  counters: payoff?.counters || 0, life: payoff?.life || 0, opponentDamage: payoff?.opponentDamage || 0,
  mana: payoff ? Object.values(payoff.manaGenerated).reduce((n, v) => n + v, 0) : 0,
});

/** Best supported production per dimension for a scenario, whether or not its cards interact.
 * This is the "each side alone" baseline the combination has to beat. */
export function baseline(cards: Map<string, CardMetadata>, placements: Placement[], mana: Mana, library: number): Record<Dimension, number> {
  const best = measure(undefined);
  if (!placements.length) return best;
  const initial = scenario(placements.map(p => ({ card: cards.get(p.id)!, id: p.id, zone: p.zone, ready: p.zone === 'battlefield', tapped: false })), { mana, library });
  const queue = [{ state: initial, depth: 0 }]; let explored = 0;
  while (queue.length && explored < DISCOVERY_BOUNDS.baselineStates) {
    const item = queue.shift()!;
    if (item.depth >= ANALYZER_BOUNDS.depth || item.state.payoff.loss) continue;
    for (const action of actions(item.state)) {
      if (explored++ >= DISCOVERY_BOUNDS.baselineStates) break;
      for (const proof of execute(item.state, action, ANALYZER_BOUNDS)) {
        if (proof.status !== 'Verified' || !proof.terminal) continue;
        const m = measure(proof.terminal.payoff);
        for (const d of DIMENSIONS) best[d] = Math.max(best[d], m[d]);
        queue.push({ state: proof.terminal, depth: item.depth + 1 });
      }
    }
  }
  return best;
}

function validate(request: DiscoveryRequest) {
  if (!request || typeof request !== 'object' || request.version !== ANALYZER_VERSION || typeof request.id !== 'string' || !request.id.length || request.id.length > 200 || typeof request.revision !== 'string' || !request.revision.length || request.revision.length > 200) throw new Error('Malformed discovery request.');
  if (!Array.isArray(request.cards) || request.cards.length > ANALYZER_BOUNDS.cards || byteSize(request) > ANALYZER_BOUNDS.bytes) throw new Error('Discovery input exceeds the supported limit.');
  const ids = new Set(request.cards.map(c => c?.scryfallId));
  if (ids.size !== request.cards.length || typeof request.focusId !== 'string' || !ids.has(request.focusId)) throw new Error('Unknown focus card.');
  for (const list of [request.anchorIds, request.partnerIds]) if (!Array.isArray(list) || list.some(id => typeof id !== 'string' || !ids.has(id))) throw new Error('Unknown anchor or partner card.');
  if (!Number.isSafeInteger(request.library) || request.library < 0 || request.library > 500) throw new Error('Invalid hypothetical resources.');
}

/** Runs the bounded pass for one focus card. `now` is injectable for deterministic tests. */
export function discoverFocus(request: DiscoveryRequest, now: () => number = () => Date.now()): DiscoveryResult {
  validate(request);
  const metadata = new Map(request.cards.map(c => [c.scryfallId, c]));
  const compiled = new Map(request.cards.map(c => [c.scryfallId, compile(c)]));
  const name = (id: string) => metadata.get(id)?.name || 'Unlisted object';
  const focus = compiled.get(request.focusId)!;
  const plans = plan(compiled, request.focusId, request.anchorIds, request.partnerIds);
  const partners = [...new Set(request.partnerIds)].filter(id => id !== request.focusId && !isLand(compiled.get(id)!));
  const started = now(), reasons: string[] = [], groups = new Map<string, DiscoveryFinding & { partnerIds: Set<string> }>();
  let scenariosRun = 0, statesExplored = 0, truncated = false, skippedCosts = 0;
  const alone = new Map<Zone, Record<Dimension, number>>();
  const run = (placements: Placement[], mana: Mana, focusId?: string) => analyze({
    id: request.id, revision: request.revision, version: ANALYZER_VERSION, mode: 'scenario', focusId,
    cards: placements.map(p => metadata.get(p.id)!), selected: placements, mana, library: request.library,
  });
  const manaFor = (placements: Placement[]) => castingMana(placements.filter(p => p.zone === 'hand').map(p => metadata.get(p.id)!));
  /** Best focus-dependent chain in one scenario, measured against the same scenario without the
   * focus card (and without the mana assumed for casting it) plus the focus card entirely alone. */
  const evaluate = (placements: Placement[]) => {
    const mana = manaFor(placements);
    if (!mana) return 'unsupported' as const;
    let base: ReturnType<typeof analyze>;
    try { base = run(placements, mana, request.focusId); } catch { return 'unsupported' as const; }
    scenariosRun++; statesExplored += base.explored; truncated ||= base.truncated;
    // The focus card must contribute. Sitting on the battlefield only to be targeted or spent by
    // another card (its own text never used) is not evidence that it belongs in the deck.
    const usesOwnText = (p: typeof base.proofs[number]) => p.evidence.some(e => e.oracleId === focus.oracleId && e.kind !== 'rules' && e.kind !== 'printed-cost');
    const standing = placements.some(p => p.id === request.focusId && p.zone === 'battlefield');
    const dependent = base.proofs.filter(p => p.participants.includes(request.focusId) && p.participants.length > 1 && (!standing || usesOwnText(p)));
    if (!dependent.length) return null;
    const rest = placements.filter(p => p.id !== request.focusId);
    const without = baseline(metadata, rest, manaFor(rest) || emptyMana(), request.library);
    const own = placements.filter(p => p.id === request.focusId);
    if (!alone.has(own[0].zone)) alone.set(own[0].zone, baseline(metadata, own, manaFor(own) || emptyMana(), request.library));
    const solo = alone.get(own[0].zone)!;
    let best: { proof: typeof dependent[number]; gains: DiscoveryChange[]; total: number; placements: Placement[]; mana: Mana } | null = null;
    for (const proof of dependent) {
      const m = measure(proof.payoff);
      let gains = DIMENSIONS.map((d): DiscoveryChange => ({ dimension: d, added: m[d] - without[d] - solo[d], withFocus: m[d], withoutFocus: without[d], focusAlone: solo[d] })).filter(c => c.added > 0);
      // A created creature token is one object; report it once, as a token.
      const tokens = gains.find(g => g.dimension === 'tokens')?.added || 0;
      gains = gains.filter(g => g.dimension !== 'creatures' || g.added > tokens);
      const total = gains.reduce((n, g) => n + g.added, 0);
      if (gains.length && (!best || total > best.total || total === best.total && proof.actions.length < best.proof.actions.length)) best = { proof, gains, total, placements, mana };
    }
    return best;
  };
  const signature = (gains: DiscoveryChange[]) => JSON.stringify(gains.map(g => [g.dimension, g.added]));
  for (const item of plans) {
    if (scenariosRun >= DISCOVERY_BOUNDS.scenarios || now() - started > DISCOVERY_BOUNDS.budgetMs) { truncated = true; reasons.push('Scenario or time budget reached; remaining deck cards were not tested with this card.'); break; }
    const best = evaluate(item.placements);
    if (best === 'unsupported') { skippedCosts++; continue; }
    if (!best) continue;
    // Keep only cards the added production needs. A bystander is dropped when the same
    // scenario without it still adds the same production, so it is never named as required.
    const incidental = new Set<string>();
    for (const bystander of best.placements.filter(p => p.id !== request.focusId && p.id !== item.partner)) {
      const kept = best.placements.filter(p => p.id !== bystander.id), rest = kept.filter(p => p.id !== request.focusId);
      const keptMana = manaFor(kept); if (!keptMana) continue;
      const withFocus = baseline(metadata, kept, keptMana, request.library), without = baseline(metadata, rest, manaFor(rest) || emptyMana(), request.library), solo = alone.get(best.placements.find(p => p.id === request.focusId)!.zone)!;
      if (best.gains.every(g => withFocus[g.dimension] - without[g.dimension] - solo[g.dimension] >= g.added)) incidental.add(bystander.id);
    }
    const partnerUsed = !!item.partner && best.proof.participants.includes(item.partner);
    const required = best.proof.participants.filter(id => id !== request.focusId && id !== item.partner && metadata.has(id) && !incidental.has(id)).sort();
    const key = JSON.stringify([item.role, required, partnerUsed, signature(best.gains)]);
    let group = groups.get(key);
    if (!group) {
      if (groups.size >= DISCOVERY_BOUNDS.findings) { truncated = true; continue; }
      const dropped = new Set([...incidental].map(id => metadata.get(id)!.oracleId));
      const oracle = best.proof.evidence.filter(e => e.kind !== 'rules' && e.kind !== 'printed-cost' && !dropped.has(e.oracleId)).map(e => `${request.cards.find(c => c.oracleId === e.oracleId)?.name || 'Card'}: ${e.text}`);
      group = {
        role: item.role, required: required.map(id => ({ id, name: name(id) })), partners: [], partnersTruncated: false, partnerIds: new Set(),
        gains: best.gains, evidence: [...new Set(oracle)].slice(0, 8),
        branches: incidental.size ? [] : [...new Set(best.proof.checks.filter(c => c.role === 'branch').map(c => `${c.requirement}: ${c.result}`))].slice(0, 6),
        example: { placements: best.placements.filter(p => !incidental.has(p.id)).map(p => ({ ...p, name: name(p.id) })), mana: manaFor(best.placements.filter(p => !incidental.has(p.id))) || best.mana, steps: best.proof.actions.length },
      };
      groups.set(key, group);
    }
    if (partnerUsed && !group.partnerIds.has(item.partner!)) {
      group.partnerIds.add(item.partner!);
      if (group.partners.length < DISCOVERY_BOUNDS.partnersListed) group.partners.push({ id: item.partner!, name: name(item.partner!) }); else group.partnersTruncated = true;
    }
  }
  if (skippedCosts) reasons.push(`${skippedCosts} scenario(s) skipped: a casting cost or card layout is outside the supported subset.`);
  const findings = [...groups.values()].map(group => { const { partnerIds, ...finding } = group; void partnerIds; return finding; })
    // Presentation order only: chains witnessed with more deck cards first. Not a value ranking.
    .sort((a, b) => b.partners.length - a.partners.length || a.required.length - b.required.length || a.role.localeCompare(b.role));
  const result: DiscoveryResult = {
    id: request.id, revision: request.revision, version: ANALYZER_VERSION, focusId: request.focusId, focusName: name(request.focusId), findings,
    interpretation: { modeled: focus.abilities.length, unsupported: focus.unsupported.slice(0, 12), deferred: focus.deferred.slice(0, 12) },
    scenariosPlanned: plans.length, scenariosRun, partnersConsidered: partners.length, partnersNotTestable: partners.filter(id => compiled.get(id)!.unsupported.length > 0).length, statesExplored, truncated, reasons,
  };
  if (byteSize(result) > ANALYZER_BOUNDS.bytes) throw new Error('Discovery output exceeded the limit. Search is incomplete; saved data is unchanged.');
  return result;
}
