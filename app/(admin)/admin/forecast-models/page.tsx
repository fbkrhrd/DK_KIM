import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';
import { getForecastRuns } from '@/lib/forecast';
import { updateForecastModelAction } from './actions';
export const dynamic = 'force-dynamic';
export default async function ForecastModelsPage() {
 const { models, error } = await getForecastRuns();
 return <><PageHeader title="Forecast Models" description="SQL baseline model registry. Changes are admin-only and versioned at each run."/><Panel title="Model registry">{error ? <p>{error}</p> : <div className="ui-data-table-wrap"><table className="ui-data-table"><thead><tr><th>Model</th><th>Family</th><th>Engine</th><th>Version</th><th>Demand type</th><th>Enabled / parameters</th></tr></thead><tbody>{models.map((model: Record<string, unknown>)=><tr key={String(model.model_id)}><td>{String(model.model_name)}</td><td>{String(model.family)}</td><td>{String(model.engine)}</td><td>{String(model.version)}</td><td>{Array.isArray(model.applicable_demand_type) ? model.applicable_demand_type.join(', ') : String(model.applicable_demand_type)}</td><td><form action={updateForecastModelAction}><input type="hidden" name="model_id" value={String(model.model_id)}/><label><input type="checkbox" name="enabled" defaultChecked={model.enabled === true}/> Enabled</label><input name="parameters" defaultValue={JSON.stringify(model.parameters)} aria-label="parameters"/><button className="ui-button" type="submit">Save</button></form></td></tr>)}</tbody></table></div>}</Panel></>;
}
