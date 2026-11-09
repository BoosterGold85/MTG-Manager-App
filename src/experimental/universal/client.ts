import { ANALYZER_BOUNDS, ANALYZER_VERSION, byteSize } from './protocol';
import type { AnalyzerRequest, AnalyzerResponse } from './protocol';
import type { AnalyzerResult } from './analyze';
import { analyzerAvailable, ANALYZER_BLOCKED_MESSAGE } from './activation';
export interface AnalyzerWorker {
  onmessage: ((event: MessageEvent<AnalyzerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage(request: AnalyzerRequest): void;
  terminate(): void;
}
/** A separate read-only worker; termination cancels synchronous CPU work as well. */
export class AnalyzerClient {
  private serial = 0;
  private active: { worker: AnalyzerWorker; timer: ReturnType<typeof setTimeout>; reject: (error: Error) => void; serial: number } | null = null;
  constructor(private create: () => AnalyzerWorker = () => new Worker(new URL('./analyzer.worker.ts', import.meta.url), { type: 'module' })) {}
  cancel() {
    ++this.serial;
    const active = this.active; this.active = null;
    if (active) { clearTimeout(active.timer); active.worker.terminate(); active.reject(new DOMException('Analysis cancelled or superseded.', 'AbortError')); }
  }
  run(input: Omit<AnalyzerRequest, 'id' | 'version'>): Promise<AnalyzerResult> {
    this.cancel();
    if (!analyzerAvailable()) return Promise.reject(new Error(ANALYZER_BLOCKED_MESSAGE));
    const serial = this.serial;
    return new Promise((resolve, reject) => {
      let worker: AnalyzerWorker | null = null;
      const finish = (error?: Error, result?: AnalyzerResult) => {
        if (this.active?.serial !== serial) return;
        const active = this.active; this.active = null;
        clearTimeout(active.timer); active.worker.terminate();
        if (error) reject(error); else resolve(result!);
      };
      try {
        const request = structuredClone({ ...input, id: String(serial), version: ANALYZER_VERSION });
        if (byteSize(request) > ANALYZER_BOUNDS.bytes) throw new Error('Analysis input exceeds the supported limit.');
        worker = this.create();
        const timer = setTimeout(() => finish(new Error('Analysis timed out. Search is incomplete; saved data is unchanged.')), ANALYZER_BOUNDS.timeoutMs);
        this.active = { worker, timer, reject, serial };
        worker.onmessage = ({ data }) => {
          if (!data || this.active?.serial !== serial || data.id !== request.id || data.revision !== request.revision || data.version !== ANALYZER_VERSION) return;
          try {
            if (byteSize(data) > ANALYZER_BOUNDS.bytes) throw new Error('Worker response exceeded the limit. Analysis is incomplete.');
            if ('error' in data) { finish(new Error(data.error)); return; }
            const result = data.result;
            if (!result || result.id !== request.id || result.revision !== request.revision || result.version !== ANALYZER_VERSION || !Array.isArray(result.proofs) || !Array.isArray(result.cards) || !Array.isArray(result.selected) || !Array.isArray(result.rejections) || !result.coverage || !Number.isSafeInteger(result.coverage.distinct)) throw new Error('Invalid worker response.');
            for (const proof of [...result.proofs, ...(result.counterfactual?.proofs || [])]) if (proof.status !== 'Verified' || proof.complete !== true || !Array.isArray(proof.checks) || !Array.isArray(proof.events) || !Array.isArray(proof.participants) || !Array.isArray(proof.evidence) || proof.checks.some(check => check.role === 'required' && check.result !== true)) throw new Error('An unresolved required check prevents certification.');
            finish(undefined, result);
          } catch (error) { finish(error instanceof Error ? error : new Error('Invalid worker response.')); }
        };
        worker.onerror = () => finish(new Error('The isolated worker failed. Saved data is unchanged.'));
        worker.onmessageerror = () => finish(new Error('The worker response could not be decoded. Saved data is unchanged.'));
        worker.postMessage(request);
      } catch (error) {
        if (this.active?.serial === serial) finish(error instanceof Error ? error : new Error('Analysis could not start.'));
        else { worker?.terminate(); reject(error instanceof Error ? error : new Error('Analysis could not start.')); }
      }
    });
  }
}
