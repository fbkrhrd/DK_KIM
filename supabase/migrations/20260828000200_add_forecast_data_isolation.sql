-- STEP 3: Extend source data and establish train/test boundaries.
-- STEP 2 (core.app_user and core.is_admin) must be applied first.
-- Existing raw tables are altered in place; no source table is dropped or recreated.

create extension if not exists pgcrypto;

create table if not exists raw.business_event (
  business_event_id text,
  event_date date,
  event_type text,
  item_id text,
  warehouse text,
  quantity_impact numeric,
  description text,
  batch_id uuid,
  source_type text,
  loaded_at timestamptz not null default now(),
  source_record_id text
);

create table if not exists raw.sales_order (
  sales_order_id text,
  sales_order_line_id text,
  customer_id text,
  item_id text,
  order_date date,
  requested_date date,
  qty numeric,
  warehouse text,
  status text,
  batch_id uuid,
  source_type text,
  loaded_at timestamptz not null default now(),
  source_record_id text
);

create table if not exists raw.item_substitute (
  item_id text,
  substitute_item_id text,
  conversion_rate numeric,
  priority integer,
  effective_start date,
  effective_end date,
  active boolean,
  batch_id uuid,
  source_type text,
  loaded_at timestamptz not null default now(),
  source_record_id text
);

-- Existing imports do not have batch metadata. Nullable identifiers preserve those rows,
-- while loaded_at receives the migration timestamp and defaults for future loads.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'shipment_log', 'supplier_master', 'item_master', 'inventory',
    'usage_history', 'forecast', 'goods_receipt', 'purchase_order',
    'business_event', 'sales_order', 'item_substitute'
  ]
  loop
    if to_regclass(format('raw.%I', table_name)) is null then
      continue;
    end if;

    execute format('alter table raw.%I add column if not exists batch_id uuid', table_name);
    execute format('alter table raw.%I add column if not exists source_type text', table_name);
    execute format('alter table raw.%I add column if not exists loaded_at timestamptz not null default now()', table_name);
    execute format('alter table raw.%I add column if not exists source_record_id text', table_name);
    execute format('create index if not exists %I on raw.%I (batch_id)', table_name || '_batch_id_idx', table_name);
    execute format('create index if not exists %I on raw.%I (source_type, source_record_id)', table_name || '_source_record_idx', table_name);
  end loop;
end;
$$;

create index if not exists usage_history_item_date_idx on raw.usage_history (item_id, use_date);
create index if not exists business_event_item_date_idx on raw.business_event (item_id, event_date);
create index if not exists sales_order_item_date_idx on raw.sales_order (item_id, requested_date);
create index if not exists item_substitute_item_idx on raw.item_substitute (item_id, active);

create table if not exists core.policy_config (
  policy_id text primary key,
  service_level numeric check (service_level is null or service_level > 0 and service_level <= 1),
  review_period_days integer check (review_period_days is null or review_period_days > 0),
  safety_buffer_days numeric check (safety_buffer_days is null or safety_buffer_days >= 0),
  operating_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists core.outlier_rule (
  rule_id uuid primary key default gen_random_uuid(),
  rule_code text not null unique,
  rule_type text not null check (rule_type in ('PROJECT_DEMAND', 'RETURN', 'DUPLICATE', 'CUSTOM')),
  enabled boolean not null default true,
  exclude_from_training boolean not null default true,
  note_pattern text,
  quantity_threshold numeric,
  priority integer not null default 100,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  check (rule_type <> 'PROJECT_DEMAND' or note_pattern is not null),
  check (rule_type <> 'RETURN' or quantity_threshold is not null)
);

create table if not exists core.item_policy (
  item_id text primary key,
  moq numeric check (moq is null or moq > 0),
  pack_size numeric check (pack_size is null or pack_size > 0),
  item_grade text,
  service_level numeric check (service_level is null or service_level > 0 and service_level <= 1),
  operating_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists core.forecast_setting (
  setting_id text primary key,
  train_start date,
  train_end date,
  test_start date,
  test_end date,
  granularity text not null default 'DAY' check (granularity in ('DAY', 'WEEK', 'MONTH')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  check (
    (train_start is null and train_end is null and test_start is null and test_end is null)
    or
    (train_start is not null and train_end is not null and test_start is not null and test_end is not null)
  ),
  check (train_start is null or train_start <= train_end),
  check (test_start is null or test_start <= test_end),
  check (train_end is null or test_start is null or train_end < test_start)
);

create unique index if not exists forecast_setting_one_active_idx
  on core.forecast_setting (active)
  where active = true;
create index if not exists outlier_rule_training_idx
  on core.outlier_rule (rule_type, priority)
  where enabled = true and exclude_from_training = true;
create index if not exists item_policy_grade_idx on core.item_policy (item_grade);

create or replace function core.set_updated_at()
returns trigger
language plpgsql
set search_path = core, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['policy_config', 'outlier_rule', 'item_policy', 'forecast_setting']
  loop
    execute format('drop trigger if exists %I on core.%I', table_name || '_set_updated_at', table_name);
    execute format(
      'create trigger %I before update on core.%I for each row execute function core.set_updated_at()',
      table_name || '_set_updated_at', table_name
    );
  end loop;
end;
$$;

insert into core.policy_config (policy_id)
values ('DEFAULT')
on conflict (policy_id) do nothing;

insert into core.forecast_setting (setting_id, granularity)
values ('DEFAULT', 'DAY')
on conflict (setting_id) do nothing;

insert into core.outlier_rule (
  rule_code, rule_type, note_pattern, quantity_threshold, priority, description
)
values
  ('EXCLUDE_PROJECT_DEMAND', 'PROJECT_DEMAND', '%프로젝트%', null, 10, '프로젝트성 수요를 학습에서 제외'),
  ('EXCLUDE_RETURNS', 'RETURN', null, 0, 20, '반품 수량을 학습에서 제외'),
  ('EXCLUDE_DUPLICATE_SOURCE', 'DUPLICATE', null, null, 30, '동일 배치와 원천 레코드의 중복 적재를 제외')
on conflict (rule_code) do nothing;

insert into core.item_policy (item_id)
select distinct upper(regexp_replace(item_id, '[\s\-_]', '', 'g'))
from raw.usage_history
where item_id is not null and trim(item_id) <> ''
on conflict (item_id) do nothing;

-- Only this boundary view reads raw.usage_history for model training.
create or replace view core.v_train_demand
with (security_invoker = true, security_barrier = true)
as
with active_setting as (
  select train_start, train_end, granularity
  from core.forecast_setting
  where active = true
  limit 1
),
ranked as (
  select
    u.usage_id,
    upper(regexp_replace(u.item_id, '[\s\-_]', '', 'g')) as item_id,
    u.use_date,
    u.qty,
    u.warehouse,
    u.note,
    u.batch_id,
    u.source_type,
    u.loaded_at,
    u.source_record_id,
    s.granularity,
    case s.granularity
      when 'WEEK' then date_trunc('week', u.use_date)::date
      when 'MONTH' then date_trunc('month', u.use_date)::date
      else u.use_date
    end as period_start,
    row_number() over (
      partition by
        coalesce(u.batch_id::text, 'NO_BATCH'),
        coalesce(
          nullif(u.source_record_id, ''),
          nullif(u.usage_id, ''),
          md5(concat_ws('|', u.item_id, u.use_date::text, u.qty::text, u.warehouse, u.note))
        )
      order by u.loaded_at, u.usage_id nulls last
    ) as duplicate_rank
  from raw.usage_history u
  cross join active_setting s
  where s.train_start is not null
    and s.train_end is not null
    and u.use_date between s.train_start and s.train_end
)
select
  r.usage_id,
  r.item_id,
  r.use_date,
  r.period_start,
  r.qty,
  r.warehouse,
  r.note,
  r.batch_id,
  r.source_type,
  r.loaded_at,
  r.source_record_id,
  r.granularity
from ranked r
where r.item_id is not null
  and r.use_date is not null
  and r.qty is not null
  and not exists (
    select 1
    from core.outlier_rule rule
    where rule.enabled = true
      and rule.exclude_from_training = true
      and rule.rule_type = 'RETURN'
      and r.qty < rule.quantity_threshold
  )
  and not exists (
    select 1
    from core.outlier_rule rule
    where rule.enabled = true
      and rule.exclude_from_training = true
      and rule.rule_type = 'PROJECT_DEMAND'
      and coalesce(r.note, '') ilike rule.note_pattern
  )
  and not (
    r.duplicate_rank > 1
    and exists (
      select 1
      from core.outlier_rule rule
      where rule.enabled = true
        and rule.exclude_from_training = true
        and rule.rule_type = 'DUPLICATE'
    )
  );

-- This boundary is reserved for backtest scoring and is never used by training profiles.
create or replace view core.v_test_actual
with (security_invoker = true, security_barrier = true)
as
with active_setting as (
  select test_start, test_end, granularity
  from core.forecast_setting
  where active = true
  limit 1
),
ranked as (
  select
    u.usage_id,
    upper(regexp_replace(u.item_id, '[\s\-_]', '', 'g')) as item_id,
    u.use_date,
    u.qty as actual_qty,
    u.warehouse,
    u.note,
    u.batch_id,
    u.source_type,
    u.loaded_at,
    u.source_record_id,
    s.granularity,
    case s.granularity
      when 'WEEK' then date_trunc('week', u.use_date)::date
      when 'MONTH' then date_trunc('month', u.use_date)::date
      else u.use_date
    end as period_start,
    row_number() over (
      partition by
        coalesce(u.batch_id::text, 'NO_BATCH'),
        coalesce(
          nullif(u.source_record_id, ''),
          nullif(u.usage_id, ''),
          md5(concat_ws('|', u.item_id, u.use_date::text, u.qty::text, u.warehouse, u.note))
        )
      order by u.loaded_at, u.usage_id nulls last
    ) as duplicate_rank
  from raw.usage_history u
  cross join active_setting s
  where s.test_start is not null
    and s.test_end is not null
    and u.use_date between s.test_start and s.test_end
)
select
  r.usage_id,
  r.item_id,
  r.use_date,
  r.period_start,
  r.actual_qty,
  r.warehouse,
  r.note,
  r.batch_id,
  r.source_type,
  r.loaded_at,
  r.source_record_id,
  r.granularity
from ranked r
where r.item_id is not null
  and r.use_date is not null
  and r.actual_qty is not null
  and not (
    r.duplicate_rank > 1
    and exists (
      select 1
      from core.outlier_rule rule
      where rule.enabled = true
        and rule.rule_type = 'DUPLICATE'
    )
  );

-- Demand Profile now consumes the training boundary instead of raw history.
create or replace view core.v_usage_effective
with (security_invoker = true)
as
with calc as (
  select
    item_id,
    count(distinct use_date) as valid_days,
    round(avg(qty), 2) as daily_usage_avg,
    round(stddev_samp(qty), 2) as daily_usage_sd
  from core.v_train_demand
  group by item_id
)
select
  c.item_id,
  coalesce(p.valid_days::bigint, c.valid_days) as valid_days,
  coalesce(p.daily_usage_avg, c.daily_usage_avg) as daily_usage_avg,
  coalesce(p.daily_usage_sd, c.daily_usage_sd) as daily_usage_sd,
  round(coalesce(p.daily_usage_avg, c.daily_usage_avg), 2) as usage_used,
  round(
    coalesce(p.daily_usage_sd, c.daily_usage_sd)
      / nullif(coalesce(p.daily_usage_avg, c.daily_usage_avg), 0),
    2
  ) as cv,
  case when p.item_id is not null then '확정값' else '학습기간 기준' end as source
from calc c
left join core.usage_profile p on p.item_id = c.item_id;

-- Anomaly statistics also use training rows only, preventing test actual leakage.
create or replace view analytics.v_usage_anomaly
with (security_invoker = true)
as
with stat as (
  select item_id, avg(qty) as avg_qty, stddev_samp(qty) as sd_qty
  from core.v_train_demand
  group by item_id
)
select
  u.usage_id,
  u.item_id,
  u.use_date,
  u.qty,
  round(s.avg_qty, 1) as avg_qty,
  round(u.qty / nullif(s.avg_qty, 0), 1) as ratio,
  u.note,
  'UNEXPLAINED'::text as anomaly_type
from core.v_train_demand u
join stat s on s.item_id = u.item_id
where u.qty > s.avg_qty + 3 * s.sd_qty
   or u.qty < 0;

create or replace view analytics.v_data_coverage
with (security_invoker = true)
as
with source_coverage as (
  select min(use_date) as data_start, max(use_date) as data_end
  from raw.usage_history
  where use_date is not null
),
setting as (
  select setting_id, train_start, train_end, test_start, test_end, granularity
  from core.forecast_setting
  where active = true
  limit 1
),
train_coverage as (
  select count(*) as row_count, min(use_date) as actual_start, max(use_date) as actual_end
  from core.v_train_demand
),
test_coverage as (
  select count(*) as row_count, min(use_date) as actual_start, max(use_date) as actual_end
  from core.v_test_actual
)
select
  s.data_start,
  s.data_end,
  f.train_start,
  f.train_end,
  f.test_start,
  f.test_end,
  f.granularity,
  tr.row_count as train_row_count,
  te.row_count as test_row_count,
  (
    f.train_start is not null
    and f.train_end is not null
    and s.data_start <= f.train_start
    and s.data_end >= f.train_end
    and tr.row_count > 0
    and tr.actual_start >= f.train_start
    and tr.actual_end <= f.train_end
  ) as train_window_ok,
  (
    f.test_start is not null
    and f.test_end is not null
    and s.data_start <= f.test_start
    and s.data_end >= f.test_end
    and te.row_count > 0
    and te.actual_start >= f.test_start
    and te.actual_end <= f.test_end
  ) as test_window_ok,
  (
    f.train_end is not null
    and f.test_start is not null
    and f.train_end < f.test_start
    and not exists (
      select 1
      from core.v_train_demand train
      join core.v_test_actual test on train.use_date = test.use_date
    )
  ) as data_isolation_ok
from source_coverage s
cross join setting f
cross join train_coverage tr
cross join test_coverage te;

create or replace view analytics.v_forecast_setting_status
with (security_invoker = true)
as
select
  coverage.*,
  policy.policy_id,
  policy.service_level,
  policy.review_period_days,
  policy.safety_buffer_days,
  policy.operating_settings,
  (select count(*) from core.outlier_rule where enabled = true) as enabled_outlier_rule_count,
  (select count(*) from core.item_policy) as item_policy_count,
  (select count(*) from core.item_policy where moq is not null and pack_size is not null) as configured_item_policy_count
from analytics.v_data_coverage coverage
left join core.policy_config policy on policy.policy_id = 'DEFAULT';

-- RLS: authenticated active users may read; only ADMIN may mutate.
revoke usage on schema raw from anon;
grant usage on schema raw to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'shipment_log', 'supplier_master', 'item_master', 'inventory',
    'usage_history', 'forecast', 'goods_receipt', 'purchase_order',
    'business_event', 'sales_order', 'item_substitute'
  ]
  loop
    if to_regclass(format('raw.%I', table_name)) is null then
      continue;
    end if;
    execute format('alter table raw.%I enable row level security', table_name);
    execute format('drop policy if exists raw_active_user_select on raw.%I', table_name);
    execute format('drop policy if exists raw_admin_insert on raw.%I', table_name);
    execute format('drop policy if exists raw_admin_update on raw.%I', table_name);
    execute format('drop policy if exists raw_admin_delete on raw.%I', table_name);
    execute format(
      'create policy raw_active_user_select on raw.%I for select to authenticated using (exists (select 1 from core.app_user u where u.user_id = (select auth.uid()) and u.active))',
      table_name
    );
    execute format(
      'create policy raw_admin_insert on raw.%I for insert to authenticated with check ((select core.is_admin()))',
      table_name
    );
    execute format(
      'create policy raw_admin_update on raw.%I for update to authenticated using ((select core.is_admin())) with check ((select core.is_admin()))',
      table_name
    );
    execute format(
      'create policy raw_admin_delete on raw.%I for delete to authenticated using ((select core.is_admin()))',
      table_name
    );
    execute format('revoke all on raw.%I from anon', table_name);
    execute format('grant select, insert, update, delete on raw.%I to authenticated', table_name);
  end loop;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['policy_config', 'outlier_rule', 'item_policy', 'forecast_setting']
  loop
    execute format('alter table core.%I enable row level security', table_name);
    execute format('drop policy if exists config_active_user_select on core.%I', table_name);
    execute format('drop policy if exists config_admin_insert on core.%I', table_name);
    execute format('drop policy if exists config_admin_update on core.%I', table_name);
    execute format('drop policy if exists config_admin_delete on core.%I', table_name);
    execute format(
      'create policy config_active_user_select on core.%I for select to authenticated using (exists (select 1 from core.app_user u where u.user_id = (select auth.uid()) and u.active))',
      table_name
    );
    execute format(
      'create policy config_admin_insert on core.%I for insert to authenticated with check ((select core.is_admin()))',
      table_name
    );
    execute format(
      'create policy config_admin_update on core.%I for update to authenticated using ((select core.is_admin())) with check ((select core.is_admin()))',
      table_name
    );
    execute format(
      'create policy config_admin_delete on core.%I for delete to authenticated using ((select core.is_admin()))',
      table_name
    );
    execute format('revoke all on core.%I from anon', table_name);
    execute format('grant select, insert, update, delete on core.%I to authenticated', table_name);
  end loop;
end;
$$;

revoke all on core.v_train_demand, core.v_test_actual from anon;
revoke all on analytics.v_data_coverage, analytics.v_forecast_setting_status from anon;
grant select on core.v_train_demand, core.v_test_actual to authenticated;
grant select on analytics.v_data_coverage, analytics.v_forecast_setting_status to authenticated;

alter default privileges in schema raw revoke all on tables from anon;
alter default privileges in schema core revoke all on tables from anon;
alter default privileges in schema analytics revoke all on tables from anon;

comment on view core.v_train_demand is 'Training-only demand boundary. Forecast and Demand Profile must use this view.';
comment on view core.v_test_actual is 'Test-only actual boundary. Reserved for backtest scoring.';
comment on view analytics.v_data_coverage is 'Forecast date coverage and train/test isolation health.';
