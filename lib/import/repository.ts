import type { ImportRow, ImportType } from './types';

const rawColumnMap: Record<ImportType, Record<string, string>> = {
  usage_history: {},
  inventory: { item_id: '품목코드', warehouse: '창고', current_stock: '현재고', stock_date: '기준일자', safety_stock: '안전재고' },
  item_master: { item_id: '품목코드', item_name: '품목명', item_type: '품목구분', unit: '단위', standard_price: '표준단가', active: '사용여부' },
  supplier_master: { supplier_id: '공급업체코드', supplier_name: '공급업체명', country: '국가', master_lead_time_days: '표준리드타임(일)', contact: '담당자', active: '사용여부' },
  purchase_order: { po_no: '발주번호', order_date: '발주일', supplier_name: '공급업체', item_id: '품목코드', qty: '발주수량', unit_price: '단가', due_date: '납기예정일', buyer: '발주담당' },
  goods_receipt: { receipt_no: '입고번호', po_no: '발주번호', item_id: '품목코드', qty: '입고수량', receipt_date: '입고일', warehouse: '입고창고' },
  sales_order: {},
  business_event: {},
};

const recordKeys: Record<ImportType, string[]> = {
  usage_history: ['usage_id'], inventory: ['item_id', 'warehouse', 'stock_date'], item_master: ['item_id'], supplier_master: ['supplier_id'],
  purchase_order: ['po_no'], goods_receipt: ['receipt_no'], sales_order: ['sales_order_id', 'sales_order_line_id'], business_event: ['business_event_id'],
};

export function buildRawRow(type: ImportType, mapped: ImportRow, batchId: string, loadedAt: string) {
  const row: Record<string, unknown> = {};
  Object.entries(mapped).forEach(([key, value]) => { row[rawColumnMap[type][key] ?? key] = value; });
  const key = recordKeys[type].map((field) => mapped[field]).filter(Boolean).join(':');
  return { ...row, batch_id: batchId, source_type: 'FILE_UPLOAD', loaded_at: loadedAt, source_record_id: key || crypto.randomUUID() };
}

export function isDemandRelated(type: ImportType) { return type === 'usage_history' || type === 'sales_order' || type === 'business_event'; }
