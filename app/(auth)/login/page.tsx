import Link from 'next/link';

export default function LoginPage() {
  return <main className="ui-auth-page"><section className="ui-auth-card"><div className="scm-brand-mark">SCM</div><h1>SCM Pro 로그인</h1><p>공급망 운영 워크스페이스에 로그인하세요.</p><Link className="ui-button ui-button-primary" href="/workflow">워크스페이스 입장</Link></section></main>;
}
