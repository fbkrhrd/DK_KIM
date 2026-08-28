-- STEP 6: reproducible, training-only SQL baseline forecast engine.
alter table core.forecast_setting add column if not exists forecast_horizon integer not null default 3 check (forecast_horizon > 0);

create table if not exists core.model_config (
  model_id text primary key, model_name text not null, family text not null, engine text not null default 'SQL', version text not null,
  enabled boolean not null default true, is_default boolean not null default false, applicable_demand_type text[] not null,
  parameters jsonb not null default '{}'::jsonb, description text, updated_at timestamptz not null default now(), updated_by uuid references auth.users(id) on delete set null
);
create table if not exists core.model_version (
  model_version_id uuid primary key default gen_random_uuid(), run_id uuid, model_id text not null references core.model_config(model_id),
  version text not null, definition jsonb not null, created_at timestamptz not null default now()
);
create table if not exists core.forecast_run (
  run_id uuid primary key default gen_random_uuid(), status text not null check(status in ('RUNNING','SUCCESS','FAILED')), granularity text not null,
  train_start date, train_end date, horizon integer not null, champion_metric text, data_snapshot_at timestamptz not null,
  models jsonb not null default '[]'::jsonb, n_models integer not null default 0, n_items integer not null default 0, n_rows integer not null default 0,
  started_at timestamptz not null default now(), finished_at timestamptz, duration_ms bigint, triggered_by uuid references auth.users(id), triggered_email text, note text, message text
);
alter table core.model_version add constraint model_version_run_fk foreign key (run_id) references core.forecast_run(run_id) on delete cascade;
create table if not exists core.forecast_result (
  run_id uuid not null references core.forecast_run(run_id) on delete cascade, model_id text not null references core.model_config(model_id),
  item_id text not null, period date not null, model_version text not null, predicted_qty numeric, p50 numeric, p80 numeric, p90 numeric, sigma numeric, basis jsonb not null default '{}'::jsonb,
  primary key(run_id, model_id, item_id, period)
);

insert into core.model_config(model_id,model_name,family,engine,version,applicable_demand_type,parameters,description) values
 ('MA_3M','3-month moving average','MOVING_AVERAGE','SQL','1.0.0',array['SMOOTH','ERRATIC'], '{"window":3}'::jsonb,'Trailing three monthly training observations'),
 ('MA_6M','6-month moving average','MOVING_AVERAGE','SQL','1.0.0',array['SMOOTH','ERRATIC'], '{"window":6}'::jsonb,'Trailing six monthly training observations'),
 ('WMA_3M','Weighted 3-month moving average','WEIGHTED_MOVING_AVERAGE','SQL','1.0.0',array['SMOOTH','ERRATIC'], '{"weights":[3,2,1]}'::jsonb,'Most-recent-first weights 3:2:1'),
 ('PY_SAME_MONTH','Prior-year same month','PRIOR_YEAR','SQL','1.0.0',array['SMOOTH','ERRATIC','INTERMITTENT','LUMPY'], '{"lag_months":12}'::jsonb,'Same calendar month in prior year'),
 ('SEASONAL_NAIVE','Seasonal naive','SEASONAL_NAIVE','SQL','1.0.0',array['SMOOTH','ERRATIC','INTERMITTENT','LUMPY'], '{"lag_months":12}'::jsonb,'Prior-year same period')
on conflict(model_id) do nothing;

create or replace function core.run_baseline_forecast(run_note text default null)
returns uuid language plpgsql security definer set search_path = core, analytics, pg_temp as $$
declare r core.forecast_run; setting core.forecast_setting; started timestamptz := clock_timestamp();
begin
 if not core.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
 select * into setting from core.forecast_setting where active limit 1;
 if not found or setting.train_start is null or setting.train_end is null then raise exception 'FORECAST_SETTING_INCOMPLETE'; end if;
 insert into core.forecast_run(status,granularity,train_start,train_end,horizon,data_snapshot_at,triggered_by,triggered_email,note,models,n_models)
 select 'RUNNING',setting.granularity,setting.train_start,setting.train_end,setting.forecast_horizon,coalesce((select max(loaded_at) from core.v_train_demand),now()),auth.uid(),u.email,run_note,jsonb_agg(jsonb_build_object('model_id',m.model_id,'version',m.version,'parameters',m.parameters)),count(*)
 from core.model_config m left join core.app_user u on u.user_id=auth.uid() where m.enabled group by u.email returning * into r;
 insert into core.model_version(run_id,model_id,version,definition) select r.run_id,model_id,version,jsonb_build_object('family',family,'engine',engine,'parameters',parameters,'applicable_demand_type',applicable_demand_type) from core.model_config where enabled;
 insert into core.forecast_result(run_id,model_id,item_id,period,model_version,predicted_qty,p50,p80,p90,sigma,basis)
 with monthly as (select item_id,date_trunc('month',period_start)::date period,sum(qty) qty from core.v_train_demand group by 1,2),
 items as (select distinct item_id from monthly), future as (select i.item_id,(date_trunc('month',setting.train_end)::date + (n || ' month')::interval)::date period from items i cross join generate_series(1,setting.forecast_horizon) n),
 prof as (select item_id,demand_type from analytics.v_sku_demand_profile),
 candidates as (select m.* from core.model_config m where m.enabled),
 calc as (select f.item_id,f.period,c.model_id,c.version,c.parameters,
  case c.model_id
   when 'MA_3M' then (select avg(qty) from (select qty from monthly x where x.item_id=f.item_id order by period desc limit coalesce((c.parameters->>'window')::int,3)) q having count(*)=coalesce((c.parameters->>'window')::int,3))
   when 'MA_6M' then (select avg(qty) from (select qty from monthly x where x.item_id=f.item_id order by period desc limit coalesce((c.parameters->>'window')::int,6)) q having count(*)=coalesce((c.parameters->>'window')::int,6))
   when 'WMA_3M' then (select sum(qty * ((c.parameters->'weights')->>((rank - 1)::int))::numeric) / sum(((c.parameters->'weights')->>((rank - 1)::int))::numeric) from (select qty,row_number() over(order by period desc) rank from monthly x where x.item_id=f.item_id order by period desc limit jsonb_array_length(c.parameters->'weights')) q having count(*)=jsonb_array_length(c.parameters->'weights'))
   when 'PY_SAME_MONTH' then (select qty from monthly x where x.item_id=f.item_id and x.period=(f.period - ((c.parameters->>'lag_months')::int || ' month')::interval)::date)
   when 'SEASONAL_NAIVE' then (select qty from monthly x where x.item_id=f.item_id and x.period=(f.period - ((c.parameters->>'lag_months')::int || ' month')::interval)::date)
  end predicted_qty
 from future f join prof p using(item_id) cross join candidates c where p.demand_type=any(c.applicable_demand_type)),
 sigma as (select item_id,stddev_samp(qty) sigma from monthly group by item_id having count(*)>=2)
 select r.run_id,c.model_id,c.item_id,c.period,c.version,c.predicted_qty,c.predicted_qty,
  case when s.sigma is null or c.predicted_qty is null then null else c.predicted_qty+1.28155*s.sigma end,
  case when s.sigma is null or c.predicted_qty is null then null else c.predicted_qty+1.64485*s.sigma end,s.sigma,jsonb_build_object('training_only',true,'parameters',c.parameters)
 from calc c left join sigma s using(item_id) where c.predicted_qty is not null;
 update core.forecast_run set status='SUCCESS',finished_at=clock_timestamp(),duration_ms=extract(epoch from clock_timestamp()-started)*1000,n_items=(select count(distinct item_id) from core.forecast_result where run_id=r.run_id),n_rows=(select count(*) from core.forecast_result where run_id=r.run_id) where run_id=r.run_id;
 return r.run_id;
exception when others then
 if r.run_id is not null then update core.forecast_run set status='FAILED',finished_at=clock_timestamp(),duration_ms=extract(epoch from clock_timestamp()-started)*1000,message=sqlerrm where run_id=r.run_id; end if; raise;
end $$;

create or replace view analytics.v_model_config with (security_invoker=true) as select model_id,model_name,family,engine,version,enabled,is_default,applicable_demand_type,parameters,description,updated_at from core.model_config;
create or replace view analytics.v_forecast_run with (security_invoker=true) as select r.*,exists(select 1 from core.forecast_stale_event e where e.detected_at>r.data_snapshot_at and e.resolved_at is null) as is_stale from core.forecast_run r;
create or replace view analytics.v_forecast_result with (security_invoker=true) as select * from core.forecast_result;
create or replace view analytics.v_forecast_run_kpi with (security_invoker=true) as select count(*) filter(where status='SUCCESS') n_success,count(*) filter(where status='FAILED') n_failed,count(*) filter(where is_stale) n_stale,max(finished_at) last_finished_at from analytics.v_forecast_run;
revoke all on core.model_config,core.model_version,core.forecast_run,core.forecast_result from anon;
revoke all on analytics.v_model_config,analytics.v_forecast_run,analytics.v_forecast_result,analytics.v_forecast_run_kpi from anon;
grant select on analytics.v_model_config,analytics.v_forecast_run,analytics.v_forecast_result,analytics.v_forecast_run_kpi to authenticated;
grant execute on function core.run_baseline_forecast(text) to authenticated;

do $$ declare t text; begin
 foreach t in array array['model_config','model_version','forecast_run','forecast_result'] loop
  execute format('alter table core.%I enable row level security',t);
  execute format('grant select,insert,update,delete on core.%I to authenticated',t);
  execute format('drop policy if exists forecast_active_select on core.%I',t);
  execute format('drop policy if exists forecast_admin_all on core.%I',t);
  execute format('create policy forecast_active_select on core.%I for select to authenticated using (exists(select 1 from core.app_user u where u.user_id=(select auth.uid()) and u.active))',t);
  execute format('create policy forecast_admin_all on core.%I for all to authenticated using ((select core.is_admin())) with check ((select core.is_admin()))',t);
 end loop;
end $$;
