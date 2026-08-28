import Link from 'next/link';
import { BarChart3, Boxes, Gauge, Settings2, Truck } from 'lucide-react';
import { USER_MENU, ADMIN_MENU, type MenuItem, type MenuRole } from '@/lib/menu';

const icons = { dashboard: Gauge, demand: BarChart3, inventory: Boxes, logistics: Truck, admin: Settings2 };

export default function Sidebar({ role = 'USER' }: { role?: MenuRole }) {
  const items = role === 'ADMIN' ? ADMIN_MENU : USER_MENU;
  return (
    <aside className="scm-sidebar">
      <div className="scm-brand"><div className="scm-brand-mark">SCM</div><div><div className="scm-brand-name">SCM Pro</div><div className="scm-brand-subtitle">Supply Chain Manager</div></div></div>
      <nav className="scm-sidebar-section" aria-label={`${role} menu`}>
        <div className="scm-sidebar-label">{role === 'ADMIN' ? 'ADMIN' : 'OPERATIONS'}</div>
        <div className="scm-nav-list">
          {items.map((item: MenuItem) => {
            const Icon = icons[item.icon as keyof typeof icons] ?? Gauge;
            return <Link key={item.id} className="scm-nav-link" href={item.href}><Icon size={16} /><span>{item.label}</span></Link>;
          })}
        </div>
      </nav>
      <div className="scm-sidebar-spacer" />
      <div className="scm-sidebar-footer">SCM Planning Platform<br />Operational workspace</div>
    </aside>
  );
}
