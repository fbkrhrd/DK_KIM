'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { parseUpload } from '@/lib/import/parse';
import { suggestMapping } from '@/lib/import/schema';
import { buildRawRow, isDemandRelated } from '@/lib/import/repository';
import { IMPORT_TYPES, type ImportMode, type ImportType } from '@/lib/import/types';
import { validateRows } from '@/lib/import/validate';

const isAllowed = (type: string, mode: string): type is ImportType & ImportMode => IMPORT_TYPES.includes(type as ImportType) && ['append', 'upsert', 'replace'].includes(mode);
const chunks = <T,>(items: T[], size = 500) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

export async function stageUploadAction(formData: FormData) {
  const actor = await requireAdmin();
  const file = formData.get('file');
  const importType = String(formData.get('import_type'));
  const importMode = String(formData.get('import_mode'));
  if (!(file instanceof File) || !isAllowed(importType, importMode)) throw new Error('INVALID_IMPORT_REQUEST');
  if (!/\.(csv|xlsx)$/i.test(file.name)) throw new Error('UNSUPPORTED_FILE');
  const parsed = await parseUpload(file);
  if (parsed.rows.length === 0) throw new Error('EMPTY_FILE');
  const supabase = await createSupabaseServerClient();
  const { data: batch, error } = await supabase.schema('core').from('upload_batch').insert({ file_name: file.name, import_type: importType, import_mode: importMode, total_rows: parsed.rows.length, uploaded_by: actor.user_id }).select('batch_id').single();
  if (error || !batch) throw new Error(error?.message ?? 'BATCH_CREATE_FAILED');
  for (const part of chunks(parsed.rows.map((originalRow, index) => ({ batch_id: batch.batch_id, row_number: index + 1, original_row: originalRow })))) {
    const { error: stagingError } = await supabase.schema('core').from('import_staging').insert(part);
    if (stagingError) throw new Error(stagingError.message);
  }
  const { data: savedMappings } = await supabase.schema('core').from('column_mapping').select('source_column,target_column').eq('import_type', importType).in('source_column', parsed.headers);
  const mapping = { ...suggestMapping(parsed.headers), ...Object.fromEntries((savedMappings ?? []).map((entry) => [entry.source_column, entry.target_column])) };
  return { batchId: batch.batch_id as string, importType, importMode, headers: parsed.headers, mapping, preview: parsed.rows.slice(0, 20) };
}

export async function validateBatchAction(formData: FormData) {
  const actor = await requireAdmin();
  const batchId = String(formData.get('batch_id'));
  const mapping = JSON.parse(String(formData.get('mapping_json'))) as Record<string, string>;
  const supabase = await createSupabaseServerClient();
  const { data: batch, error: batchError } = await supabase.schema('core').from('upload_batch').select('import_type,status').eq('batch_id', batchId).single();
  if (batchError || !batch || batch.status !== 'STAGED') throw new Error('BATCH_NOT_STAGED');
  const { data: staging, error: stagingError } = await supabase.schema('core').from('import_staging').select('row_number,original_row').eq('batch_id', batchId).order('row_number');
  if (stagingError) throw new Error(stagingError.message);
  const { data: itemRows } = await supabase.schema('raw').from('item_master').select('*');
  const { data: supplierRows } = await supabase.schema('raw').from('supplier_master').select('*');
  const knownItems = new Set((itemRows ?? []).map((row) => String((row as Record<string, unknown>)['품목코드'] ?? (row as Record<string, unknown>).item_id ?? '')).filter(Boolean));
  const knownSuppliers = new Set((supplierRows ?? []).map((row) => String((row as Record<string, unknown>)['공급업체코드'] ?? (row as Record<string, unknown>).supplier_id ?? '')).filter(Boolean));
  const result = validateRows(batch.import_type as ImportType, (staging ?? []).map((row) => row.original_row as Record<string, string>), mapping, knownItems, knownSuppliers);
  await supabase.schema('core').from('validation_error').delete().eq('batch_id', batchId);
  if (result.issues.length > 0) {
    const { error } = await supabase.schema('core').from('validation_error').insert(result.issues.map((issue) => ({ batch_id: batchId, row_number: issue.rowNumber, field_name: issue.fieldName, error_code: issue.errorCode, error_message: issue.errorMessage, severity: issue.severity, original_value: issue.originalValue })));
    if (error) throw new Error(error.message);
  }
  for (const row of result.rows) {
    const { error } = await supabase.schema('core').from('import_staging').update({ mapped_row: row.mapped, validation_status: row.status }).eq('batch_id', batchId).eq('row_number', row.rowNumber);
    if (error) throw new Error(error.message);
  }
  await supabase.schema('core').from('column_mapping').upsert(Object.entries(mapping).filter(([, target]) => target).map(([sourceColumn, targetColumn]) => ({ import_type: batch.import_type, source_column: sourceColumn, target_column: targetColumn, created_by: actor.user_id })), { onConflict: 'import_type,source_column' });
  await supabase.schema('core').from('upload_batch').update({ success_rows: result.success, warning_rows: result.warning, error_rows: result.error, status: 'VALIDATED' }).eq('batch_id', batchId);
  return result;
}

export async function importBatchAction(formData: FormData) {
  await requireAdmin();
  const batchId = String(formData.get('batch_id'));
  const confirmed = formData.get('confirmed') === 'true';
  const replaceConfirmed = formData.get('replace_confirmed') === 'true';
  const supabase = await createSupabaseServerClient();
  const { data: batch, error } = await supabase.schema('core').from('upload_batch').select('*').eq('batch_id', batchId).single();
  if (error || !batch || batch.status !== 'VALIDATED' || !confirmed || (batch.import_mode === 'replace' && !replaceConfirmed)) throw new Error('IMPORT_NOT_APPROVED');
  const { data: stagedRows } = await supabase.schema('core').from('import_staging').select('mapped_row').eq('batch_id', batchId).in('validation_status', ['SUCCESS', 'WARNING']);
  const loadedAt = new Date().toISOString();
  const payload = (stagedRows ?? []).map((row) => buildRawRow(batch.import_type as ImportType, row.mapped_row as Record<string, string>, batchId, loadedAt));
  const raw = supabase.schema('raw').from(batch.import_type);
  if (batch.import_mode === 'replace') {
    const { error: deleteError } = await raw.delete().eq('source_type', 'FILE_UPLOAD');
    if (deleteError) throw new Error(deleteError.message);
  }
  if (batch.import_mode === 'upsert') {
    for (const row of payload) {
      const { data: previousRows, error: snapshotReadError } = await raw.select('*').eq('source_type', 'FILE_UPLOAD').eq('source_record_id', String(row.source_record_id));
      if (snapshotReadError) throw new Error(snapshotReadError.message);
      if (previousRows?.length) {
        const { error: snapshotWriteError } = await supabase.schema('core').from('import_rollback_snapshot').insert(previousRows.map((rowData) => ({ batch_id: batchId, import_type: batch.import_type, row_data: rowData })));
        if (snapshotWriteError) throw new Error(snapshotWriteError.message);
      }
      const { error: deleteError } = await raw.delete().eq('source_type', 'FILE_UPLOAD').eq('source_record_id', String(row.source_record_id));
      if (deleteError) throw new Error(deleteError.message);
    }
  }
  for (const part of chunks(payload)) {
    const { error: insertError } = await raw.insert(part);
    if (insertError) throw new Error(insertError.message);
  }
  if (isDemandRelated(batch.import_type as ImportType)) await supabase.schema('core').from('forecast_stale_event').upsert({ batch_id: batchId, detected_at: loadedAt, reason_code: 'DEMAND_DATA_IMPORTED' });
  await supabase.schema('core').from('upload_batch').update({ status: 'IMPORTED', imported_at: loadedAt, replace_confirmed: batch.import_mode === 'replace' }).eq('batch_id', batchId);
  revalidatePath('/admin/data-management');
}

export async function rollbackBatchAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema('core').rpc('rollback_import_batch', { target_batch_id: String(formData.get('batch_id')) });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/data-management');
}
