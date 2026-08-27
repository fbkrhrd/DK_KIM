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
  currentStock: number;
  inboundQty: number;
  availableQty: number;
  dailyUsageAvg: number | null;
  cv: number | null;
  plannedLeadTime: number | null;
  stockoutDays: number | null;
  stockoutDate: string | null;
  riskStatus: 'SAFE' | 'CRITICAL' | 'UNKNOWN';
  reason: string | null;
};

export type StockoutKpi = {
  nItems: number;
  nCritical: number;
  nSafe: number;
  nUnknown: number;
  nWithin30d: number;
  avgStockoutDays: number | null;
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
    currentStock: numberValue(row, ['current_stock', 'currentStock']) ?? 0,
    inboundQty: numberValue(row, ['inbound_qty', 'inboundQty']) ?? 0,
    availableQty: numberValue(row, ['available_qty', 'availableQty']) ?? 0,
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
    nItems: numberValue(row ?? {}, ['n_items', 'nItems']) ?? 0,
    nCritical: numberValue(row ?? {}, ['n_critical', 'nCritical']) ?? 0,
    nSafe: numberValue(row ?? {}, ['n_safe', 'nSafe']) ?? 0,
    nUnknown: numberValue(row ?? {}, ['n_unknown', 'nUnknown']) ?? 0,
    nWithin30d: numberValue(row ?? {}, ['n_within_30d', 'nWithin30d']) ?? 0,
    avgStockoutDays: numberValue(row ?? {}, ['avg_stockout_days', 'avgStockoutDays']),
  };
}
