import { createSupabaseServerClient } from './supabase';

export async function getForecastRuns() {
  const supabase = await createSupabaseServerClient();
  const [runs, models, kpi] = await Promise.all([
    supabase.schema('analytics').from('v_forecast_run').select('*').order('started_at', { ascending: false }),
    supabase.schema('analytics').from('v_model_config').select('*').order('model_id'),
    supabase.schema('analytics').from('v_forecast_run_kpi').select('*').maybeSingle(),
  ]);
  return { runs: runs.data ?? [], models: models.data ?? [], kpi: kpi.data, error: runs.error?.message ?? models.error?.message ?? kpi.error?.message ?? null };
}
