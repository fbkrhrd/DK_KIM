import type { ReactNode } from 'react';
import Sidebar from './sidebar';
import Topbar from './topbar';

export default function UserShell({ children, role = 'USER' }: { children: ReactNode; role?: 'USER' | 'ADMIN' }) {
  return <div className="scm-shell"><Sidebar role={role} /><div className="scm-main"><Topbar /><main className="scm-page-content">{children}</main></div></div>;
}
