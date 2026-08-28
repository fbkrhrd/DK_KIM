import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type AppRole = 'ADMIN' | 'USER';
export type AppUser = { user_id: string; email: string; name: string | null; department: string | null; role: AppRole; active: boolean; last_login_at: string | null };

export class AuthError extends Error {
  status: 401 | 403;
  constructor(message: string, status: 401 | 403) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

export async function requireUser(): Promise<AppUser> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new AuthError('로그인이 필요합니다.', 401);

  const { data, error } = await supabase.schema('core').from('app_user').select('user_id,email,name,department,role,active,last_login_at').eq('user_id', user.id).maybeSingle();
  if (error || !data) throw new AuthError('사용자 프로필을 확인할 수 없습니다.', 403);
  if (!data.active) throw new AuthError('비활성화된 계정입니다.', 403);
  return data as AppUser;
}

export async function requireAdmin(): Promise<AppUser> {
  const appUser = await requireUser();
  if (appUser.role !== 'ADMIN') throw new AuthError('관리자 권한이 필요합니다.', 403);
  return appUser;
}

export async function getRole(): Promise<AppRole | null> {
  try {
    const appUser = await requireUser();
    return appUser.role;
  } catch {
    return null;
  }
}

export function redirectToLogin(pathname: string) {
  const next = pathname.startsWith('/') && !pathname.startsWith('//') ? pathname : '/workflow';
  redirect(`/login?next=${encodeURIComponent(next)}`);
}
