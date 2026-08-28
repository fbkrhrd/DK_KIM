import { createSupabaseServerClient } from './supabase';

export type DemandType = 'SMOOTH' | 'INTERMITTENT' | 'ERRATIC' | 'LUMPY';
export type DemandProfile = {
  itemId: string; itemName: string; nPeriods: number; nNonzeroPeriods: number; adi: number | null; cv: number | null; cvSquared: number | null;
  zeroDemandRate: number | null; trend: number | null; recentChangeRate: number | null; peakPeriod: string | null; demandType: DemandType | null;
  seasonality: boolean | null; reasonCode: string | null; stability: string | null;
};
export type DemandProfileKpi = { totalItems: number; smooth: number; intermittent: number; erratic: number; lumpy: number; crostonNeeded: number; unavailable: number };

const numberOrNull = (value: unknown) => value === null || value === undefined ? null : Number.isFinite(Number(value)) ? Number(value) : null;

function toProfile(row: Record<string, unknown>): DemandProfile {
  return { itemId: String(row.item_id ?? ''), itemName: String(row.item_name ?? row.item_id ?? ''), nPeriods: Number(row.n_periods ?? 0), nNonzeroPeriods: Number(row.n_nonzero_periods ?? 0), adi: numberOrNull(row.adi), cv: numberOrNull(row.cv), cvSquared: numberOrNull(row.cv_squared), zeroDemandRate: numberOrNull(row.zero_demand_rate), trend: numberOrNull(row.trend), recentChangeRate: numberOrNull(row.recent_change_rate), peakPeriod: row.peak_period as string | null, demandType: ['SMOOTH', 'INTERMITTENT', 'ERRATIC', 'LUMPY'].includes(String(row.demand_type)) ? row.demand_type as DemandType : null, seasonality: typeof row.seasonality === 'boolean' ? row.seasonality : null, reasonCode: row.reason_code as string | null, stability: row.stability as string | null };
}

export async function getDemandProfile(): Promise<{ rows: DemandProfile[]; kpi: DemandProfileKpi | null; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const [profiles, kpi] = await Promise.all([supabase.schema('analytics').from('v_sku_demand_profile').select('*').order('item_id'), supabase.schema('analytics').from('v_demand_profile_kpi').select('*').maybeSingle()]);
    if (profiles.error || kpi.error) return { rows: [], kpi: null, error: profiles.error?.message ?? kpi.error?.message ?? 'DEMAND_PROFILE_QUERY_FAILED' };
    return { rows: (profiles.data ?? []).map((row) => toProfile(row as Record<string, unknown>)), kpi: kpi.data ? { totalItems: Number(kpi.data.total_items), smooth: Number(kpi.data.n_smooth), intermittent: Number(kpi.data.n_intermittent), erratic: Number(kpi.data.n_erratic), lumpy: Number(kpi.data.n_lumpy), crostonNeeded: Number(kpi.data.n_croston_needed), unavailable: Number(kpi.data.n_calculation_unavailable) } : null, error: null };
  } catch (error) { return { rows: [], kpi: null, error: error instanceof Error ? error.message : 'DEMAND_PROFILE_QUERY_FAILED' }; }
}
