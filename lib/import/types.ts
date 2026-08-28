export const IMPORT_TYPES = ['usage_history','inventory','item_master','supplier_master','purchase_order','goods_receipt','sales_order','business_event'] as const;
export type ImportType = typeof IMPORT_TYPES[number];
export type ImportMode = 'append'|'upsert'|'replace';
export type Severity = 'WARNING'|'ERROR';
export type ImportRow = Record<string,string>;
export type ValidationIssue = { rowNumber:number; fieldName:string; errorCode:string; errorMessage:string; severity:Severity; originalValue:string|null };
export type ValidationResult = { rows:Array<{rowNumber:number; mapped:ImportRow; status:'SUCCESS'|'WARNING'|'ERROR'}>; issues:ValidationIssue[]; success:number; warning:number; error:number };
