import type { Metadata } from 'next';
import UserShell from '@/components/shell/user-shell';

export const metadata: Metadata = { title: 'SCM 분석 | Supply Chain Manager' };

export default function AnalysisLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <UserShell>{children}</UserShell>;
}
