import PageHeader from '@/components/shell/page-header';
import Badge from '@/components/ui/badge';
import EmptyValue from '@/components/ui/empty-value';
import KpiCard from '@/components/ui/kpi-card';
import Panel from '@/components/ui/panel';
import { getForecastSettingsOverview } from '@/lib/scm';

function range(start: string | null | undefined, end: string | null | undefined) {
  return start && end ? `${start} ~ ${end}` : null;
}

function percent(value: number | null | undefined) {
  return value == null ? null : `${(value * 100).toFixed(1)}%`;
}

function validationBadge(value: boolean | null | undefined, valid: string, invalid: string) {
  if (value == null) return <Badge status="CALCULATION_UNAVAILABLE">UNAVAILABLE</Badge>;
  return <Badge status={value ? 'SAFE' : 'CRITICAL'}>{value ? valid : invalid}</Badge>;
}

export const dynamic = 'force-dynamic';

export default async function ForecastSettingsPage() {
  const { status, rules, itemPolicies, error } = await getForecastSettingsOverview();

  return <>
    <PageHeader
      eyebrow="ADMIN / FORECAST"
      title="Forecast 학습·검증 설정"
      description="학습 데이터와 검증 Actual의 기간 격리 상태 및 운영 정책을 확인합니다."
    />

    {error && <div className="ui-alert-row"><div><strong>Forecast 설정을 조회하지 못했습니다.</strong><p>{error}</p></div></div>}

    <div className="ui-kpi-grid">
      <KpiCard label="전체 데이터 기간" value={range(status?.dataStart, status?.dataEnd) ?? <EmptyValue reasonCode="DATA_RANGE_UNAVAILABLE" />} />
      <KpiCard label="학습 기간" value={range(status?.trainStart, status?.trainEnd) ?? <EmptyValue reasonCode="TRAIN_WINDOW_UNSET" />} foot={status?.trainRowCount == null ? <EmptyValue reasonCode="TRAIN_COUNT_UNAVAILABLE" /> : `${status.trainRowCount.toLocaleString()} rows`} />
      <KpiCard label="검증 기간" value={range(status?.testStart, status?.testEnd) ?? <EmptyValue reasonCode="TEST_WINDOW_UNSET" />} foot={status?.testRowCount == null ? <EmptyValue reasonCode="TEST_COUNT_UNAVAILABLE" /> : `${status.testRowCount.toLocaleString()} rows`} />
    </div>

    <Panel title="데이터 격리 상태" description="기간 경계와 실제 데이터 커버리지를 DB view에서 검증합니다.">
      <div className="ui-forecast-status-grid">
        <div><span>Granularity</span><strong>{status?.granularity ?? <EmptyValue reasonCode="GRANULARITY_UNAVAILABLE" />}</strong></div>
        <div><span>Train window</span>{validationBadge(status?.trainWindowOk, 'VALID', 'INVALID')}</div>
        <div><span>Test window</span>{validationBadge(status?.testWindowOk, 'VALID', 'INVALID')}</div>
        <div><span>Train/Test isolation</span>{validationBadge(status?.dataIsolationOk, 'ISOLATED', 'CHECK REQUIRED')}</div>
      </div>
    </Panel>

    <Panel title="공통 운영 정책" description="정책값은 core.policy_config에서 관리됩니다.">
      <div className="ui-data-table-wrap"><table className="ui-data-table"><thead><tr><th>Service level</th><th>Review period</th><th>Safety buffer</th><th>Outlier rules</th><th>Item policy</th></tr></thead><tbody><tr>
        <td>{percent(status?.serviceLevel) ?? <EmptyValue reasonCode="SERVICE_LEVEL_UNSET" />}</td>
        <td>{status?.reviewPeriodDays == null ? <EmptyValue reasonCode="REVIEW_PERIOD_UNSET" /> : `${status.reviewPeriodDays}일`}</td>
        <td>{status?.safetyBufferDays == null ? <EmptyValue reasonCode="SAFETY_BUFFER_UNSET" /> : `${status.safetyBufferDays}일`}</td>
        <td>{status?.enabledOutlierRuleCount == null ? <EmptyValue reasonCode="OUTLIER_RULE_COUNT_UNAVAILABLE" /> : `${status.enabledOutlierRuleCount}개 활성`}</td>
        <td>{status?.configuredItemPolicyCount == null || status.itemPolicyCount == null ? <EmptyValue reasonCode="ITEM_POLICY_COUNT_UNAVAILABLE" /> : `${status.configuredItemPolicyCount} / ${status.itemPolicyCount}`}</td>
      </tr></tbody></table></div>
    </Panel>

    <Panel title="학습 제외 규칙" description="프로젝트성 수요, 반품, 중복 제외 여부를 확인합니다.">
      <div className="ui-data-table-wrap"><table className="ui-data-table"><thead><tr><th>Priority</th><th>Rule</th><th>Type</th><th>학습 제외</th><th>설명</th></tr></thead><tbody>{rules.map((rule) => <tr key={rule.ruleId}><td>{rule.priority ?? <EmptyValue />}</td><td>{rule.ruleCode}</td><td>{rule.ruleType}</td><td><Badge status={rule.enabled && rule.excludeFromTraining ? 'SAFE' : 'WARNING'}>{rule.enabled && rule.excludeFromTraining ? 'ENABLED' : 'DISABLED'}</Badge></td><td>{rule.description ?? <EmptyValue reasonCode="DESCRIPTION_UNAVAILABLE" />}</td></tr>)}</tbody></table></div>
    </Panel>

    <Panel title="품목 정책" description="MOQ, pack size, 등급, service level 설정 상태입니다.">
      <div className="ui-data-table-wrap"><table className="ui-data-table"><thead><tr><th>Item</th><th>MOQ</th><th>Pack size</th><th>Grade</th><th>Service level</th></tr></thead><tbody>{itemPolicies.map((policy) => <tr key={policy.itemId}><td>{policy.itemId}</td><td>{policy.moq ?? <EmptyValue reasonCode="MOQ_UNSET" />}</td><td>{policy.packSize ?? <EmptyValue reasonCode="PACK_SIZE_UNSET" />}</td><td>{policy.itemGrade ?? <EmptyValue reasonCode="ITEM_GRADE_UNSET" />}</td><td>{percent(policy.serviceLevel) ?? <EmptyValue reasonCode="SERVICE_LEVEL_UNSET" />}</td></tr>)}</tbody></table></div>
    </Panel>
  </>;
}
