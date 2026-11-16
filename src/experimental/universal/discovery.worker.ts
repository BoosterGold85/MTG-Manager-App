import { discoverFocus } from './discovery';
import type { DiscoveryRequest } from './discovery';
import { analyzerAvailable, ANALYZER_BLOCKED_MESSAGE } from './activation';
import { ANALYZER_BOUNDS, ANALYZER_VERSION, byteSize } from './protocol';
// Same isolation contract as analyzer.worker.ts: read-only input, bounded output, no storage or network.
self.onmessage = (event: MessageEvent<DiscoveryRequest>) => {
  const id = typeof event.data?.id === 'string' ? event.data.id.slice(0, 200) : '';
  const revision = typeof event.data?.revision === 'string' ? event.data.revision.slice(0, 200) : '';
  try {
    if (!analyzerAvailable()) throw new Error(ANALYZER_BLOCKED_MESSAGE);
    const response = { id, revision, version: ANALYZER_VERSION, result: discoverFocus(event.data) };
    if (byteSize(response) > ANALYZER_BOUNDS.bytes) throw new Error('Discovery output exceeded the supported limit.');
    self.postMessage(response);
  } catch (error) {
    self.postMessage({ id, revision, version: ANALYZER_VERSION, error: error instanceof Error ? error.message.slice(0, 500) : 'Discovery failed.' });
  }
};
