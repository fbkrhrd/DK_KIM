import PageHeader from '@/components/shell/page-header';
import Badge, { type Status } from '@/components/ui/badge';
import DataTable, { type DataColumn } from '@/components/ui/data-table';
import EmptyValue from '@/components/ui/empty-value';
import KpiCard from '@/components/ui/kpi-card';
import Panel from '@/components/ui/panel';
import { getLeadtimeGap } from '@/lib/scm';
import type { LeadtimeGap } from '@/lib/scm-model';

export const dynamic = 'force-dynamic';

function numberCell(value: number | null, suffix: string, reasonCode: string) {
  return value === null ? <EmptyValue reasonCode={reasonCode} /> : `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`;
}

function gapStatus(row: LeadtimeGap): Status {
  if (row.gap === null) return 'CALCULATION_UNAVAILABLE';
  if (row.gap > 0) return 'CRITICAL';
  if (row.gap === 0) return 'WARNING';
  return 'SAFE';
}

const columns: DataColumn<LeadtimeGap>[] = [
  { key: 'supplier', label: '공급처' },
  { key: 'country', label: '국가' },
  { key: 'masterLeadTime', label: '마스터 리드타임', align: 'right', render: (row) => numberCell(row.masterLeadTime, '일', 'MASTER_LEADTIME_UNAVAILABLE') },
  { key: 'sampleCount', label: '표본 수', align: 'right', render: (row) => row.sampleCount },
  { key: 'actualAverage', label: '실적 평균', align: 'right', render: (row) => numberCell(row.actualAverage, '일', 'ACTUAL_AVERAGE_UNAVAILABLE') },
  { key: 'p80', label: 'P80', align: 'right', render: (row) => numberCell(row.p80, '일', 'P80_UNAVAILABLE') },
  { key: 'gap', label: '격차 상태', align: 'center', render: (row) => <Badge status={gapStatus(row)} /> },
];

export default async function LeadtimePage() {
  const { rows, error } = await getLeadtimeGap();
  if (error) return <><PageHeader title="리드타임 격차" description="공급처별 마스터 리드타임과 실제 실적을 비교합니다." /><Panel title="SUPABASE LIVE"><div className="ui-alert-row"><div><strong>조회에 실패했습니다.</strong><p>{error}</p></div></div></Panel></>;

  const critical = rows.filter((row) => row.gap !== null && row.gap > 0).length;
  const unavailable = rows.filter((row) => row.gap === null).length;
  return <>
    <PageHeader title="리드타임 격차" description="공급처별 마스터 리드타임과 실제 실적을 비교합니다." />
    <div className="ui-kpi-grid">
      <KpiCard label="공급처" value={rows.length} foot="분석 대상 공급처" />
      <KpiCard label="CRITICAL" value={critical} foot="마스터 리드타임 초과" />
      <KpiCard label="계산 불가" value={unavailable} foot="필수 분석값 부족" />
    </div>
    <Panel title="공급처별 리드타임 격차" description="P80 실적과 마스터 리드타임의 차이">
      <DataTable columns={columns} rows={rows} rowKey={(row, index) => `${row.supplier}-${index}`} empty="analytics.v_leadtime_gap에 데이터가 없습니다." />
    </Panel>
  </>;
}
