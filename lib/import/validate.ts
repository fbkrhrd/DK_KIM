import { schemas } from './schema';
import type { ImportRow, ImportType, ValidationIssue, ValidationResult } from './types';

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const isValidDate = (value: string) => isoDate.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

export function validateRows(type: ImportType, rows: ImportRow[], mapping: Record<string, string>, knownItems = new Set<string>(), knownSuppliers = new Set<string>()): ValidationResult {
  const schema = schemas[type];
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  const mappedRows = rows.map((row, index) => {
    const mapped: ImportRow = {};
    Object.entries(mapping).forEach(([source, target]) => { if (target) mapped[target] = String(row[source] ?? '').trim(); });
    const add = (fieldName: string, errorCode: string, errorMessage: string, severity: 'WARNING' | 'ERROR' = 'ERROR') =>
      issues.push({ rowNumber: index + 1, fieldName, errorCode, errorMessage, severity, originalValue: mapped[fieldName] || null });
    schema.required.forEach((field) => { if (!mapped[field]) add(field, 'REQUIRED_VALUE_MISSING', 'Required value is missing.'); });
    schema.numbers.forEach((field) => { if (mapped[field] && !Number.isFinite(Number(mapped[field]))) add(field, 'INVALID_NUMBER', 'Value must be numeric.'); });
    schema.dates.forEach((field) => { if (mapped[field] && !isValidDate(mapped[field])) add(field, 'INVALID_DATE', 'Date must use a valid YYYY-MM-DD value.'); });
    if (schema.item && mapped[schema.item] && knownItems.size > 0 && !knownItems.has(mapped[schema.item])) add(schema.item, 'UNKNOWN_ITEM', 'Item does not exist in the item master.');
    if (schema.supplier && mapped[schema.supplier] && knownSuppliers.size > 0 && !knownSuppliers.has(mapped[schema.supplier])) add(schema.supplier, 'UNKNOWN_SUPPLIER', 'Supplier does not exist in the supplier master.');
    if (mapped.qty && Number(mapped.qty) < 0 && type !== 'business_event') add('qty', 'ABNORMAL_NEGATIVE', 'Negative quantity is not allowed.');
    if (schema.dateOrder && mapped[schema.dateOrder[0]] && mapped[schema.dateOrder[1]] && mapped[schema.dateOrder[1]] < mapped[schema.dateOrder[0]]) add(schema.dateOrder[1], 'DATE_ORDER_INVALID', 'End date cannot be earlier than start date.');
    const fingerprint = JSON.stringify(mapped);
    if (seen.has(fingerprint)) add('*', 'DUPLICATE_ROW', 'Duplicate row in the uploaded file.', 'WARNING');
    seen.add(fingerprint);
    return mapped;
  });
  const resultRows = mappedRows.map((mapped, index) => {
    const rowIssues = issues.filter((issue) => issue.rowNumber === index + 1);
    return { rowNumber: index + 1, mapped, status: rowIssues.some((issue) => issue.severity === 'ERROR') ? 'ERROR' : rowIssues.length ? 'WARNING' : 'SUCCESS' } as const;
  });
  return { rows: resultRows, issues, success: resultRows.filter((row) => row.status === 'SUCCESS').length, warning: resultRows.filter((row) => row.status === 'WARNING').length, error: resultRows.filter((row) => row.status === 'ERROR').length };
}
