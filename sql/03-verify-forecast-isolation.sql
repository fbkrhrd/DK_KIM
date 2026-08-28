-- Read-only verification for STEP 3. Run after both STEP 2 and STEP 3 migrations.

select table_schema, table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'raw'
  and column_name in ('batch_id', 'source_type', 'loaded_at', 'source_record_id')
order by table_name, column_name;

select *
from analytics.v_data_coverage;

select count(*) as train_rows_outside_setting
from core.v_train_demand demand
cross join core.forecast_setting setting
where setting.active = true
  and demand.use_date not between setting.train_start and setting.train_end;

select count(*) as test_rows_outside_setting
from core.v_test_actual actual
cross join core.forecast_setting setting
where setting.active = true
  and actual.use_date not between setting.test_start and setting.test_end;

select count(*) as train_test_date_overlap
from core.v_train_demand train
join core.v_test_actual test on test.use_date = train.use_date;

select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname in ('raw', 'core')
  and tablename in (
    'business_event', 'sales_order', 'item_substitute', 'usage_history',
    'policy_config', 'outlier_rule', 'item_policy', 'forecast_setting'
  )
order by schemaname, tablename, cmd, policyname;

select
  has_table_privilege('anon', 'raw.usage_history', 'select') as anon_raw_select,
  has_table_privilege('anon', 'core.forecast_setting', 'select') as anon_setting_select,
  has_table_privilege('authenticated', 'analytics.v_data_coverage', 'select') as authenticated_coverage_select;
