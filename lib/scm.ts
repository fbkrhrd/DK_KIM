import { createSupabaseServerClient } from './supabase';
import { normalizeLeadtimeGap, normalizeStockoutKpi, normalizeStockoutRisk, type LeadtimeGap, type StockoutKpi, type StockoutRisk } from './scm-model';

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
