import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';
import { getForecastRuns } from '@/lib/forecast';
import { runBaselineForecastAction, runPythonForecastAction } from './actions';

export const dynamic = 'force-dynamic';
export default async function ForecastRunsPage() {
  const { runs, kpi, error } = await getForecastRuns();
  return <><PageHeader title="Forecast Runs" description="Training-only SQL baseline forecast execution history." action={<><form action={runBaselineForecastAction}><button className="ui-button ui-button-primary">Run baseline forecast</button></form><form action={runPythonForecastAction}><button className="ui-button">Run Python forecast</button></form></>} />
  <Panel title="Run KPI">{error ? <p>{error}</p> : <p>SUCCESS {String(kpi?.n_success ?? 0)} / FAILED {String(kpi?.n_failed ?? 0)} / STALE {String(kpi?.n_stale ?? 0)}</p>}</Panel>
  <Panel title="Execution history"><div className="ui-data-table-wrap"><table className="ui-data-table"><thead><tr><th>Run</th><th>Status</th><th>Models</th><th>SKU</th><th>Rows</th><th>Snapshot</th><th>Stale</th></tr></thead><tbody>{runs.map((run: Record<string, unknown>) => <tr key={String(run.run_id)}><td>{String(run.run_id)}</td><td>{String(run.status)}</td><td>{String(run.n_models)}</td><td>{String(run.n_items)}</td><td>{String(run.n_rows)}</td><td>{String(run.data_snapshot_at)}</td><td>{run.is_stale ? 'YES' : 'NO'}</td></tr>)}</tbody></table></div></Panel></>;
}
