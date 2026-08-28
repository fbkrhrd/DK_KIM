import { Bell, History, UserCircle } from 'lucide-react';
import { logoutAction } from '@/app/(auth)/login/actions';

export default function Topbar({ title = 'Global Supply Chain Manager' }: { title?: string }) {
  return <header className="scm-topbar"><div className="scm-topbar-title">{title}</div><div className="scm-topbar-actions"><button className="ui-icon-button" aria-label="알림"><Bell size={17} /></button><button className="ui-icon-button" aria-label="기록"><History size={17} /></button><button className="ui-icon-button" aria-label="사용자"><UserCircle size={20} /></button><form action={logoutAction}><button className="ui-button ui-button-small" type="submit">로그아웃</button></form></div></header>;
}
