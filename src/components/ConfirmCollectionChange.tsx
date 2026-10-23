import { useRef, useState } from 'react';
import { Dialog } from './Dialog';
import { changeCollection, collectionStats } from '../storage/collectionManagement';
import { collectionRepository } from '../storage/collectionRepository';
import type { CollectionState } from '../models/collection';
export function ConfirmCollectionChange({ state, ids, clear, onClose, onSaved }: {
  state: CollectionState; ids: string[]; clear: boolean; onClose: () => void;
  onSaved: (state: CollectionState) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const committing = useRef(false);
  const count = ids.length;
  const stats = collectionStats(state);
  async function confirm() {
    if (committing.current) return;
    committing.current = true; setBusy(true); setError('');
    try {
      const next = await changeCollection(collectionRepository, state,
        clear ? { type: 'clear' } : { type: 'remove', ids });
      onSaved(next);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save. Please retry.'); }
    finally { committing.current = false; setBusy(false); }
  }
  return <Dialog titleId="confirmation-title" onClose={onClose} closeDisabled={busy} className="management-dialog">
    <p className="eyebrow">COLLECTION MANAGEMENT</p>
    <h2 id="confirmation-title">{clear ? 'Clear your collection?' : `Remove ${count} collection ${count === 1 ? 'record' : 'records'}?`}</h2>
    <p>{clear ? `This will remove ${stats.records.toLocaleString()} collection records representing ${stats.owned.toLocaleString()} physical cards from MTG Manager on this browser.` : 'This removes these cards from MTG Manager on this device.'}</p>
    <p>Your ManaBox collection and original CSV files will not be changed. If these cards are still included in a future ManaBox export, importing that export may add them again.</p>
    {clear && <label className="clear-confirmation">Type CLEAR to confirm<input aria-label="Type CLEAR to confirm" value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="off" /></label>}
    {error && <p role="alert">{error}</p>}
    <div className="confirmation-actions"><button className="primary-button" onClick={onClose} disabled={busy}>Cancel</button>
    <button className="danger-button" onClick={confirm} disabled={busy || (clear && confirmation !== 'CLEAR')}>{busy ? 'Saving…' : clear ? 'Clear Collection' : `Remove ${count}`}</button></div>
  </Dialog>;
}
