'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
export async function updateForecastModelAction(formData: FormData) {
  await requireAdmin();
  const parameters = JSON.parse(String(formData.get('parameters')));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema('core').from('model_config').update({ enabled: formData.get('enabled') === 'on', parameters, updated_at: new Date().toISOString() }).eq('model_id', String(formData.get('model_id')));
  if (error) throw new Error(error.message);
  revalidatePath('/admin/forecast-models');
}
