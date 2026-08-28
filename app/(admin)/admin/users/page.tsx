import Badge from '@/components/ui/badge';
import EmptyValue from '@/components/ui/empty-value';
import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';
import { requireAdmin } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { updateUserActive, updateUserRole } from './actions';

type UserRow = { user_id: string; email: string; name: string | null; department: string | null; role: 'ADMIN' | 'USER'; active: boolean; last_login_at: string | null };

export default async function AdminUsersPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema('core').from('app_user').select('user_id,email,name,department,role,active,last_login_at').order('created_at', { ascending: true });
  const users = (data ?? []) as UserRow[];

  return <><PageHeader eyebrow="ADMIN / USERS" title="사용자 관리" description="사용자 역할과 계정 활성 상태를 관리합니다." /><Panel title="등록 사용자" description="변경 사항은 audit_log에 자동 기록됩니다.">{error ? <div className="ui-alert-row"><div><strong>사용자 목록을 불러오지 못했습니다.</strong><p>{error.message}</p></div></div> : <div className="ui-data-table-wrap"><table className="ui-data-table"><thead><tr><th>사용자</th><th>부서</th><th>역할</th><th>상태</th><th>최근 로그인</th><th>관리</th></tr></thead><tbody>{users.map((user) => <tr key={user.user_id}><td><strong>{user.name || user.email}</strong><div className="ui-table-subtext">{user.email}</div></td><td>{user.department || <EmptyValue reasonCode="DEPARTMENT_UNAVAILABLE" />}</td><td><span className="ui-role-badge">{user.role}</span></td><td><Badge status={user.active ? 'SAFE' : 'WARNING'}>{user.active ? 'ACTIVE' : 'INACTIVE'}</Badge></td><td>{user.last_login_at ? new Date(user.last_login_at).toLocaleString('ko-KR') : <EmptyValue reasonCode="LAST_LOGIN_UNAVAILABLE" />}</td><td><div className="ui-admin-actions"><form action={updateUserRole}><input type="hidden" name="user_id" value={user.user_id} /><input type="hidden" name="role" value={user.role === 'ADMIN' ? 'USER' : 'ADMIN'} /><button className="ui-button ui-button-small" type="submit">{user.role === 'ADMIN' ? 'USER로 변경' : 'ADMIN으로 변경'}</button></form><form action={updateUserActive}><input type="hidden" name="user_id" value={user.user_id} /><input type="hidden" name="active" value={String(!user.active)} /><button className="ui-button ui-button-small" type="submit">{user.active ? '비활성화' : '활성화'}</button></form></div></td></tr>)}</tbody></table></div>}</Panel></>;
}
