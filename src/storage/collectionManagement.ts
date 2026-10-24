import { emptyCollection } from '../models/collection';
import type { CollectionRepository, CollectionState } from '../models/collection';

export function collectionStats(state: CollectionState | null) {
  return (state?.items || []).reduce((total, item) => ({
    records: total.records + 1,
    owned: total.owned + item.quantityOwned,
    assigned: total.assigned + item.quantityAssigned,
    unassigned: total.unassigned + item.quantityUnassigned,
  }), { records: 0, owned: 0, assigned: 0, unassigned: 0 });
}

// Use the same revision-checked atomic snapshot write as the importer.
export async function changeCollection(repository: CollectionRepository, base: CollectionState,
  action: { type: 'remove'; ids: string[] } | { type: 'clear' }) {
  const removed = new Set(action.type === 'remove' ? action.ids : []);
  const next: CollectionState = action.type === 'clear'
    ? { ...emptyCollection(), revision: base.revision + 1 }
    : { ...base, revision: base.revision + 1,
        items: base.items.filter(item => !removed.has(item.id)) };
  await repository.save(next, base.revision);
  return next;
}

export async function collectionBackup(repository: CollectionRepository) {
  const state = await repository.load() || emptyCollection();
  return JSON.stringify({ application: 'MTG Manager', applicationVersion: '0.3.1',
    exportedAt: new Date().toISOString(), schemaVersion: state.schemaVersion,
    collection: state }, null, 2);
}
