'use client';

import { useState } from 'react';
import { targetColumns } from '@/lib/import/schema';
import { IMPORT_TYPES, type ImportType } from '@/lib/import/types';
import { importBatchAction, rollbackBatchAction, stageUploadAction, validateBatchAction } from './actions';

type Stage = { batchId: string; importType: ImportType; importMode: string; headers: string[]; mapping: Record<string, string>; preview: Record<string, string>[] };
type Validation = { success: number; warning: number; error: number };
type HistoryRow = { batch_id: string; file_name: string; import_type: string; import_mode: string; total_rows: number; success_rows: number; warning_rows: number; error_rows: number; status: string; uploaded_at: string };

export default function ImportClient({ history }: { history: HistoryRow[] }) {
  const [stage, setStage] = useState<Stage>();
  const [result, setResult] = useState<Validation>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function stageFile(formData: FormData) {
    setBusy(true); setMessage('');
    try { setStage(await stageUploadAction(formData) as Stage); setResult(undefined); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'UPLOAD_STAGE_FAILED'); }
    finally { setBusy(false); }
  }
  async function validate() {
    if (!stage) return;
    setBusy(true); setMessage('');
    try { const form = new FormData(); form.set('batch_id', stage.batchId); form.set('mapping_json', JSON.stringify(stage.mapping)); setResult(await validateBatchAction(form)); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'VALIDATION_FAILED'); }
    finally { setBusy(false); }
  }
  async function importRows() {
    if (!stage) return;
    if (stage.importMode === 'replace' && !window.confirm('Replace removes previous FILE_UPLOAD rows of this type and cannot be rolled back. Continue?')) return;
    setBusy(true); setMessage('');
    try { const form = new FormData(); form.set('batch_id', stage.batchId); form.set('confirmed', 'true'); form.set('replace_confirmed', String(stage.importMode === 'replace')); await importBatchAction(form); window.location.reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'IMPORT_FAILED'); }
    finally { setBusy(false); }
  }

  return <div className="ui-import">
    <section className="ui-panel">
      <h2>File Upload</h2>
      <form action={stageFile} className="ui-import-form">
        <label>File<input name="file" type="file" accept=".csv,.xlsx" required /></label>
        <label>Import type<select name="import_type">{IMPORT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
        <label>Mode<select name="import_mode"><option value="append">append</option><option value="upsert">upsert</option><option value="replace">replace (admin confirmation required)</option></select></label>
        <button className="ui-button ui-button-primary" disabled={busy}>{busy ? 'Working…' : 'Parse & Preview'}</button>
      </form>
    </section>
    {message && <p className="ui-import-message" role="alert">{message}</p>}
    {stage && <section className="ui-panel">
      <h2>Column Mapping</h2>
      <p>Confirm each source column before validation. Only mapped values are validated and imported.</p>
      <div className="ui-mapping-grid">{stage.headers.map((header) => <label key={header}>{header}<select value={stage.mapping[header] ?? ''} onChange={(event) => { setStage({ ...stage, mapping: { ...stage.mapping, [header]: event.target.value } }); setResult(undefined); }}><option value="">Ignore</option>{targetColumns(stage.importType).map((target) => <option key={target} value={target}>{target}</option>)}</select></label>)}</div>
      <h3>Preview (first 20 rows)</h3>
      <pre className="ui-import-preview">{JSON.stringify(stage.preview, null, 2)}</pre>
      <button className="ui-button ui-button-primary" onClick={validate} disabled={busy}>Validate</button>
    </section>}
    {result && stage && <section className="ui-panel">
      <h2>Validation Result</h2>
      <p>SUCCESS {result.success} / WARNING {result.warning} / ERROR {result.error}</p>
      <a className="ui-button" href={`/admin/data-management/errors?batch_id=${stage.batchId}`}>Download ERROR/WARNING CSV</a>
      <button className="ui-button ui-button-primary" onClick={importRows} disabled={busy}>Confirm & Import valid rows</button>
      {stage.importMode === 'replace' && <p className="ui-import-warning">Replace only removes earlier FILE_UPLOAD rows and is deliberately not rollbackable.</p>}
    </section>}
    <section className="ui-panel">
      <h2>Import History</h2>
      <table className="ui-data-table"><thead><tr><th>File</th><th>Type</th><th>Mode</th><th>Total</th><th>Success</th><th>Warning</th><th>Error</th><th>Status</th><th>Time</th><th>Rollback</th></tr></thead><tbody>{history.map((batch) => <tr key={batch.batch_id}><td>{batch.file_name}</td><td>{batch.import_type}</td><td>{batch.import_mode}</td><td>{batch.total_rows}</td><td>{batch.success_rows}</td><td>{batch.warning_rows}</td><td>{batch.error_rows}</td><td>{batch.status}</td><td>{new Date(batch.uploaded_at).toLocaleString()}</td><td>{batch.status === 'IMPORTED' && batch.import_mode !== 'replace' ? <form action={rollbackBatchAction}><input type="hidden" name="batch_id" value={batch.batch_id} /><button className="ui-button">Rollback</button></form> : '—'}</td></tr>)}</tbody></table>
    </section>
  </div>;
}
