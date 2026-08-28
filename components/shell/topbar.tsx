import { Bell, History, LogOut, UserCircle } from 'lucide-react';
import { logoutAction } from '@/app/(auth)/login/actions';

export default function Topbar({ title = 'Global Supply Chain Manager' }: { title?: string }) {
  return <header className="scm-topbar">
    <div className="scm-topbar-title">{title}</div>
    <div className="scm-topbar-actions">
      <button className="ui-icon-button scm-topbar-utility" aria-label="알림"><Bell size={17} /></button>
      <button className="ui-icon-button scm-topbar-utility" aria-label="기록"><History size={17} /></button>
      <button className="ui-icon-button scm-topbar-utility" aria-label="사용자"><UserCircle size={20} /></button>
      <form className="scm-logout-form" action={logoutAction}>
        <button className="ui-button ui-button-small scm-logout-button" type="submit"><LogOut size={15} /><span>로그아웃</span></button>
      </form>
    </div>
  </header>;
}
