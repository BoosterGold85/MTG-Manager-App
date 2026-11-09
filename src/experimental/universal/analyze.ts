import type { CardMetadata } from '../../models/collection';
import { compile } from './compiler';
import { candidates } from './candidates';
import { discover, scenario, holdingsDelta } from './engine';
import { emptyMana } from './model';
import { ANALYZER_VERSION, ANALYZER_BOUNDS, byteSize } from './protocol';
import type { AnalyzerRequest } from './protocol';
export { ANALYZER_VERSION } from './protocol';
export type { AnalyzerRequest } from './protocol';
function validate(request: AnalyzerRequest): void {
  if (!request || typeof request !== 'object' || request.version !== ANALYZER_VERSION || typeof request.id !== 'string' || !request.id.length || request.id.length > 200 || typeof request.revision !== 'string' || !request.revision.length || request.revision.length > 200 || !Array.isArray(request.cards) || !Array.isArray(request.selected)) throw new Error('Malformed analysis request.');
  if (request.cards.length > ANALYZER_BOUNDS.cards || byteSize(request) > ANALYZER_BOUNDS.bytes) throw new Error('Analysis input exceeds the supported limit.');
  if (request.selected.length > ANALYZER_BOUNDS.selected || new Set(request.selected.map(s => s?.id)).size !== request.selected.length) throw new Error('Select up to three distinct cards.');
  const ids = new Set<string>();
  for (const c of request.cards) {
    if (!c || typeof c.scryfallId !== 'string' || !c.scryfallId.length || ids.has(c.scryfallId) || typeof c.name !== 'string' || typeof c.typeLine !== 'string' || !Number.isFinite(c.manaValue) || c.manaValue < 0 || c.oracleText != null && typeof c.oracleText !== 'string' || c.manaCost != null && typeof c.manaCost !== 'string' || c.cardFaces !== undefined && (!Array.isArray(c.cardFaces) || c.cardFaces.some(f => !f || typeof f.name !== 'string')) || [c.colors, c.keywords, c.aliases].some(a => a !== undefined && (!Array.isArray(a) || a.some(x => typeof x !== 'string')))) throw new Error('Invalid or duplicate canonical card metadata.');
    ids.add(c.scryfallId);
  }
  if (!request.mana || Object.keys(request.mana).length !== 6 || !Object.keys(emptyMana()).every(c => Number.isSafeInteger(request.mana[c as keyof typeof request.mana]) && request.mana[c as keyof typeof request.mana] >= 0 && request.mana[c as keyof typeof request.mana] <= 20) || !Number.isSafeInteger(request.library) || request.library < 0 || request.library > 500) throw new Error('Invalid hypothetical resources.');
  for (const s of request.selected) if (!s || !ids.has(s.id) || !['hand', 'battlefield', 'graveyard'].includes(s.zone)) throw new Error('Invalid selected card or zone.');
  if (request.focusId !== undefined && !ids.has(request.focusId)) throw new Error('Unknown focus card.');
  if (request.mode === 'catalog' && request.selected.length) throw new Error('A catalog-only scan cannot claim a game-state search.');
  if (request.mode !== undefined && !['catalog','scenario','deck-candidates'].includes(request.mode)) throw new Error('Invalid analysis mode.');
  if (request.removeId !== undefined && !(request.mode === 'deck-candidates' ? ids.has(request.removeId) : request.selected.some(s => s.id === request.removeId))) throw new Error('Counterfactual removal must name a selected participant.');
  if (request.copies) for (const [id, copies] of Object.entries(request.copies)) if (!ids.has(id) || !Number.isSafeInteger(copies) || copies < 1 || copies > 10000) throw new Error('Invalid deck-copy count.');
}
function search(request: AnalyzerRequest, metadata: Map<string, CardMetadata>, selected = request.selected, budget: number = ANALYZER_BOUNDS.states) {
  const placements = selected.map(s => ({ card: metadata.get(s.id)!, id: s.id, zone: s.zone, ready: s.zone === 'battlefield', tapped: false }));
  const initial = scenario(placements, { mana: request.mana, library: request.library });
  const found = placements.length ? discover(initial, { ...ANALYZER_BOUNDS, states: budget }) : null;
  return {
    selected: placements.map(p => ({ id: p.id, name: p.card.name, zone: p.zone })), assumptions: initial.assumptions,
    explored: found?.explored || 0, truncated: found?.truncated || false, reasons: found?.reasons || [], rejections: found?.rejections || [],
    proofs: (found?.paths || []).filter(path=>!request.focusId||path.proof.participants.includes(request.focusId)).map(path => ({ scenario: placements.map(p => ({ id:p.id, name:p.card.name, zone:p.zone })), actions: path.actions, status: path.proof.status, complete: path.proof.complete, evidence: path.proof.evidence, events: path.proof.events, checks: path.proof.checks, participants: path.proof.participants, prerequisites: path.proof.prerequisites, assumptions: path.proof.assumptions, payoff: path.proof.terminal?.payoff, spent: path.proof.terminal?.spent, holdings: path.proof.terminal ? holdingsDelta(initial, path.proof.terminal) : null, searchTruncated: path.proof.searchTruncated })),
  };
}
export function analyze(request: AnalyzerRequest) {
  validate(request);
  const metadata = new Map(request.cards.map(c => [c.scryfallId, c]));
  const cards = request.cards.map(c => ({ id: c.scryfallId, ...compile(c) }));
  const mode = request.mode || (request.selected.length ? 'scenario' : 'catalog');
  const run = (removed?:string) => {
    if(mode!=='deck-candidates')return {...search(request,metadata,request.selected.filter(s=>s.id!==removed)),contextsAttempted:request.selected.length?1:0,candidateComparisons:0};
    const index=candidates(cards,removed,request.mana), result={...search(request,metadata,[]),contextsAttempted:0,candidateComparisons:index.comparisons};
    result.truncated=index.truncated;
    for(const c of index.cases.filter(c=>!request.focusId||c.selected.some(s=>s.id===request.focusId))) {
      if(result.explored>=ANALYZER_BOUNDS.states||result.proofs.length>=ANALYZER_BOUNDS.proofs){result.truncated=true;break;}
      const scoped=search(request,metadata,c.selected,ANALYZER_BOUNDS.states-result.explored);
      result.contextsAttempted++;result.explored+=scoped.explored;result.truncated ||= scoped.truncated;
      result.proofs.push(...scoped.proofs.slice(0,ANALYZER_BOUNDS.proofs-result.proofs.length));
      result.rejections.push(...scoped.rejections.slice(0,ANALYZER_BOUNDS.proofs-result.rejections.length));
    }
    if(result.truncated)result.reasons.push('Candidate/index/search bounds reached; other cards and longer chains remain untested.');
    return result;
  };
  const base = run();
  const copyCount = (id: string) => request.copies?.[id] ?? 1;
  const nonlands = cards.filter(c => !c.types.includes('Land'));
  const coverage = { distinct: cards.length, copies: cards.reduce((n, c) => n + copyCount(c.id), 0), nonlandDistinct: nonlands.length, nonlandCopies: nonlands.reduce((n, c) => n + copyCount(c.id), 0), parsedNoncombatDistinct: nonlands.filter(c => !c.unsupported.length).length, parsedNoncombatCopies: nonlands.filter(c => !c.unsupported.length).reduce((n, c) => n + copyCount(c.id), 0), unsupportedDistinct: cards.filter(c => c.unsupported.length).length, deferredDistinct: cards.filter(c => c.deferred.length).length, nonlandDefinition: 'Saved type lines containing Land are excluded; special layouts remain listed as unsupported.', wholeDeckConclusion: false as const };
  const counterfactual = request.removeId === undefined ? null : { removedId: request.removeId, affectedPaths: base.proofs.filter(p => p.participants.includes(request.removeId!)).length, ...run(request.removeId) };
  const result = { id: request.id, revision: request.revision, version: ANALYZER_VERSION, mode, cards, coverage, ...base, counterfactual, totalExplored: base.explored + (counterfactual?.explored || 0) };
  if (byteSize(result) > ANALYZER_BOUNDS.bytes) throw new Error('Analysis output exceeded the limit. Search is incomplete; saved data is unchanged.');
  return result;
}
export type AnalyzerResult = ReturnType<typeof analyze>;
