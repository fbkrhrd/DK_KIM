import Link from 'next/link';
import LoginForm from './login-form';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const next = params.next?.startsWith('/') && !params.next.startsWith('//') ? params.next : '/workflow';
  return <main className="ui-auth-page"><section className="ui-auth-card"><div className="scm-brand-mark">SCM</div><h1>SCM Pro 로그인</h1><p>공급망 운영 워크스페이스에 로그인하세요.</p><LoginForm next={next} /><Link className="ui-auth-link" href="/">로그인 없이 홈으로</Link></section></main>;
}
