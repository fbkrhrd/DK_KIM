import type { ReactNode } from 'react';
import { Lightbulb } from 'lucide-react';

export default function InsightBanner({ children }: { children: ReactNode }) {
  return <div className="ui-insight-banner"><Lightbulb size={17} /><div>{children}</div></div>;
}
