'use client';

import { useMemo, useState } from 'react';
import Badge, { type Status } from '@/components/ui/badge';
import DataTable, { type DataColumn } from '@/components/ui/data-table';
import EmptyValue from '@/components/ui/empty-value';
import type { DemandProfile, DemandType } from '@/lib/demand-profile';

const statusByDemandType: Record<DemandType, Status> = { SMOOTH: 'SAFE', INTERMITTENT: 'WARNING', ERRATIC: 'WARNING', LUMPY: 'CRITICAL' };
const value = (number: number | null, digits: number, reason: string) => number === null ? <EmptyValue reasonCode={reason} /> : number.toFixed(digits);
const percent = (number: number | null, reason: string) => number === null ? <EmptyValue reasonCode={reason} /> : `${(number * 100).toFixed(1)}%`;

const columns: DataColumn<DemandProfile>[] = [
  { key: 'itemId', label: 'SKU' }, { key: 'itemName', label: 'Item name' },
  { key: 'adi', label: 'ADI', align: 'right', render: (row) => value(row.adi, 2, row.reasonCode ?? 'ADI_UNAVAILABLE') },
  { key: 'cvSquared', label: 'CV\u00B2', align: 'right', render: (row) => value(row.cvSquared, 2, row.reasonCode ?? 'CV_SQUARED_UNAVAILABLE') },
  { key: 'zeroDemandRate', label: 'Zero-demand', align: 'right', render: (row) => percent(row.zeroDemandRate, 'ZERO_RATE_UNAVAILABLE') },
  { key: 'trend', label: 'Trend', align: 'right', render: (row) => value(row.trend, 2, row.reasonCode ?? 'TREND_UNAVAILABLE') },
  { key: 'demandType', label: 'Demand Type', align: 'center', render: (row) => row.demandType ? <Badge status={statusByDemandType[row.demandType]}>{row.demandType}</Badge> : <EmptyValue reasonCode={row.reasonCode ?? 'CALCULATION_UNAVAILABLE'} /> },
  { key: 'seasonality', label: 'Seasonality', align: 'center', render: (row) => row.seasonality === null ? <EmptyValue reasonCode={row.nPeriods < 24 ? 'INSUFFICIENT_PERIODS' : row.reasonCode ?? 'SEASONALITY_UNAVAILABLE'} /> : row.seasonality ? 'YES' : 'NO' },
  { key: 'reasonCode', label: 'Reason', render: (row) => row.reasonCode ?? '—' },
];

export default function DemandProfileClient({ rows }: { rows: DemandProfile[] }) {
  const [demandType, setDemandType] = useState<'ALL' | DemandType>('ALL');
  const [availability, setAvailability] = useState<'ALL' | 'AVAILABLE' | 'UNAVAILABLE'>('ALL');
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => rows.filter((row) => (demandType === 'ALL' || row.demandType === demandType) && (availability === 'ALL' || availability === 'AVAILABLE' ? row.demandType !== null : row.demandType === null) && `${row.itemId} ${row.itemName}`.toLowerCase().includes(query.toLowerCase())), [availability, demandType, query, rows]);
  return <>
    <div className="ui-filter-row">
      <label>Demand Type<select value={demandType} onChange={(event) => setDemandType(event.target.value as 'ALL' | DemandType)}><option value="ALL">ALL</option><option value="SMOOTH">SMOOTH</option><option value="INTERMITTENT">INTERMITTENT</option><option value="ERRATIC">ERRATIC</option><option value="LUMPY">LUMPY</option></select></label>
      <label>Calculation<select value={availability} onChange={(event) => setAvailability(event.target.value as 'ALL' | 'AVAILABLE' | 'UNAVAILABLE')}><option value="ALL">ALL</option><option value="AVAILABLE">Available</option><option value="UNAVAILABLE">Unavailable</option></select></label>
      <label>SKU search<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ITEM001" /></label>
    </div>
    <DataTable columns={columns} rows={filtered} rowKey={(row) => row.itemId} empty="No demand profile rows are available." />
  </>;
}
