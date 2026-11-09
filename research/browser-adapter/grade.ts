import type { Outcome } from './infer';
import type { infer } from './infer';
export interface Gold { id: string; family: string; truth: boolean; claim: string; minimum: number; requiresFollowup?: boolean; actionMode: string; negative?: string }
type Prediction = ReturnType<typeof infer>;
function satisfies(o: Outcome, gold: Gold): boolean {
  if (o.status !== 'Verified') return false;
  if (gold.requiresFollowup && !['action-legal', 'two-casts-legal'].includes(gold.claim) && !o.actions.some(a => a.instance === 'followup')) return false;
  switch (gold.claim) {
    case 'action-legal': return true;
    case 'two-casts-legal': return o.actions.length === 2;
    case 'draw': return (o.payoff?.draw || 0) >= gold.minimum;
    case 'tokens': return (o.payoff?.tokens || 0) >= gold.minimum;
    case 'counters': return (o.payoff?.counters || 0) >= gold.minimum;
    case 'mana-generated': return Object.values(o.payoff?.manaGenerated || {}).reduce((n, v) => n + v, 0) >= gold.minimum;
    case 'artifact-removed': return !!o.finalObjects?.some(x => x.id === 'opponent-artifact' && x.zone === 'graveyard');
    case 'opponent-creature-removed': return !!o.finalObjects?.some(x => x.id === 'opponent-creature' && x.zone === 'graveyard');
    case 'opponent-discard': return o.events.some(e => e.kind === 'discard' && e.subject === 'opponent-hand');
    // Finite replay and graph cycles cannot certify repeatability.
    case 'repeatability': return false;
    default: throw new Error(`Unregistered gold claim ${gold.claim}`);
  }
}
export function grade(gold: Gold, prediction: Prediction) {
  const choices = gold.requiresFollowup && !['action-legal', 'two-casts-legal'].includes(gold.claim) ? prediction.paths : prediction.primary;
  const positive = choices.some(o => satisfies(o, gold));
  const relevantUnknown = prediction.primary.some(o => o.status === 'Unknown');
  const conditional = prediction.primary.some(o => o.status === 'Conditional');
  const status = positive ? 'Verified' : relevantUnknown ? 'Unknown' : conditional ? 'Conditional' : prediction.truncated ? 'Unknown' : 'NotEstablished';
  const independentDiscovery = prediction.paths.some(o => satisfies(o, gold) && o.events.some(e => e.parents.length && e.participants.filter(id => prediction.initialObjects.some(c => c.id === id)).length >= 2));
  return {
    id: gold.id, family: gold.family, truth: gold.truth, claim: gold.claim, status, positive,
    correctPositive: gold.truth && positive, falsePositive: !gold.truth && positive,
    missedPositive: gold.truth && !positive,
    independentDiscovery,
    rejected: !positive && prediction.primary.some(o => o.status === 'Invalid'),
    reasons: [...new Set(prediction.primary.flatMap(o => o.prerequisites))],
    unsupported: prediction.initialObjects.filter(o => o.unsupported.length).map(o => ({ name: o.name, lines: o.unsupported })),
  };
}
export function wilson(successes: number, trials: number) {
  if (!trials) return { value: null, lower: null, upper: null, successes, trials };
  const z = 1.959963984540054, p = successes / trials, d = 1 + z * z / trials;
  const center = (p + z * z / (2 * trials)) / d;
  const half = z * Math.sqrt(p * (1 - p) / trials + z * z / (4 * trials * trials)) / d;
  return { value: p, lower: Math.max(0, center - half), upper: Math.min(1, center + half), successes, trials };
}
export function metrics(rows: ReturnType<typeof grade>[]) {
  const tp = rows.filter(r => r.correctPositive).length, fp = rows.filter(r => r.falsePositive).length;
  const positives = rows.filter(r => r.truth).length, negatives = rows.length - positives;
  return {
    total: rows.length, positives, negatives, truePositives: tp, falsePositives: fp, falseNegatives: positives - tp,
    precision: wilson(tp, tp + fp), recall: wilson(tp, positives),
    unsafeCertification: wilson(fp, negatives),
    abstentions: rows.filter(r => r.status === 'Unknown' || r.status === 'Conditional').length,
    unknown: rows.filter(r => r.status === 'Unknown').length, conditional: rows.filter(r => r.status === 'Conditional').length,
    explicitInvalidRejections: rows.filter(r => !r.truth && r.rejected).length,
    intervalCaveat: 'Descriptive case-level Wilson intervals. Cases are clustered by template/family and are not random independent population samples; these intervals do not establish unseen-deck accuracy.',
  };
}
export function ready(gates: Record<string, boolean>) {
  return Object.entries(gates).filter(([name]) => name !== 'experimentalAnalyzerReady').every(([, pass]) => pass);
}
