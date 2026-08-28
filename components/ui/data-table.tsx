import type { ReactNode } from 'react';
import EmptyValue from './empty-value';

export type DataColumn<T> = { key: string; label: string; align?: 'left' | 'right' | 'center'; render?: (row: T) => ReactNode };

export default function DataTable<T extends Record<string, unknown>>({ columns, rows, rowKey, empty = '데이터가 없습니다.' }: { columns: DataColumn<T>[]; rows: T[]; rowKey?: (row: T, index: number) => string; empty?: string }) {
  if (rows.length === 0) return <p className="ui-muted">{empty}</p>;
  return <div className="ui-data-table-wrap"><table className="ui-data-table"><thead><tr>{columns.map((column) => <th key={column.key} style={column.align ? { textAlign: column.align } : undefined}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={rowKey ? rowKey(row, index) : String(index)}>{columns.map((column) => <td key={column.key} style={column.align ? { textAlign: column.align } : undefined}>{column.render ? column.render(row) : row[column.key] == null ? <EmptyValue /> : String(row[column.key])}</td>)}</tr>)}</tbody></table></div>;
}
