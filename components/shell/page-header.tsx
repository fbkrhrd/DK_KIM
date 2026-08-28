import type { ReactNode } from 'react';

export default function PageHeader({ eyebrow = 'ANALYSIS', title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="ui-page-header"><div><div className="ui-eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}
