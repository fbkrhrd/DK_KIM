import { requireAdmin } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

export async function GET(request: Request) {
  await requireAdmin();
  const batchId = new URL(request.url).searchParams.get('batch_id');
  if (!batchId) return new Response('batch_id is required', { status: 400 });
  const supabase = await createSupabaseServerClient();
  const [{ data: errors, error }, { data: staging }] = await Promise.all([
    supabase.schema('core').from('validation_error').select('row_number,error_code,error_message,severity,original_value').eq('batch_id', batchId),
    supabase.schema('core').from('import_staging').select('row_number,original_row').eq('batch_id', batchId),
  ]);
  if (error) return new Response(error.message, { status: 400 });
  const originalByRow = new Map((staging ?? []).map((row) => [row.row_number, row.original_row as Record<string, unknown>]));
  const originalHeaders = Array.from(new Set(Array.from(originalByRow.values()).flatMap((row) => Object.keys(row))));
  const lines = [['row_number', ...originalHeaders, 'error_code', 'error_message', 'severity', 'original_value'].map(escape).join(',')];
  (errors ?? []).forEach((row) => { const original = originalByRow.get(row.row_number) ?? {}; lines.push([row.row_number, ...originalHeaders.map((header) => original[header]), row.error_code, row.error_message, row.severity, row.original_value].map(escape).join(',')); });
  return new Response(lines.join('\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="validation-errors.csv"' } });
}
