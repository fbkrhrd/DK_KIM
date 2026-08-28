'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function updateUserRole(formData: FormData) {
  const actor = await requireAdmin();
  const userId = String(formData.get('user_id') ?? '');
  const role = String(formData.get('role') ?? '');
  if (!userId || (role !== 'ADMIN' && role !== 'USER')) throw new Error('잘못된 사용자 역할입니다.');
  if (actor.user_id === userId) throw new Error('자신의 관리자 권한은 변경할 수 없습니다.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema('core').from('app_user').update({ role }).eq('user_id', userId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/users');
}

export async function updateUserActive(formData: FormData) {
  const actor = await requireAdmin();
  const userId = String(formData.get('user_id') ?? '');
  const active = String(formData.get('active') ?? '') === 'true';
  if (!userId) throw new Error('사용자 ID가 없습니다.');
  if (actor.user_id === userId) throw new Error('자신의 계정은 비활성화할 수 없습니다.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema('core').from('app_user').update({ active }).eq('user_id', userId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/users');
}
