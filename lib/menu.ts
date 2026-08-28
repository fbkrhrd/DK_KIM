export type MenuRole = 'USER' | 'ADMIN';
export type MenuIcon = 'dashboard' | 'demand' | 'inventory' | 'logistics' | 'admin' | 'users';
export type MenuItem = { id: string; label: string; href: string; icon: MenuIcon };

export const USER_MENU: MenuItem[] = [
  { id: 'workflow', label: '\uC870\uB2EC \uACC4\uD68D', href: '/workflow', icon: 'dashboard' },
  { id: 'leadtime', label: '\uB9AC\uB4DC\uD0C0\uC784 \uACA9\uCC28', href: '/analysis/leadtime', icon: 'logistics' },
  { id: 'stockout', label: '\uC18C\uC9C4\uC704\uD5D8', href: '/analysis/stockout', icon: 'inventory' },
  { id: 'demand-profile', label: 'Demand Profile', href: '/analysis/demand-profile', icon: 'demand' },
];

export const ADMIN_MENU: MenuItem[] = [
  ...USER_MENU,
  { id: 'admin', label: '\uAD00\uB9AC\uC790', href: '/admin', icon: 'admin' },
  { id: 'admin-users', label: '\uC0AC\uC6A9\uC790 \uAD00\uB9AC', href: '/admin/users', icon: 'users' },
  { id: 'admin-forecast-settings', label: 'Forecast \uC124\uC815', href: '/admin/forecast-settings', icon: 'admin' },
  { id: 'admin-forecast-runs', label: 'Forecast Runs', href: '/admin/forecast-runs', icon: 'admin' },
  { id: 'admin-forecast-models', label: 'Forecast Models', href: '/admin/forecast-models', icon: 'admin' },
  { id: 'admin-data-management', label: 'Data Management', href: '/admin/data-management', icon: 'admin' },
];
