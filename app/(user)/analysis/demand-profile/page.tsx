import PageHeader from '@/components/shell/page-header';
import EmptyValue from '@/components/ui/empty-value';
import KpiCard from '@/components/ui/kpi-card';
import Panel from '@/components/ui/panel';
import { getDemandProfile } from '@/lib/demand-profile';
import DemandProfileClient from './demand-profile-client';

export const dynamic = 'force-dynamic';

export default async function DemandProfilePage() {
  const { rows, kpi, error } = await getDemandProfile();
  if (error || !kpi) return <><PageHeader title="SKU Demand Profile" description="Training-period-only SKU demand pattern analysis." /><Panel title="SUPABASE LIVE"><div className="ui-alert-row"><div><strong>Demand profile query failed.</strong><p>{error ?? 'CALCULATION_UNAVAILABLE'}</p></div></div></Panel></>;
  return <>
    <PageHeader title="SKU Demand Profile" description="Classifies monthly training demand for forecast candidate selection." />
    <div className="ui-kpi-grid">
      <KpiCard label="Total SKU" value={kpi.totalItems} foot="Training-profile target items" />
      <KpiCard label="Croston needed" value={kpi.crostonNeeded} foot="INTERMITTENT + LUMPY" />
      <KpiCard label="Calculation unavailable" value={kpi.unavailable ?? <EmptyValue reasonCode="KPI_UNAVAILABLE" />} foot="Explicit reason code required" />
    </div>
    <Panel title="SKU demand pattern" description="ADI and CV squared are calculated in analytics.v_sku_demand_profile."><DemandProfileClient rows={rows} /></Panel>
  </>;
}
