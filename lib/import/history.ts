import type { ImportMode, ImportType } from './types';

export type UploadBatchSummary = { batch_id: string; file_name: string; import_type: ImportType; import_mode: ImportMode; total_rows: number; success_rows: number; warning_rows: number; error_rows: number; status: string; uploaded_at: string; imported_at: string | null };
