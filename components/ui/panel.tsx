import type { ReactNode } from 'react';

export default function Panel({ title, description, children }: { title?: string; description?: string; children: ReactNode }) {
  return <section className="ui-panel">{title && <div className="ui-panel-header"><div><h2>{title}</h2>{description && <p>{description}</p>}</div></div>}{children}</section>;
}
