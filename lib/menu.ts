export type MenuRole = 'USER' | 'ADMIN';
export type MenuIcon = 'dashboard' | 'demand' | 'inventory' | 'logistics' | 'admin';
export type MenuItem = { id: string; label: string; href: string; icon: MenuIcon };

export const USER_MENU: MenuItem[] = [
  { id: 'workflow', label: '조달 계획', href: '/workflow', icon: 'dashboard' },
  { id: 'leadtime', label: '리드타임 격차', href: '/analysis/leadtime', icon: 'logistics' },
  { id: 'stockout', label: '소진위험', href: '/analysis/stockout', icon: 'inventory' },
];

export const ADMIN_MENU: MenuItem[] = [
  ...USER_MENU,
  { id: 'admin', label: '관리자', href: '/admin', icon: 'admin' },
];
