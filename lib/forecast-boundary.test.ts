import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const migrationPath = join(root, 'supabase', 'migrations', '20260828000200_add_forecast_data_isolation.sql');
const migration = readFileSync(migrationPath, 'utf8');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

test('defines non-overlapping train and test database boundaries', () => {
  assert.match(migration, /check \(train_end is null or test_start is null or train_end < test_start\)/);
  assert.match(migration, /u\.use_date between s\.train_start and s\.train_end/);
  assert.match(migration, /u\.use_date between s\.test_start and s\.test_end/);
  assert.match(migration, /create or replace view analytics\.v_data_coverage/);
});

test('adds ingestion tracking to every current raw input table', () => {
  const rawTables = [
    'shipment_log', 'supplier_master', 'item_master', 'inventory',
    'usage_history', 'forecast', 'goods_receipt', 'purchase_order',
    'business_event', 'sales_order', 'item_substitute',
  ];
  for (const table of rawTables) assert.match(migration, new RegExp(`'${table}'`));
  for (const column of ['batch_id', 'source_type', 'loaded_at', 'source_record_id']) {
    assert.match(migration, new RegExp(`add column if not exists ${column}`));
  }
});

test('keeps forecast dates out of application and migration literals', () => {
  const appSource = [...sourceFiles(join(root, 'app')), ...sourceFiles(join(root, 'lib'))]
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n');
  assert.doesNotMatch(appSource, /schema\(['"]raw['"]\)[\s\S]{0,120}from\(['"]usage_history['"]\)/);
  assert.doesNotMatch(migration, /(?:train|test)_(?:start|end)[^\n]*['"]20\d{2}-\d{2}-\d{2}['"]/i);
});

test('routes Demand Profile calculations through the train view', () => {
  const usageProfileDefinition = migration.split('create or replace view core.v_usage_effective')[1]
    .split('create or replace view analytics.v_usage_anomaly')[0];
  assert.match(usageProfileDefinition, /from core\.v_train_demand/);
  assert.doesNotMatch(usageProfileDefinition, /raw\.usage_history/);
});
