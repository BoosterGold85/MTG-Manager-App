// Successor inference on the exposed regression pack. This module never receives gold labels or target payoffs.
import { performance } from 'node:perf_hooks';
import { actions, discover, execute, holdingsDelta, scenario } from '../../src/experimental/universal/engine';
import { compile, fingerprint } from '../../src/experimental/universal/compiler';
import type { Action, Mana, Proof, State, Zone } from '../../src/experimental/universal/model';
import type { CardMetadata } from '../../src/models/collection';

export interface Input {
  id: string;
  placements: { name: string; id: string; zone: Zone; controller?: 'you' | 'opponent'; counters?: Record<string, number> }[];
  actionMode: string;
  mana: Mana;
  priority?: boolean;
}
export interface Outcome {
  status: string;
  checks: Proof['checks'];
  prerequisites: string[];
  events: Proof['events'];
  payoff?: State['payoff'];
  spent?: State['spent'];
  delta?: ReturnType<typeof holdingsDelta>;
  actions: Action[];
  finalObjects?: { id: string; zone: Zone; types: string[] }[];
}
export function inputState(input: Input, lookup: (name: string) => CardMetadata): State {
  return scenario(input.placements.map(p => ({ ...p, card: lookup(p.name) })), { mana: input.mana, priority: input.priority ?? true });
}
function outcome(before: State, p: Proof, path: Action[]): Outcome {
  return { status: p.status, checks: p.checks, prerequisites: p.prerequisites, events: p.terminal?.events.slice(before.events.length) || p.events,
    payoff: p.terminal?.payoff, spent: p.terminal?.spent, delta: p.terminal && holdingsDelta(before, p.terminal), actions: path,
    finalObjects: p.terminal?.objects.map(o => ({ id: o.instance, zone: o.zone, types: o.card.types })) };
}
export function infer(input: Input, lookup: (name: string) => CardMetadata) {
  const before = inputState(input, lookup), start = performance.now();
  const source = input.actionMode === 'cast-followup' ? 'followup' : 'root';
  const action: Action = input.actionMode === 'activate'
    ? { kind: 'activate', instance: source, ability: before.objects.find(o => o.instance === source)!.card.abilities.find(a => a.kind === 'activated')?.id || 'not-interpreted' }
    : { kind: 'cast', instance: source };
  let primary: Outcome[];
  if (input.actionMode === 'end-step') {
    primary = [{ status: 'Unknown', checks: [], prerequisites: [`The frozen API cannot express ${input.actionMode} procedures; no substitute permission or clock is fabricated.`], events: [], actions: [] }];
  } else {
    const candidates = input.actionMode === 'activate' ? actions(before).filter(a => a.instance === source && a.kind === 'activate') : input.actionMode === 'graveyard-cast' ? actions(before).filter(a => a.instance === source && a.kind === 'cast') : [action];
    const first = candidates.length ? candidates.flatMap(a => execute(before, a)) : execute(before, action);
    primary = first.map(p => outcome(before, p, [p.action]));
    if (input.actionMode === 'double-spend') {
      primary = first.flatMap(p => p.status === 'Verified' && p.terminal
        ? execute(p.terminal, { kind: 'cast', instance: 'second' }).map(second => outcome(before, { ...second, checks: [...p.checks, ...second.checks] }, [p.action, second.action]))
        : [outcome(before, p, [p.action])]);
    }
  }
  // No partners, desired event, archetype or gold answer is provided to discovery.
  const discovery = discover(before);
  return {
    id: input.id, milliseconds: performance.now() - start,
    primary, paths: discovery.paths.map(p => outcome(before, p.proof, p.actions)),
    explored: discovery.explored, truncated: discovery.truncated,
    rejections: discovery.rejections,
    coverage: discovery.coverage,
    initialObjects: before.objects.map(o => ({ id: o.instance, name: o.card.name, key: o.card.key, unsupported: o.card.unsupported, deferred: o.card.deferred })),
  };
}
export function benchmarkDeck(rows: { name: string; quantity: number }[], lookup: (name: string) => CardMetadata) {
  const start = performance.now();
  const metadata = rows.map(r => ({ ...r, card: lookup(r.name) }));
  const coverage = metadata.map(r => ({ name: r.name, quantity: r.quantity, land: /\bLand\b/.test(r.card.typeLine), parsed: compile(r.card) }));
  const compileMs = performance.now() - start;
  const placements = metadata.flatMap((r, i) => Array.from({ length: r.quantity }, (_, copy) => ({ card: r.card, id: `entry-${i}-${copy}`, zone: /\b(?:Instant|Sorcery)\b/.test(r.card.typeLine) ? 'hand' as const : 'battlefield' as const })));
  const s = scenario(placements, { mana: { W: 20, U: 20, B: 20, R: 20, G: 20, C: 20 } });
  const t = performance.now(), result = discover(s), queryMs = performance.now() - t;
  return {
    copies: rows.reduce((n, r) => n + r.quantity, 0), uniqueEntries: rows.length,
    compileMs, queryMs, explored: result.explored, truncated: result.truncated, verifiedPaths: result.paths.length,
    representativeRejections: result.rejections.slice(0, 3),
    projection: 'All permanents assumed on battlefield, spells in hand, supplied mana. Diagnostic load projection, not a valid opening hand, strategy model, assembly probability, or deck-level proof. No unsupported card is filtered away.',
    nonlandCopies: coverage.filter(c => !c.land).reduce((n, r) => n + r.quantity, 0),
    fullyParsedNoncombatCopies: coverage.filter(c => !c.land && !c.parsed.unsupported.length).reduce((n, r) => n + r.quantity, 0),
    cards: coverage.map(c => ({ name: c.name, quantity: c.quantity, land: c.land, abilities: c.parsed.abilities.length, unsupported: c.parsed.unsupported, deferred: c.parsed.deferred })),
    determinismKey: fingerprint([result.paths.map(p => p.proof.events), result.explored, result.truncated]),
  };
}
export const exposedActions = actions;
