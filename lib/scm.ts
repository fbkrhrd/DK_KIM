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
  type DemandProfileRt,
  type ForecastSettingStatus,
  type ItemPolicy,
  type LeadtimeGap,
  type OlAccuracy,
  type OlAccuracyFy,
  type OutlierRule,
  type ShipmentTrend,
  type StockoutKpi,
  type StockoutRisk,
} from './scm-model';

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

export async function getShipmentTrend(itemCode?: string): Promise<{ rows: ShipmentTrend[]; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    let query = supabase.schema('analytics').from('v_shipment_trend').select('*').order('item_code');
    if (itemCode) query = query.eq('item_code', itemCode);
    const { data, error } = await query;
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []).map((row) => normalizeShipmentTrend(row as Record<string, unknown>)), error: null };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : 'Shipment trend query failed.' };
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

export async function getOlAccuracy(modelBase?: string): Promise<{
  rows: OlAccuracy[];
  fiscalYearRows: OlAccuracyFy[];
  error: string | null;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    let accuracyQuery = supabase.schema('analytics').from('v_ol_accuracy').select('*').order('model_base');
    if (modelBase) accuracyQuery = accuracyQuery.eq('model_base', modelBase);
    const [accuracyResult, fiscalYearResult] = await Promise.all([
      accuracyQuery,
      supabase.schema('analytics').from('v_ol_accuracy_fy').select('*').order('fy_sheet'),
    ]);
    const queryError = accuracyResult.error ?? fiscalYearResult.error;
    if (queryError) return { rows: [], fiscalYearRows: [], error: queryError.message };
    return {
      rows: (accuracyResult.data ?? []).map((row) => normalizeOlAccuracy(row as Record<string, unknown>)),
      fiscalYearRows: (fiscalYearResult.data ?? []).map((row) => normalizeOlAccuracyFy(row as Record<string, unknown>)),
      error: null,
    };
  } catch (error) {
    return { rows: [], fiscalYearRows: [], error: error instanceof Error ? error.message : 'OL accuracy query failed.' };
  }
}

export async function getBomRequirement(modelBase: string): Promise<{ rows: BomRequirement[]; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .schema('analytics')
      .from('v_bom_requirement_x')
      .select('*')
      .eq('model_base', modelBase)
      .order('item_code');
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []).map((row) => normalizeBomRequirement(row as Record<string, unknown>)), error: null };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : 'BOM requirement query failed.' };
  }
}
