import { it, expect, vi, afterEach } from 'vitest';
import { AnalyzerClient } from '../../src/experimental/universal/client';
import type { AnalyzerWorker } from '../../src/experimental/universal/client';
import { analyze, ANALYZER_VERSION } from '../../src/experimental/universal/analyze';
import { analyzerAvailable } from '../../src/experimental/universal/activation';
import type { AnalyzerRequest, AnalyzerResponse } from '../../src/experimental/universal/protocol';
import { ANALYZER_BOUNDS } from '../../src/experimental/universal/protocol';
import { emptyMana } from '../../src/experimental/universal/model';
import { oracleCard } from '../upgradeCandidates';
vi.mock('../../src/experimental/universal/activation', () => ({ analyzerAvailable: vi.fn(() => true), ANALYZER_BLOCKED_MESSAGE: 'Execution is not enabled.' }));
class FakeWorker implements AnalyzerWorker {
  onmessage: AnalyzerWorker['onmessage'] = null; onerror: AnalyzerWorker['onerror'] = null; onmessageerror: AnalyzerWorker['onmessageerror'] = null;
  request!: AnalyzerRequest; terminated = 0;
  postMessage(request: AnalyzerRequest) { this.request = request; }
  terminate() { this.terminated++; }
  reply(data: AnalyzerResponse) { this.onmessage?.({ data } as MessageEvent<AnalyzerResponse>); }
  success() { this.reply({ id: this.request.id, revision: this.request.revision, version: ANALYZER_VERSION, result: analyze(this.request) }); }
}
const input = () => ({ revision: 'r', cards: [oracleCard('Plain', '{1}', 1, 'Artifact', '', [])], selected: [], mana: emptyMana(), library: 40 });
afterEach(() => { vi.useRealTimers(); vi.mocked(analyzerAvailable).mockReturnValue(true); });
it('cannot start a worker when rollout is blocked', async () => {
  vi.mocked(analyzerAvailable).mockReturnValue(false); const factory = vi.fn();
  await expect(new AnalyzerClient(factory).run(input())).rejects.toThrow('not enabled'); expect(factory).not.toHaveBeenCalled();
});
it('terminates the successful worker and snapshots its input', async () => {
  const worker = new FakeWorker(), client = new AnalyzerClient(() => worker), request = input();
  const promise = client.run(request); request.cards[0].name = 'Changed after request'; worker.success();
  const result = await promise; expect(result.cards[0].name).toBe('Plain'); expect(worker.terminated).toBe(1);
});
it('terminates and rejects cancellation; ignores a late queued success', async () => {
  const worker = new FakeWorker(), client = new AnalyzerClient(() => worker);
  const promise = client.run(input()), rejected = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  client.cancel(); worker.success(); await rejected; expect(worker.terminated).toBe(1);
});
it('supersedes a busy worker; queued stale responses cannot replace a new revision', async () => {
  const workers = [new FakeWorker(), new FakeWorker()]; let index = 0;
  const client = new AnalyzerClient(() => workers[index++]);
  const first = client.run(input()), aborted = expect(first).rejects.toMatchObject({ name: 'AbortError' });
  const second = client.run({ ...input(), revision: 'new' }); workers[0].success(); workers[1].success();
  expect((await second).revision).toBe('new'); await aborted; expect(workers.map(w => w.terminated)).toEqual([1, 1]);
});
it('ignores wrong identities and versions, then accepts a current reply', async () => {
  const worker = new FakeWorker(), client = new AnalyzerClient(() => worker), promise = client.run(input());
  const result = analyze(worker.request);
  worker.reply({ id: 'stale', revision: 'r', version: ANALYZER_VERSION, result });
  worker.reply({ id: worker.request.id, revision: 'old', version: ANALYZER_VERSION, result });
  worker.reply({ id: worker.request.id, revision: 'r', version: 'old', result });
  expect(worker.terminated).toBe(0); worker.success(); await promise; expect(worker.terminated).toBe(1);
});
it('enforces the deadline by terminating CPU work', async () => {
  vi.useFakeTimers(); const worker = new FakeWorker(), promise = new AnalyzerClient(() => worker).run(input());
  const rejected = expect(promise).rejects.toThrow('timed out'); await vi.advanceTimersByTimeAsync(ANALYZER_BOUNDS.timeoutMs); await rejected; expect(worker.terminated).toBe(1);
});
for (const mode of ['constructor', 'post', 'worker', 'decode'] as const) it(`fails safely on ${mode} failure`, async () => {
  const worker = new FakeWorker();
  if (mode === 'post') worker.postMessage = () => { throw new Error('post failed'); };
  const promise = new AnalyzerClient(() => { if (mode === 'constructor') throw new Error('constructor failed'); return worker; }).run(input());
  const rejected = expect(promise).rejects.toThrow();
  if (mode === 'worker') worker.onerror?.({} as ErrorEvent); if (mode === 'decode') worker.onmessageerror?.({} as MessageEvent);
  await rejected; expect(worker.terminated).toBe(mode === 'constructor' ? 0 : 1);
});
it('does not transport oversized requests', async () => {
  const factory = vi.fn(); await expect(new AnalyzerClient(factory).run({ ...input(), revision: 'x'.repeat(ANALYZER_BOUNDS.bytes) })).rejects.toThrow('limit'); expect(factory).not.toHaveBeenCalled();
});
it('rejects a worker certificate with a failed mandatory predicate', async () => {
  const worker = new FakeWorker(), promise = new AnalyzerClient(() => worker).run(input()), rejected = expect(promise).rejects.toThrow(/mandatory|certification/);
  const result = analyze(worker.request); result.proofs.push({ status: 'Verified', complete: true, checks: [{ role: 'required', result: false, requirement: 'Illegal target' }], events: [], participants: [], evidence: [] } as unknown as typeof result.proofs[number]);
  worker.reply({ id: worker.request.id, revision: 'r', version: ANALYZER_VERSION, result }); await rejected; expect(worker.terminated).toBe(1);
});
