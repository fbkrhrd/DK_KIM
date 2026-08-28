'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === 'string' ? value : '/workflow';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/workflow';
}

export async function loginAction(_previousState: { error: string | null }, formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = safeNext(formData.get('next'));
  if (!email || !password) return { error: '이메일과 비밀번호를 입력하세요.' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: '로그인에 실패했습니다. 이메일과 비밀번호를 확인하세요.' };
  await supabase.rpc('touch_last_login');
  redirect(next);
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
