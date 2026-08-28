import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { ImportRow } from './types';

export async function parseUpload(file: File): Promise<{ headers: string[]; rows: ImportRow[] }> {
  const bytes = Buffer.from(await file.arrayBuffer());
  if (file.name.toLowerCase().endsWith('.xlsx')) {
    const workbook = XLSX.read(bytes, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!worksheet) throw new Error('EMPTY_WORKBOOK');
    const rows = XLSX.utils.sheet_to_json<ImportRow>(worksheet, { defval: '' });
    return { headers: Object.keys(rows[0] ?? {}), rows };
  }
  const parsed = Papa.parse<ImportRow>(bytes.toString('utf8'), { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) throw new Error('CSV_PARSE_FAILED');
  return { headers: parsed.meta.fields ?? [], rows: parsed.data };
}
