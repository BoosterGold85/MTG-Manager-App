import { useState } from 'react';
import { Dialog } from './Dialog';
import { collectionRepository } from '../storage/collectionRepository';
import { collectionBackup, collectionStats } from '../storage/collectionManagement';
import type { CollectionState } from '../models/collection';
export function ManageCollection({ state, onClose, onClear, onRecalculate, tagging, tagStatus }: {
  onRecalculate?: () => void; tagging?: boolean; tagStatus?: string;
  state: CollectionState | null; onClose: () => void; onClear: () => void;
}) {
  const stats = collectionStats(state);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function backup() {
    setBusy(true); setError('');
    let url = '';
    try {
      const json = await collectionBackup(collectionRepository);
      url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `mtg-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(anchor); anchor.click(); anchor.remove();
    } catch { setError('Could not export your backup. Allow downloads and site storage, then try again.'); }
    finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 1000); setBusy(false); }
  }
  return <Dialog titleId="manage-title" onClose={onClose} className="management-dialog">
    <p className="eyebrow">YOUR LOCAL BINDER</p><h2 id="manage-title">Manage Collection</h2>
    <dl className="management-stats">
      <div><dt>Unique records</dt><dd>{stats.records.toLocaleString()}</dd></div>
      <div><dt>Physical cards</dt><dd>{stats.owned.toLocaleString()}</dd></div>
      <div><dt>Assigned</dt><dd>{stats.assigned.toLocaleString()}</dd></div>
      <div><dt>Unassigned</dt><dd>{stats.unassigned.toLocaleString()}</dd></div>
    </dl>
    <p><strong>Stored on this device</strong></p>
    <p>Collection data is currently stored locally in this browser. Keep your original ManaBox export as a backup.</p>
    {!state && <p>The sample binder is a demo, not your stored collection.</p>}
    <p>Last successful import: {state?.lastImport ? <><time dateTime={state.lastImport.importedAt}>{new Date(state.lastImport.importedAt).toLocaleString()}</time> · {state.lastImport.filename}</> : 'No successful import yet'}</p>
    {error && <p role="alert">{error}</p>}
    <button className="primary-button" disabled={busy} onClick={backup}>{busy ? 'Exporting…' : 'Export Backup'}</button>
    {onRecalculate && <div className="retag-control"><button className="management-button" disabled={tagging || !state?.items.length} onClick={onRecalculate}>Recalculate Auto-Tags</button>{tagStatus && <p role="status">{tagStatus}</p>}</div>}
    <div className="danger-zone"><button className="danger-button" disabled={!state || tagging} onClick={onClear}>Clear Collection</button></div>
  </Dialog>;
}
