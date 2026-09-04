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

export type ShipmentTrend = {
  itemCode: string | null;
  description: string | null;
  family: string | null;
  itemType: string | null;
  dataAsOf: string | null;
  nMonths: number | null;
  firstYm: string | null;
  lastYm: string | null;
  monthsSinceLast: number | null;
  nSpan: number | null;
  totalQty: number | null;
  latestQty: number | null;
  avg3m: number | null;
  avg6m: number | null;
  avg12m: number | null;
  trend3mVs12m: number | null;
  reasonCode: string | null;
};

export type DemandProfileRt = {
  itemCode: string | null;
  description: string | null;
  family: string | null;
  itemType: string | null;
  dataAsOf: string | null;
  firstYm: string | null;
  lastYm: string | null;
  nPeriods: number | null;
  nNonzero: number | null;
  meanNonzeroQty: number | null;
  adi: number | null;
  zeroDemandRate: number | null;
  cvSquared: number | null;
  demandType: string | null;
  reasonCode: string | null;
};

export type OlAccuracy = {
  modelBase: string | null;
  fiscalYear: string | null;
  biz: string | null;
  nRows: number | null;
  firstYm: string | null;
  lastYm: string | null;
  totalActual: number | null;
  nScoredSales: number | null;
  salesWape: number | null;
  salesBias: number | null;
  nScoredScm: number | null;
  scmWape: number | null;
  scmBias: number | null;
  reasonCode: string | null;
};

export type OlAccuracyFy = {
  fiscalYear: string | null;
  nRows: number | null;
  nScored: number | null;
  salesWape: number | null;
  scmWape: number | null;
  salesBias: number | null;
  scmBias: number | null;
};

export type BomRequirement = {
  modelBase: string | null;
  modelKey: string | null;
  partRole: string | null;
  itemCode: string | null;
  description: string | null;
  qty: number | null;
  bomGroup: string | null;
  nModels: number | null;
  commonFlag: string | null;
  commonNote: string | null;
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

function stringValue(row: Record<string, unknown>, keys: string[]) {
  const raw = value(row, keys);
  return raw === null ? null : String(raw);
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

export function normalizeShipmentTrend(row: Record<string, unknown>): ShipmentTrend {
  return {
    itemCode: stringValue(row, ['item_code']),
    description: stringValue(row, ['description']),
    family: stringValue(row, ['family']),
    itemType: stringValue(row, ['item_type']),
    dataAsOf: stringValue(row, ['data_as_of']),
    nMonths: numberValue(row, ['n_months']),
    firstYm: stringValue(row, ['first_ym']),
    lastYm: stringValue(row, ['last_ym']),
    monthsSinceLast: numberValue(row, ['months_since_last']),
    nSpan: numberValue(row, ['n_span']),
    totalQty: numberValue(row, ['total_qty']),
    latestQty: numberValue(row, ['latest_qty']),
    avg3m: numberValue(row, ['avg_3m']),
    avg6m: numberValue(row, ['avg_6m']),
    avg12m: numberValue(row, ['avg_12m']),
    trend3mVs12m: numberValue(row, ['trend_3m_vs_12m']),
    reasonCode: stringValue(row, ['reason_code']),
  };
}

export function normalizeDemandProfileRt(row: Record<string, unknown>): DemandProfileRt {
  return {
    itemCode: stringValue(row, ['item_code']),
    description: stringValue(row, ['description']),
    family: stringValue(row, ['family']),
    itemType: stringValue(row, ['item_type']),
    dataAsOf: stringValue(row, ['data_as_of']),
    firstYm: stringValue(row, ['first_ym']),
    lastYm: stringValue(row, ['last_ym']),
    nPeriods: numberValue(row, ['n_periods']),
    nNonzero: numberValue(row, ['n_nonzero']),
    meanNonzeroQty: numberValue(row, ['mean_nonzero_qty']),
    adi: numberValue(row, ['adi']),
    zeroDemandRate: numberValue(row, ['zero_demand_rate']),
    cvSquared: numberValue(row, ['cv_squared']),
    demandType: stringValue(row, ['demand_type']),
    reasonCode: stringValue(row, ['reason_code']),
  };
}

export function normalizeOlAccuracy(row: Record<string, unknown>): OlAccuracy {
  return {
    modelBase: stringValue(row, ['model_base']),
    fiscalYear: stringValue(row, ['fy_sheet']),
    biz: stringValue(row, ['biz']),
    nRows: numberValue(row, ['n_rows']),
    firstYm: stringValue(row, ['first_ym']),
    lastYm: stringValue(row, ['last_ym']),
    totalActual: numberValue(row, ['total_act']),
    nScoredSales: numberValue(row, ['n_scored_sales']),
    salesWape: numberValue(row, ['sales_wape']),
    salesBias: numberValue(row, ['sales_bias']),
    nScoredScm: numberValue(row, ['n_scored_scm']),
    scmWape: numberValue(row, ['scm_wape']),
    scmBias: numberValue(row, ['scm_bias']),
    reasonCode: stringValue(row, ['reason_code']),
  };
}

export function normalizeOlAccuracyFy(row: Record<string, unknown>): OlAccuracyFy {
  return {
    fiscalYear: stringValue(row, ['fy_sheet']),
    nRows: numberValue(row, ['n_rows']),
    nScored: numberValue(row, ['n_scored']),
    salesWape: numberValue(row, ['sales_wape']),
    scmWape: numberValue(row, ['scm_wape']),
    salesBias: numberValue(row, ['sales_bias']),
    scmBias: numberValue(row, ['scm_bias']),
  };
}

export function normalizeBomRequirement(row: Record<string, unknown>): BomRequirement {
  return {
    modelBase: stringValue(row, ['model_base']),
    modelKey: stringValue(row, ['model_key']),
    partRole: stringValue(row, ['part_role']),
    itemCode: stringValue(row, ['item_code']),
    description: stringValue(row, ['description']),
    qty: numberValue(row, ['qty']),
    bomGroup: stringValue(row, ['bom_group']),
    nModels: numberValue(row, ['n_models']),
    commonFlag: stringValue(row, ['common_flag']),
    commonNote: stringValue(row, ['common_note']),
  };
}
