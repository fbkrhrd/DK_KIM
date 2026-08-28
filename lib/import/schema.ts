import type { ImportType } from './types';

export type ImportSchema = {
  required: string[];
  dates: string[];
  numbers: string[];
  item?: string;
  supplier?: string;
  dateOrder?: [string, string];
};

export const schemas: Record<ImportType, ImportSchema> = {
  usage_history: { required: ['usage_id', 'item_id', 'use_date', 'qty'], dates: ['use_date'], numbers: ['qty'], item: 'item_id' },
  inventory: { required: ['item_id', 'warehouse', 'stock_date', 'current_stock'], dates: ['stock_date'], numbers: ['current_stock', 'safety_stock'], item: 'item_id' },
  item_master: { required: ['item_id', 'item_name'], dates: [], numbers: [] },
  supplier_master: { required: ['supplier_id', 'supplier_name'], dates: [], numbers: [], supplier: 'supplier_id' },
  purchase_order: { required: ['po_no', 'item_id', 'order_date', 'qty'], dates: ['order_date', 'due_date'], numbers: ['qty', 'unit_price'], item: 'item_id', supplier: 'supplier_id', dateOrder: ['order_date', 'due_date'] },
  goods_receipt: { required: ['receipt_no', 'po_no', 'item_id', 'receipt_date', 'qty'], dates: ['receipt_date'], numbers: ['qty'], item: 'item_id' },
  sales_order: { required: ['sales_order_id', 'item_id', 'order_date', 'qty'], dates: ['order_date', 'requested_date'], numbers: ['qty'], item: 'item_id', dateOrder: ['order_date', 'requested_date'] },
  business_event: { required: ['business_event_id', 'event_date', 'event_type'], dates: ['event_date'], numbers: ['quantity_impact'], item: 'item_id' },
};

const aliases: Record<string, string> = {
  item_id: 'item_id', item: 'item_id', sku: 'item_id', product_code: 'item_id',
  usage_id: 'usage_id', use_date: 'use_date', usage_date: 'use_date', issue_date: 'use_date', qty: 'qty', quantity: 'qty',
  supplier_id: 'supplier_id', supplier_code: 'supplier_id', supplier_name: 'supplier_name',
  item_name: 'item_name', warehouse: 'warehouse', current_stock: 'current_stock', safety_stock: 'safety_stock', stock_date: 'stock_date',
  po_no: 'po_no', purchase_order_no: 'po_no', order_date: 'order_date', due_date: 'due_date', unit_price: 'unit_price',
  receipt_no: 'receipt_no', receipt_date: 'receipt_date', sales_order_id: 'sales_order_id', requested_date: 'requested_date',
  business_event_id: 'business_event_id', event_date: 'event_date', event_type: 'event_type', quantity_impact: 'quantity_impact',
  '품목코드': 'item_id', '품목명': 'item_name', '출고일': 'use_date', '사용일': 'use_date', '출고수량': 'qty', '수량': 'qty',
  '공급업체코드': 'supplier_id', '공급업체명': 'supplier_name', '공급처코드': 'supplier_id', '공급처명': 'supplier_name',
  '창고': 'warehouse', '현재고': 'current_stock', '안전재고': 'safety_stock', '기준일자': 'stock_date',
  '발주번호': 'po_no', '발주일': 'order_date', '납기예정일': 'due_date', '단가': 'unit_price',
  '입고번호': 'receipt_no', '입고일': 'receipt_date', '입고수량': 'qty',
};

export function targetColumns(type: ImportType) {
  return Array.from(new Set([...schemas[type].required, ...schemas[type].dates, ...schemas[type].numbers, schemas[type].item, schemas[type].supplier].filter(Boolean))) as string[];
}

export function suggestMapping(headers: string[]) {
  return Object.fromEntries(headers.map((header) => {
    const key = header.trim();
    return [header, aliases[key] ?? aliases[key.toLowerCase()] ?? key.toLowerCase().replace(/\s+/g, '_')];
  }));
}
