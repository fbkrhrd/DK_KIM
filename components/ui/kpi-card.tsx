import type { ReactNode } from 'react';

export default function KpiCard({ label, value, foot, icon }: { label: string; value: ReactNode; foot?: ReactNode; icon?: ReactNode }) {
  return <section className="ui-kpi-card"><div className="ui-kpi-head"><div className="ui-kpi-label">{label}</div>{icon}</div><div className="ui-kpi-value">{value}</div>{foot && <div className="ui-kpi-foot">{foot}</div>}</section>;
}
