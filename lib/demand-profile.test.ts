import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '20260828000400_add_sku_demand_profile.sql'), 'utf8');
const classify = (adi: number | null, cvSquared: number | null) => adi === null || cvSquared === null ? null : adi < 1.32 && cvSquared < 0.49 ? 'SMOOTH' : adi >= 1.32 && cvSquared < 0.49 ? 'INTERMITTENT' : adi < 1.32 ? 'ERRATIC' : 'LUMPY';

test('uses the Syntetos-Boylan-Croston demand type thresholds', () => {
  assert.equal(classify(1, 0.2), 'SMOOTH');
  assert.equal(classify(2, 0.2), 'INTERMITTENT');
  assert.equal(classify(1, 0.8), 'ERRATIC');
  assert.equal(classify(2, 0.8), 'LUMPY');
  assert.equal(classify(null, null), null);
});

test('keeps demand profile calculations inside the train boundary and models unavailable cases', () => {
  assert.match(sql, /from core\.v_train_demand/);
  assert.doesNotMatch(sql, /raw\.usage_history|core\.v_test_actual/);
  assert.match(sql, /generate_series/);
  assert.match(sql, /NO_NONZERO_DEMAND|INSUFFICIENT_NONZERO_PERIODS/);
  assert.match(sql, /when s\.n_periods < 24 then null/);
});
