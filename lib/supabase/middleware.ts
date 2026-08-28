import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseEnv } from './env';

export async function updateSession(request: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: any }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isProtected = pathname === '/workflow' || pathname.startsWith('/analysis/') || pathname.startsWith('/admin');
  if (!isProtected) return response;
  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(loginUrl);
  }

  const { data: appUser } = await supabase.schema('core').from('app_user').select('role,active').eq('user_id', user.id).maybeSingle();
  if (!appUser?.active) return new NextResponse('Forbidden', { status: 403 });
  if (pathname.startsWith('/admin') && appUser.role !== 'ADMIN') {
    return new NextResponse('Forbidden', { status: 403 });
  }
  return response;
}
