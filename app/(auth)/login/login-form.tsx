'use client';

import { useActionState } from 'react';
import { loginAction } from './actions';

export default function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(loginAction, { error: '' });
  return <form className="ui-auth-form" action={formAction}>
    <input type="hidden" name="next" value={next} />
    <label>이메일<input name="email" type="email" autoComplete="email" required /></label>
    <label>비밀번호<input name="password" type="password" autoComplete="current-password" required /></label>
    {state.error && <p className="ui-form-error" role="alert">{state.error}</p>}
    <button className="ui-button ui-button-primary" type="submit" disabled={pending}>{pending ? '로그인 중...' : '로그인'}</button>
  </form>;
}
