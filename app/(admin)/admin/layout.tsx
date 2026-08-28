import type { ReactNode } from 'react';
import { requireAdmin } from '@/lib/auth';
import UserShell from '@/components/shell/user-shell';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return <UserShell role="ADMIN">{children}</UserShell>;
}
