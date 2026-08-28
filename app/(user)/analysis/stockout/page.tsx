import PageHeader from '@/components/shell/page-header';
import Badge, { type Status } from '@/components/ui/badge';
import DataTable, { type DataColumn } from '@/components/ui/data-table';
import EmptyValue from '@/components/ui/empty-value';
import KpiCard from '@/components/ui/kpi-card';
import Panel from '@/components/ui/panel';
import { getStockoutKpi, getStockoutRisks } from '@/lib/scm';
import type { StockoutRisk } from '@/lib/scm-model';

export const dynamic = 'force-dynamic';

function numberCell(value: number | null, suffix: string, reasonCode: string) {
  return value === null ? <EmptyValue reasonCode={reasonCode} /> : `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`;
}

function riskStatus(status: StockoutRisk['riskStatus']): Status {
  if (status === 'CRITICAL') return 'CRITICAL';
  if (status === 'SAFE') return 'SAFE';
  return 'CALCULATION_UNAVAILABLE';
}

const columns: DataColumn<StockoutRisk>[] = [
  { key: 'itemId', label: '품목' },
  { key: 'itemName', label: '품목명' },
  { key: 'supplierId', label: '공급처' },
  { key: 'currentStock', label: '현재고', align: 'right', render: (row) => numberCell(row.currentStock, '개', 'CURRENT_STOCK_UNAVAILABLE') },
  { key: 'inboundQty', label: '입고예정', align: 'right', render: (row) => numberCell(row.inboundQty, '개', 'INBOUND_UNAVAILABLE') },
  { key: 'stockoutDays', label: '재고일수', align: 'right', render: (row) => numberCell(row.stockoutDays, '일', 'STOCKOUT_DAYS_UNAVAILABLE') },
  { key: 'stockoutDate', label: '예상 소진일', render: (row) => row.stockoutDate ? row.stockoutDate : <EmptyValue reasonCode={row.reason ?? 'STOCKOUT_DATE_UNAVAILABLE'} /> },
  { key: 'riskStatus', label: '상태', align: 'center', render: (row) => <Badge status={riskStatus(row.riskStatus)} /> },
];

export default async function StockoutPage() {
  const [{ rows, error }, { data: kpi, error: kpiError }] = await Promise.all([getStockoutRisks(), getStockoutKpi()]);
  const errorMessage = error ?? kpiError;
  if (errorMessage || !kpi) return <><PageHeader title="소진위험" description="현재고와 평균 사용량을 기준으로 품목별 재고 소진 위험을 분석합니다." /><Panel title="SUPABASE LIVE"><div className="ui-alert-row"><div><strong>조회에 실패했습니다.</strong><p>{errorMessage ?? 'CALCULATION_UNAVAILABLE'}</p></div></div></Panel></>;

  return <>
    <PageHeader title="소진위험" description="현재고와 평균 사용량을 기준으로 품목별 재고 소진 위험을 분석합니다." />
    <div className="ui-kpi-grid">
      <KpiCard label="관리 품목" value={kpi.nItems ?? <EmptyValue reasonCode="ITEM_COUNT_UNAVAILABLE" />} foot="활성 품목 기준" />
      <KpiCard label="CRITICAL" value={kpi.nCritical ?? <EmptyValue reasonCode="CRITICAL_COUNT_UNAVAILABLE" />} foot="리드타임 내 소진 예상" />
      <KpiCard label="30일 이내 소진" value={kpi.nWithin30d ?? <EmptyValue reasonCode="WITHIN_30D_UNAVAILABLE" />} foot="재고일수 30일 이하" />
    </div>
    <Panel title="품목별 소진위험" description="현재고와 입고예정량을 반영한 소진 예상">
      <DataTable columns={columns} rows={rows} rowKey={(row) => row.itemId} empty="analytics.v_stockout_risk에 데이터가 없습니다." />
    </Panel>
  </>;
}
