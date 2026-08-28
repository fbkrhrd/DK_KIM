export type LeadtimeGap = {
  supplier: string;
  country: string;
  masterLeadTime: number | null;
  sampleCount: number;
  actualAverage: number | null;
  p80: number | null;
  gap: number | null;
};

export type StockoutRisk = {
  itemId: string;
  itemName: string;
  supplierId: string;
  currentStock: number | null;
  inboundQty: number | null;
  availableQty: number | null;
  dailyUsageAvg: number | null;
  cv: number | null;
  plannedLeadTime: number | null;
  stockoutDays: number | null;
  stockoutDate: string | null;
  riskStatus: 'SAFE' | 'CRITICAL' | 'UNKNOWN';
  reason: string | null;
};

export type StockoutKpi = {
  nItems: number | null;
  nCritical: number | null;
  nSafe: number | null;
  nUnknown: number | null;
  nWithin30d: number | null;
  avgStockoutDays: number | null;
};

export type ForecastSettingStatus = {
  dataStart: string | null;
  dataEnd: string | null;
  trainStart: string | null;
  trainEnd: string | null;
  testStart: string | null;
  testEnd: string | null;
  granularity: 'DAY' | 'WEEK' | 'MONTH' | null;
  trainRowCount: number | null;
  testRowCount: number | null;
  trainWindowOk: boolean;
  testWindowOk: boolean;
  dataIsolationOk: boolean;
  serviceLevel: number | null;
  reviewPeriodDays: number | null;
  safetyBufferDays: number | null;
  enabledOutlierRuleCount: number | null;
  itemPolicyCount: number | null;
  configuredItemPolicyCount: number | null;
};

export type OutlierRule = {
  ruleId: string;
  ruleCode: string;
  ruleType: string;
  enabled: boolean;
  excludeFromTraining: boolean;
  priority: number | null;
  description: string | null;
};

export type ItemPolicy = {
  itemId: string;
  moq: number | null;
  packSize: number | null;
  itemGrade: string | null;
  serviceLevel: number | null;
};

function value(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return null;
}

function numberValue(row: Record<string, unknown>, keys: string[]) {
  const raw = value(row, keys);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeLeadtimeGap(row: Record<string, unknown>): LeadtimeGap {
  return {
    supplier: String(value(row, ['supplier_name', 'supplier', '법인', '공급처', '공급업체명']) ?? '미정'),
    country: String(value(row, ['country', '국가']) ?? '미정'),
    masterLeadTime: numberValue(row, ['std_lead_time', 'master_lt', 'master_lead_time', 'planned_lead_time', '표준리드타임', '표준리드타임(일)', '마스터값']),
    sampleCount: numberValue(row, ['n_samples', 'sample_count', 'samples', '표본수']) ?? 0,
    actualAverage: numberValue(row, ['mean_days', 'actual_avg', 'actual_average', 'avg_lead_time', '실적평균']),
    p80: numberValue(row, ['p80_days', 'p80', 'P80']),
    gap: numberValue(row, ['gap_days', 'gap', 'leadtime_gap', '격차']),
  };
}

export function normalizeStockoutRisk(row: Record<string, unknown>): StockoutRisk {
  const status = String(value(row, ['risk_status', 'riskStatus']) ?? 'UNKNOWN').toUpperCase();
  return {
    itemId: String(value(row, ['item_id', 'itemId']) ?? '미정'),
    itemName: String(value(row, ['item_name', 'itemName']) ?? '미정'),
    supplierId: String(value(row, ['supplier_id', 'supplierId']) ?? '미정'),
    currentStock: numberValue(row, ['current_stock', 'currentStock']),
    inboundQty: numberValue(row, ['inbound_qty', 'inboundQty']),
    availableQty: numberValue(row, ['available_qty', 'availableQty']),
    dailyUsageAvg: numberValue(row, ['daily_usage_avg', 'dailyUsageAvg']),
    cv: numberValue(row, ['cv']),
    plannedLeadTime: numberValue(row, ['planned_lead_time', 'plannedLeadTime']),
    stockoutDays: numberValue(row, ['stockout_days', 'stockoutDays']),
    stockoutDate: value(row, ['stockout_date', 'stockoutDate']) as string | null,
    riskStatus: status === 'CRITICAL' || status === 'SAFE' ? status : 'UNKNOWN',
    reason: value(row, ['reason']) as string | null,
  };
}

export function normalizeStockoutKpi(row: Record<string, unknown> | null): StockoutKpi {
  return {
    nItems: numberValue(row ?? {}, ['n_items', 'nItems']),
    nCritical: numberValue(row ?? {}, ['n_critical', 'nCritical']),
    nSafe: numberValue(row ?? {}, ['n_safe', 'nSafe']),
    nUnknown: numberValue(row ?? {}, ['n_unknown', 'nUnknown']),
    nWithin30d: numberValue(row ?? {}, ['n_within_30d', 'nWithin30d']),
    avgStockoutDays: numberValue(row ?? {}, ['avg_stockout_days', 'avgStockoutDays']),
  };
}

export function normalizeForecastSettingStatus(row: Record<string, unknown> | null): ForecastSettingStatus | null {
  if (!row) return null;
  const granularity = String(value(row, ['granularity']) ?? '').toUpperCase();
  return {
    dataStart: value(row, ['data_start']) as string | null,
    dataEnd: value(row, ['data_end']) as string | null,
    trainStart: value(row, ['train_start']) as string | null,
    trainEnd: value(row, ['train_end']) as string | null,
    testStart: value(row, ['test_start']) as string | null,
    testEnd: value(row, ['test_end']) as string | null,
    granularity: granularity === 'DAY' || granularity === 'WEEK' || granularity === 'MONTH' ? granularity : null,
    trainRowCount: numberValue(row, ['train_row_count']),
    testRowCount: numberValue(row, ['test_row_count']),
    trainWindowOk: value(row, ['train_window_ok']) === true,
    testWindowOk: value(row, ['test_window_ok']) === true,
    dataIsolationOk: value(row, ['data_isolation_ok']) === true,
    serviceLevel: numberValue(row, ['service_level']),
    reviewPeriodDays: numberValue(row, ['review_period_days']),
    safetyBufferDays: numberValue(row, ['safety_buffer_days']),
    enabledOutlierRuleCount: numberValue(row, ['enabled_outlier_rule_count']),
    itemPolicyCount: numberValue(row, ['item_policy_count']),
    configuredItemPolicyCount: numberValue(row, ['configured_item_policy_count']),
  };
}

export function normalizeOutlierRule(row: Record<string, unknown>): OutlierRule {
  return {
    ruleId: String(value(row, ['rule_id']) ?? ''),
    ruleCode: String(value(row, ['rule_code']) ?? ''),
    ruleType: String(value(row, ['rule_type']) ?? ''),
    enabled: value(row, ['enabled']) === true,
    excludeFromTraining: value(row, ['exclude_from_training']) === true,
    priority: numberValue(row, ['priority']),
    description: value(row, ['description']) as string | null,
  };
}

export function normalizeItemPolicy(row: Record<string, unknown>): ItemPolicy {
  return {
    itemId: String(value(row, ['item_id']) ?? ''),
    moq: numberValue(row, ['moq']),
    packSize: numberValue(row, ['pack_size']),
    itemGrade: value(row, ['item_grade']) as string | null,
    serviceLevel: numberValue(row, ['service_level']),
  };
}
