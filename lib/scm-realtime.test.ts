import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeBomRequirement,
  normalizeDemandProfileRt,
  normalizeOlAccuracy,
  normalizeOlAccuracyFy,
  normalizeShipmentTrend,
} from './scm-model.ts';

test('normalizes the verified live shipment trend values', () => {
  const row = normalizeShipmentTrend({
    item_code: '602K02693',
    n_months: 40,
    avg_3m: 779.0,
    avg_12m: 772.3,
    reason_code: null,
  });

  assert.equal(row.itemCode, '602K02693');
  assert.equal(row.nMonths, 40);
  assert.equal(row.avg3m, 779.0);
  assert.equal(row.avg12m, 772.3);
  assert.equal(row.reasonCode, null);
});

test('normalizes real-time demand profile values without replacing unavailable values', () => {
  const row = normalizeDemandProfileRt({
    item_code: '602K02693',
    description: 'KIT FEED ROLLER LM28',
    adi: null,
    cv_squared: null,
    demand_type: null,
    reason_code: 'INSUFFICIENT_PERIODS',
  });

  assert.equal(row.itemCode, '602K02693');
  assert.equal(row.description, 'KIT FEED ROLLER LM28');
  assert.equal(row.adi, null);
  assert.equal(row.cvSquared, null);
  assert.equal(row.demandType, null);
  assert.equal(row.reasonCode, 'INSUFFICIENT_PERIODS');
});

test('normalizes OL accuracy and fiscal-year summary rows', () => {
  const accuracy = normalizeOlAccuracy({
    model_base: 'MDL121',
    fy_sheet: 'FY25',
    sales_wape: 12.5,
    scm_wape: 9.8,
    reason_code: null,
  });
  const fiscalYear = normalizeOlAccuracyFy({
    fy_sheet: 'FY25',
    n_scored: 31,
    sales_wape: 12.5,
    scm_wape: 9.8,
  });

  assert.equal(accuracy.modelBase, 'MDL121');
  assert.equal(accuracy.salesWape, 12.5);
  assert.equal(accuracy.scmWape, 9.8);
  assert.equal(accuracy.reasonCode, null);
  assert.equal(fiscalYear.fiscalYear, 'FY25');
  assert.equal(fiscalYear.nScored, 31);
});

test('normalizes BOM requirement rows and preserves null values', () => {
  const row = normalizeBomRequirement({
    model_base: 'MDL121',
    model_key: 'MDL121-HIGH',
    part_role: 'MAIN',
    item_code: '602K02693',
    qty: null,
    n_models: 4,
    common_flag: 'COMMON',
  });

  assert.equal(row.modelBase, 'MDL121');
  assert.equal(row.itemCode, '602K02693');
  assert.equal(row.qty, null);
  assert.equal(row.nModels, 4);
  assert.equal(row.commonFlag, 'COMMON');
});
