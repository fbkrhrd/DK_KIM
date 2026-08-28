import { createSupabaseServerClient } from './supabase';
import { requireAdmin } from './auth';
import {
  normalizeForecastSettingStatus,
  normalizeItemPolicy,
  normalizeLeadtimeGap,
  normalizeOutlierRule,
  normalizeStockoutKpi,
  normalizeStockoutRisk,
  type ForecastSettingStatus,
  type ItemPolicy,
  type LeadtimeGap,
  type OutlierRule,
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
