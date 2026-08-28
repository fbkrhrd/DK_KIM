'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function runBaselineForecastAction() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema('core').rpc('run_baseline_forecast', { run_note: 'ADMIN_UI' });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/forecast-runs');
}

export async function runPythonForecastAction() {
  await requireAdmin();
  const serviceUrl = process.env.FORECAST_SERVICE_URL;
  if (!serviceUrl) throw new Error('FORECAST_SERVICE_URL_NOT_CONFIGURED');
  const response = await fetch(`${serviceUrl}/forecast/run`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ horizon: 3, models: [], train_rows: [], demand_types: {} }), cache: 'no-store' });
  if (!response.ok) throw new Error('FORECAST_SERVICE_FAILED');
  revalidatePath('/admin/forecast-runs');
}
