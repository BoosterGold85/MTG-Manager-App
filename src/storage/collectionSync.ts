// Cross-tab change notices. Purely advisory: revision-checked saves still reject stale writes.
const CHANNEL = "mtg-manager-collection";
export const TAB_ID = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random());
export interface CollectionChange {
  revision: number;
  source: string;
}
function channel(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL);
  } catch {
    return null;
  }
}
export function announceCollectionChange(revision: number) {
  const c = channel();
  if (!c) return;
  try {
    c.postMessage({ revision, source: TAB_ID } satisfies CollectionChange);
  } finally {
    c.close();
  }
}
// Notifies about saves made by OTHER tabs only.
export function subscribeCollectionChanges(listener: (change: CollectionChange) => void) {
  const c = channel();
  if (!c) return () => {};
  c.onmessage = (event: MessageEvent<CollectionChange>) => {
    const change = event.data;
    if (change && change.source !== TAB_ID && Number.isSafeInteger(change.revision)) listener(change);
  };
  return () => c.close();
}
