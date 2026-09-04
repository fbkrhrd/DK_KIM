import { createSupabaseServerClient } from './supabase';
import { requireAdmin } from './auth';
import {
  normalizeBomRequirement,
  normalizeDemandProfileRt,
  normalizeForecastSettingStatus,
  normalizeItemPolicy,
  normalizeLeadtimeGap,
  normalizeOlAccuracy,
  normalizeOlAccuracyFy,
  normalizeOutlierRule,
  normalizeShipmentTrend,
  normalizeStockoutKpi,
  normalizeStockoutRisk,
  type BomRequirement,
  type BomRequirementResult,
  type DemandProfile,
  type DemandProfileRt,
  type ForecastSettingStatus,
  type ItemPolicy,
  type LeadtimeGap,
  type OlAccuracy,
  type OlAccuracyResult,
  type OlAccuracyFy,
  type OutlierRule,
  type ShipmentTrend,
  type ShipmentByHocMonth,
  type ShipmentByHocTrend,
  type StockoutKpi,
  type StockoutRisk,
} from './scm-model';

type DataRow = Record<string, unknown>;

function asString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function monthIndex(ym: string): number | null {
  const match = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? year * 12 + month - 1 : null;
}

function indexToYm(index: number): string {
  const year = Math.floor(index / 12);
  const month = index % 12 + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function makeDenseMonthlySeries(rows: DataRow[]): { rows: ShipmentByHocMonth[] | null; reason: string | null } {
  const quantities = new Map<number, number>();
  for (const row of rows) {
    const ym = asString(row.ym);
    const index = ym ? monthIndex(ym) : null;
    const qty = asNumber(row.qty);
    if (index === null) return { rows: null, reason: 'INVALID_MONTH_KEY' };
    if (qty === null) return { rows: null, reason: 'MISSING_QUANTITY' };
    quantities.set(index, (quantities.get(index) ?? 0) + qty);
  }

  const indexes = Array.from(quantities.keys()).sort((left, right) => left - right);
  if (indexes.length === 0) return { rows: [], reason: null };
  const first = indexes[0];
  const last = indexes[indexes.length - 1];
  const dense: ShipmentByHocMonth[] = [];
  for (let index = first; index <= last; index += 1) {
    dense.push({ ym: indexToYm(index), qty: quantities.get(index) ?? 0 });
  }
  return { rows: dense, reason: null };
}

function averageOfLast(rows: ShipmentByHocMonth[], count: number): number | null {
  if (rows.length === 0) return null;
  const values = rows.slice(-count).map((row) => row.qty);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function classifyDemand(adi: number, cvSquared: number): DemandProfile['demandType'] {
  if (adi < 1.32 && cvSquared < 0.49) return 'SMOOTH';
  if (adi >= 1.32 && cvSquared < 0.49) return 'INTERMITTENT';
  if (adi < 1.32) return 'ERRATIC';
  return 'LUMPY';
}

export async function getLeadtimeGap(): Promise<{ rows: LeadtimeGap[]; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.schema('analytics').from('v_leadtime_gap').select('*');
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []).map((row) => normalizeLeadtimeGap(row as Record<string, unknown>)), error: null };
  } catch (error) {
    if (error instanceof TypeError && error.message === 'fetch failed') {
      return {
        rows: [],
        error: 'Supabase 연결에 실패했습니다. Vercel의 NEXT_PUBLIC_SUPABASE_URL이 실제 프로젝트 URL인지, 프로젝트가 활성 상태인지 확인하세요.',
      };
    }
    return { rows: [], error: error instanceof Error ? error.message : 'Supabase 조회에 실패했습니다.' };
  }
}

export async function getStockoutKpi() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.schema('analytics').from('v_stockout_kpi').select('*').maybeSingle();
    if (error) return { data: null, error: error.message };
    return { data: normalizeStockoutKpi(data as Record<string, unknown> | null), error: null };
  } catch (error) {
    if (error instanceof TypeError && error.message === 'fetch failed') {
      return {
        data: null,
        error: 'Supabase 연결에 실패했습니다. Vercel의 NEXT_PUBLIC_SUPABASE_URL이 실제 프로젝트 URL인지, 프로젝트가 활성 상태인지 확인하세요.',
      };
    }
    return { data: null, error: error instanceof Error ? error.message : 'Supabase 조회에 실패했습니다.' };
  }
}

export async function getStockoutRisks(): Promise<{ rows: StockoutRisk[]; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.schema('analytics').from('v_stockout_risk').select('*').order('stockout_days', { ascending: true, nullsFirst: false });
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []).map((row) => normalizeStockoutRisk(row as Record<string, unknown>)), error: null };
  } catch (error) {
    if (error instanceof TypeError && error.message === 'fetch failed') {
      return { rows: [], error: 'Supabase 연결에 실패했습니다. Vercel의 Supabase 환경변수와 프로젝트 상태를 확인하세요.' };
    }
    return { rows: [], error: error instanceof Error ? error.message : 'Supabase 조회에 실패했습니다.' };
  }
}

export async function getForecastSettingsOverview(): Promise<{
  status: ForecastSettingStatus | null;
  rules: OutlierRule[];
  itemPolicies: ItemPolicy[];
  error: string | null;
}> {
  await requireAdmin();
  try {
    const supabase = await createSupabaseServerClient();
    const [statusResult, rulesResult, itemPoliciesResult] = await Promise.all([
      supabase.schema('analytics').from('v_forecast_setting_status').select('*').maybeSingle(),
      supabase.schema('core').from('outlier_rule').select('rule_id,rule_code,rule_type,enabled,exclude_from_training,priority,description').order('priority'),
      supabase.schema('core').from('item_policy').select('item_id,moq,pack_size,item_grade,service_level').order('item_id'),
    ]);
    const queryError = statusResult.error ?? rulesResult.error ?? itemPoliciesResult.error;
    if (queryError) return { status: null, rules: [], itemPolicies: [], error: queryError.message };
    return {
      status: normalizeForecastSettingStatus(statusResult.data as Record<string, unknown> | null),
      rules: (rulesResult.data ?? []).map((row) => normalizeOutlierRule(row as Record<string, unknown>)),
      itemPolicies: (itemPoliciesResult.data ?? []).map((row) => normalizeItemPolicy(row as Record<string, unknown>)),
      error: null,
    };
  } catch (error) {
    return {
      status: null,
      rules: [],
      itemPolicies: [],
      error: error instanceof Error ? error.message : 'Forecast 설정 조회에 실패했습니다.',
    };
  }
}

export async function getShipmentTrend(itemCode: string): Promise<{ rows: ShipmentByHocTrend[]; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: itemData, error: itemError } = await supabase.schema('raw').from('dim_item').select('item_code,hoc_code').eq('item_code', itemCode).maybeSingle();
    if (itemError) return { rows: [], error: itemError.message };
    const hocItem = asString((itemData as DataRow | null)?.hoc_code) ?? itemCode;
    if (!itemData) return { rows: [], error: null };
    const { data, error } = await supabase.schema('core').from('v_shipment_by_hoc').select('ym,qty').eq('hoc_item', hocItem).order('ym');
    if (error) return { rows: [], error: error.message };
    const series = makeDenseMonthlySeries((data ?? []) as DataRow[]);
    if (series.rows === null) return { rows: [{ itemCode, hocItem, monthlyQty: [], avg3m: null, avg6m: null, avg12m: null, observedMonths: null, latestYm: null, latestQty: null, dataAsOf: null, reason: series.reason }], error: null };
    if (series.rows.length === 0) return { rows: [{ itemCode, hocItem, monthlyQty: [], avg3m: null, avg6m: null, avg12m: null, observedMonths: 0, latestYm: null, latestQty: null, dataAsOf: null, reason: 'NO_SHIPMENT_HISTORY' }], error: null };
    const latest = series.rows[series.rows.length - 1];
    return { rows: [{ itemCode, hocItem, monthlyQty: series.rows, avg3m: averageOfLast(series.rows, 3), avg6m: averageOfLast(series.rows, 6), avg12m: averageOfLast(series.rows, 12), observedMonths: series.rows.length, latestYm: latest.ym, latestQty: latest.qty, dataAsOf: latest.ym, reason: null }], error: null };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : 'Shipment trend query failed.' };
  }
}

export async function getDemandProfile(itemCode: string): Promise<{ rows: DemandProfile[]; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: itemData, error: itemError } = await supabase.schema('raw').from('dim_item').select('item_code').eq('item_code', itemCode).maybeSingle();
    if (itemError) return { rows: [], error: itemError.message };
    if (!itemData) return { rows: [], error: null };
    const { data, error } = await supabase.schema('raw').from('fact_shipment').select('ym,qty').eq('item_code', itemCode).order('ym');
    if (error) return { rows: [], error: error.message };
    const series = makeDenseMonthlySeries((data ?? []) as DataRow[]);
    if (series.rows === null) return { rows: [{ itemCode, adi: null, cvSquared: null, zeroDemandRate: null, observedMonths: null, demandType: null, dataAsOf: null, reason: series.reason }], error: null };
    if (series.rows.length === 0) return { rows: [{ itemCode, adi: null, cvSquared: null, zeroDemandRate: null, observedMonths: 0, demandType: null, dataAsOf: null, reason: 'NO_SHIPMENT_HISTORY' }], error: null };
    const positive = series.rows.filter((row) => row.qty > 0).map((row) => row.qty);
    const latestYm = series.rows[series.rows.length - 1].ym;
    const zeroDemandRate = series.rows.filter((row) => row.qty === 0).length / series.rows.length;
    if (series.rows.length < 6) return { rows: [{ itemCode, adi: null, cvSquared: null, zeroDemandRate, observedMonths: series.rows.length, demandType: null, dataAsOf: latestYm, reason: 'INSUFFICIENT_HISTORY' }], error: null };
    if (positive.length === 0) return { rows: [{ itemCode, adi: null, cvSquared: null, zeroDemandRate, observedMonths: series.rows.length, demandType: null, dataAsOf: latestYm, reason: 'NO_POSITIVE_DEMAND' }], error: null };
    const adi = series.rows.length / positive.length;
    if (positive.length < 2) return { rows: [{ itemCode, adi, cvSquared: null, zeroDemandRate, observedMonths: series.rows.length, demandType: null, dataAsOf: latestYm, reason: 'INSUFFICIENT_NONZERO_MONTHS' }], error: null };
    const mean = positive.reduce((sum, qty) => sum + qty, 0) / positive.length;
    if (mean === 0) return { rows: [{ itemCode, adi, cvSquared: null, zeroDemandRate, observedMonths: series.rows.length, demandType: null, dataAsOf: latestYm, reason: 'ZERO_MEAN_DEMAND' }], error: null };
    const variance = positive.reduce((sum, qty) => sum + (qty - mean) ** 2, 0) / (positive.length - 1);
    const cvSquared = variance / (mean ** 2);
    return { rows: [{ itemCode, adi, cvSquared, zeroDemandRate, observedMonths: series.rows.length, demandType: classifyDemand(adi, cvSquared), dataAsOf: latestYm, reason: null }], error: null };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : 'Demand profile query failed.' };
  }
}

export async function getDemandProfileRt(itemCode?: string): Promise<{ rows: DemandProfileRt[]; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    let query = supabase.schema('analytics').from('v_item_demand_profile').select('*').order('item_code');
    if (itemCode) query = query.eq('item_code', itemCode);
    const { data, error } = await query;
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []).map((row) => normalizeDemandProfileRt(row as Record<string, unknown>)), error: null };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : 'Demand profile query failed.' };
  }
}

export async function getOlAccuracy(modelBase: string, fy: string | null = null): Promise<{ rows: OlAccuracyResult[]; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    let query = supabase.schema('raw').from('fact_mc_plan_actual').select('fy_sheet,ym,sales_ol,scm_ol,act').eq('model_base', modelBase).order('ym');
    if (fy) query = query.eq('fy_sheet', fy);
    const { data, error } = await query;
    if (error) return { rows: [], error: error.message };
    const sourceRows = (data ?? []) as DataRow[];
    if (sourceRows.length === 0) return { rows: [], error: null };
    const score = (field: 'sales_ol' | 'scm_ol') => {
      const rows = sourceRows.filter((row) => asNumber(row.act) !== null && asNumber(row[field]) !== null);
      const denominator = rows.reduce((sum, row) => sum + (asNumber(row.act) ?? 0), 0);
      if (rows.length === 0) return { wape: null, bias: null, count: null, reason: 'NO_SCORABLE_ACTUAL' };
      if (denominator === 0) return { wape: null, bias: null, count: rows.length, reason: 'ZERO_ACTUAL_DENOMINATOR' };
      const absoluteError = rows.reduce((sum, row) => sum + Math.abs((asNumber(row[field]) ?? 0) - (asNumber(row.act) ?? 0)), 0);
      const signedError = rows.reduce((sum, row) => sum + ((asNumber(row[field]) ?? 0) - (asNumber(row.act) ?? 0)), 0);
      return { wape: absoluteError / denominator, bias: signedError / denominator, count: rows.length, reason: null };
    };
    const sales = score('sales_ol');
    const scm = score('scm_ol');
    const reasons = [sales.reason && `SALES_${sales.reason}`, scm.reason && `SCM_${scm.reason}`].filter(Boolean).join('|') || null;
    const dataAsOf = sourceRows.map((row) => asString(row.ym)).filter((ym): ym is string => ym !== null).sort().at(-1) ?? null;
    return { rows: [{ modelBase, fiscalYear: fy, salesWape: sales.wape, salesBias: sales.bias, scmWape: scm.wape, scmBias: scm.bias, salesScoredRows: sales.count, scmScoredRows: scm.count, dataAsOf, reason: reasons }], error: null };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : 'OL accuracy query failed.' };
  }
}

export async function getBomRequirement(modelBase: string): Promise<{ rows: BomRequirementResult[]; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: modelData, error: modelError } = await supabase.schema('raw').from('dim_model').select('model_base').eq('model_base', modelBase).maybeSingle();
    if (modelError) return { rows: [], error: modelError.message };
    if (!modelData || modelBase.trim() === '') return { rows: [], error: null };
    const { data: capData, error: capError } = await supabase.schema('raw').from('bridge_mc_cap').select('model_base,cap_item_code,cap_item_name').eq('model_base', modelBase);
    if (capError) return { rows: [], error: capError.message };
    const caps = (capData ?? []) as DataRow[];
    if (caps.length === 0) return { rows: [{ modelBase, capItemCode: null, capItemName: null, optionItemCode: null, optionDescription: null, optionRole: null, sccItemCode: null, sccLabel: null, componentItemCode: null, componentQty: null, common: null, dataAsOf: null, reason: 'NO_CAP_CONFIGURATION' }], error: null };
    const capCodes = caps.map((row) => asString(row.cap_item_code)).filter((code): code is string => code !== null);
    if (capCodes.length === 0) return { rows: [{ modelBase, capItemCode: null, capItemName: null, optionItemCode: null, optionDescription: null, optionRole: null, sccItemCode: null, sccLabel: null, componentItemCode: null, componentQty: null, common: null, dataAsOf: null, reason: 'MISSING_CAP_ITEM_CODE' }], error: null };
    const [optionResult, bomResult, sccResult, commonResult] = await Promise.all([
      supabase.schema('raw').from('bridge_cap_option').select('cap_item_code,option_item_code,option_desc,role').in('cap_item_code', capCodes).eq('role', 'MUST_OPTION'),
      supabase.schema('raw').from('bridge_bom').select('model_base,item_code,qty').eq('model_base', modelBase),
      supabase.schema('raw').from('bridge_scc_config').select('neutral_item_code,scc_item_code,scc_desc').eq('model_base', modelBase),
      supabase.schema('raw').from('bridge_option_model').select('item_code,common').eq('model_base', modelBase),
    ]);
    const queryError = optionResult.error ?? bomResult.error ?? sccResult.error ?? commonResult.error;
    if (queryError) return { rows: [], error: queryError.message };
    const options = (optionResult.data ?? []) as DataRow[];
    const boms = (bomResult.data ?? []) as DataRow[];
    const sccByCap = new Map(((sccResult.data ?? []) as DataRow[]).map((row) => [asString(row.neutral_item_code), row]));
    const commonByItem = new Map(((commonResult.data ?? []) as DataRow[]).map((row) => [asString(row.item_code), asString(row.common) === 'COMMON']));
    const rows: BomRequirementResult[] = [];
    for (const cap of caps) {
      const capCode = asString(cap.cap_item_code);
      const scc = sccByCap.get(capCode);
      const capOptions = options.filter((option) => asString(option.cap_item_code) === capCode);
      if (capOptions.length === 0) {
        rows.push({ modelBase, capItemCode: capCode, capItemName: asString(cap.cap_item_name), optionItemCode: null, optionDescription: null, optionRole: null, sccItemCode: asString(scc?.scc_item_code), sccLabel: asString(scc?.scc_desc), componentItemCode: null, componentQty: null, common: null, dataAsOf: null, reason: 'NO_MUST_OPTION' });
        continue;
      }
      for (const option of capOptions) {
        const optionCode = asString(option.option_item_code);
        const components = boms.filter((bom) => asString(bom.item_code) === optionCode);
        if (components.length === 0) {
          rows.push({ modelBase, capItemCode: capCode, capItemName: asString(cap.cap_item_name), optionItemCode: optionCode, optionDescription: asString(option.option_desc), optionRole: asString(option.role), sccItemCode: asString(scc?.scc_item_code), sccLabel: asString(scc?.scc_desc), componentItemCode: null, componentQty: null, common: commonByItem.get(optionCode) ?? null, dataAsOf: null, reason: 'NO_BOM_COMPONENT' });
          continue;
        }
        for (const component of components) {
          rows.push({ modelBase, capItemCode: capCode, capItemName: asString(cap.cap_item_name), optionItemCode: optionCode, optionDescription: asString(option.option_desc), optionRole: asString(option.role), sccItemCode: asString(scc?.scc_item_code), sccLabel: asString(scc?.scc_desc), componentItemCode: asString(component.item_code), componentQty: asNumber(component.qty), common: commonByItem.get(optionCode) ?? null, dataAsOf: null, reason: asNumber(component.qty) === null ? 'MISSING_BOM_QUANTITY' : null });
        }
      }
    }
    return { rows, error: null };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : 'BOM requirement query failed.' };
  }
}
