import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function AlertRow({ children }: { children: ReactNode }) {
  return <div className="ui-alert-row"><AlertTriangle size={17} /><div>{children}</div></div>;
}
