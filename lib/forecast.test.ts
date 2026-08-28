import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
const sql = readFileSync(join(process.cwd(),'supabase','migrations','20260828000500_add_baseline_forecast_engine.sql'),'utf8');
test('registers SQL baseline models and keeps forecasts in the train boundary',()=>{ for(const id of ['MA_3M','MA_6M','WMA_3M','PY_SAME_MONTH','SEASONAL_NAIVE']) assert.match(sql,new RegExp(id)); assert.match(sql,/from core\.v_train_demand/); assert.doesNotMatch(sql,/raw\.usage_history|core\.v_test_actual/); assert.match(sql,/run_baseline_forecast/); });
test('records versioned runs, results, intervals, and stale state',()=>{ for(const name of ['core.model_version','core.forecast_run','core.forecast_result','p80','p90','is_stale']) assert.match(sql,new RegExp(name)); });
