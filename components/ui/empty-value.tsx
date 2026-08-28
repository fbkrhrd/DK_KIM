export default function EmptyValue({ reasonCode = 'CALCULATION_UNAVAILABLE' }: { reasonCode?: string }) {
  return <span className="ui-empty-value"><span>—</span><span className="ui-empty-reason">+ {reasonCode}</span></span>;
}
