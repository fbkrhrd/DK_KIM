import AnalysisFrame from '@/components/analysis/analysis-frame';
import DataTable, { formatNumber, type Column } from '@/components/analysis/data-table';
import { getStockoutKpi, getStockoutRisks } from '@/lib/scm';
import type { StockoutRisk } from '@/lib/scm-model';

export const dynamic = 'force-dynamic';

function RiskBadge({ status }: { status: StockoutRisk['riskStatus'] }) {
  const labels = { CRITICAL: '위험', SAFE: '안전', UNKNOWN: '확인 필요' };
  return <span className={`risk-badge risk-${status.toLowerCase()}`}>{labels[status]}</span>;
}

function DateCell({ row }: { row: StockoutRisk }) {
  if (!row.stockoutDate) return <span className="muted">-</span>;
  return <span>{row.stockoutDate}</span>;
}

const columns: Column<StockoutRisk>[] = [
  { key: 'itemId', label: '품목' },
  { key: 'itemName', label: '품목명' },
  { key: 'supplierId', label: '공급처' },
  { key: 'currentStock', label: '현재고', align: 'right', render: (r) => formatNumber(r.currentStock, '개') },
  { key: 'inboundQty', label: '입고예정', align: 'right', render: (r) => formatNumber(r.inboundQty, '개') },
  { key: 'stockoutDays', label: '재고일수', align: 'right', render: (r) => formatNumber(r.stockoutDays, '일') },
  { key: 'stockoutDate', label: '예상 소진일', render: (r) => <DateCell row={r} /> },
  { key: 'riskStatus', label: '위험도', align: 'center', render: (r) => <RiskBadge status={r.riskStatus} /> },
];

export default async function StockoutPage() {
  const [{ rows, error }, { data: kpi, error: kpiError }] = await Promise.all([getStockoutRisks(), getStockoutKpi()]);
  const errorMessage = error ?? kpiError;

  if (errorMessage || !kpi) {
    return (
      <AnalysisFrame title="소진위험" description="현재고와 평균 사용량을 기준으로 품목별 재고 소진 위험을 분석합니다.">
        <div className="card">
          <p className="text-danger">조회에 실패했습니다.</p>
          <p className="muted">{errorMessage}</p>
        </div>
      </AnalysisFrame>
    );
  }

  return (
    <AnalysisFrame title="소진위험" description="현재고와 평균 사용량을 기준으로 품목별 재고 소진 위험을 분석합니다.">
      <div className="grid grid-3">
        <div className="card metric"><div className="metric-label">관리 품목</div><div className="metric-value">{kpi.nItems}</div><div className="metric-foot">활성 품목 기준</div></div>
        <div className="card metric"><div className="metric-label">소진 위험</div><div className="metric-value">{kpi.nCritical}</div><div className="metric-foot danger">리드타임 내 소진 예상</div></div>
        <div className="card metric"><div className="metric-label">30일 이내 소진</div><div className="metric-value">{kpi.nWithin30d}</div><div className="metric-foot warn">재고일수 30일 이하</div></div>
      </div>

      <div className="section card">
        <div className="card-title">
          <h3>품목별 소진위험</h3>
          <span>현재고 + 입고예정 ÷ 일평균사용량</span>
        </div>
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.itemId} empty="데이터가 없습니다. analytics.v_stockout_risk 뷰와 Exposed schemas를 확인하세요." />
      </div>
    </AnalysisFrame>
  );
}
