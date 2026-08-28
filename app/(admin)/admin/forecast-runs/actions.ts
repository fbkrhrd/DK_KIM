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
