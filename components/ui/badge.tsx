export type Status = 'SAFE' | 'WARNING' | 'CRITICAL' | 'CALCULATION_UNAVAILABLE';

const labels: Record<Status, string> = { SAFE: 'SAFE', WARNING: 'WARNING', CRITICAL: 'CRITICAL', CALCULATION_UNAVAILABLE: 'CALCULATION UNAVAILABLE' };

export default function Badge({ status, children }: { status: Status; children?: string }) {
  return <span className={`ui-badge ui-badge-${status.toLowerCase()}`}>{children ?? labels[status]}</span>;
}
