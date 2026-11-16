import { ANALYZER_BOUNDS, ANALYZER_VERSION, byteSize } from './protocol';
import { DISCOVERY_BOUNDS } from './discovery';
import type { DiscoveryRequest, DiscoveryResult } from './discovery';
import { analyzerAvailable, ANALYZER_BLOCKED_MESSAGE } from './activation';

export type DiscoveryResponse = { id: string; revision: string; version: string; result: DiscoveryResult } | { id: string; revision: string; version: string; error: string };
export interface DiscoveryWorker {
  onmessage: ((event: MessageEvent<DiscoveryResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage(request: DiscoveryRequest): void;
  terminate(): void;
}

/** One isolated worker per focus card. Terminating it cancels synchronous work; stale replies are ignored. */
export class DiscoveryClient {
  private serial = 0;
  private active: { worker: DiscoveryWorker; timer: ReturnType<typeof setTimeout>; reject: (error: Error) => void; serial: number } | null = null;
  constructor(private create: () => DiscoveryWorker = () => new Worker(new URL('./discovery.worker.ts', import.meta.url), { type: 'module' })) {}
  cancel() {
    ++this.serial;
    const active = this.active; this.active = null;
    if (active) { clearTimeout(active.timer); active.worker.terminate(); active.reject(new DOMException('Discovery cancelled or superseded.', 'AbortError')); }
  }
  run(input: Omit<DiscoveryRequest, 'id' | 'version'>): Promise<DiscoveryResult> {
    this.cancel();
    if (!analyzerAvailable()) return Promise.reject(new Error(ANALYZER_BLOCKED_MESSAGE));
    const serial = this.serial;
    return new Promise((resolve, reject) => {
      let worker: DiscoveryWorker | null = null;
      const finish = (error?: Error, result?: DiscoveryResult) => {
        if (this.active?.serial !== serial) return;
        const active = this.active; this.active = null;
        clearTimeout(active.timer); active.worker.terminate();
        if (error) reject(error); else resolve(result!);
      };
      try {
        const request = structuredClone({ ...input, id: String(serial), version: ANALYZER_VERSION });
        if (byteSize(request) > ANALYZER_BOUNDS.bytes) throw new Error('Discovery input exceeds the supported limit.');
        worker = this.create();
        const timer = setTimeout(() => finish(new Error('Discovery timed out for this card. The search is incomplete; saved data is unchanged.')), DISCOVERY_BOUNDS.timeoutMs);
        this.active = { worker, timer, reject, serial };
        worker.onmessage = ({ data }) => {
          if (!data || this.active?.serial !== serial || data.id !== request.id || data.revision !== request.revision || data.version !== ANALYZER_VERSION) return;
          try {
            if (byteSize(data) > ANALYZER_BOUNDS.bytes) throw new Error('Worker response exceeded the limit. Discovery is incomplete.');
            if ('error' in data) { finish(new Error(data.error)); return; }
            const result = data.result;
            if (!result || result.id !== request.id || result.revision !== request.revision || result.focusId !== request.focusId || !Array.isArray(result.findings) || !Number.isSafeInteger(result.scenariosRun)) throw new Error('Invalid worker response.');
            // A finding is only reportable when it names what the combination added and the text it relied on.
            for (const finding of result.findings) if (!Array.isArray(finding.gains) || !finding.gains.length || finding.gains.some(g => !(g.added > 0)) || !Array.isArray(finding.evidence) || !Array.isArray(finding.partners) || !Array.isArray(finding.required)) throw new Error('A discovery finding is missing its evidence.');
            finish(undefined, result);
          } catch (error) { finish(error instanceof Error ? error : new Error('Invalid worker response.')); }
        };
        worker.onerror = () => finish(new Error('The isolated worker failed. Saved data is unchanged.'));
        worker.onmessageerror = () => finish(new Error('The worker response could not be decoded. Saved data is unchanged.'));
        worker.postMessage(request);
      } catch (error) {
        if (this.active?.serial === serial) finish(error instanceof Error ? error : new Error('Discovery could not start.'));
        else { worker?.terminate(); reject(error instanceof Error ? error : new Error('Discovery could not start.')); }
      }
    });
  }
}
