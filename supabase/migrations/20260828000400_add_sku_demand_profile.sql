-- STEP 5: training-only SKU demand profile for forecast model selection.
-- Demand calculations read core.v_train_demand only; test actuals are never referenced.

create or replace view analytics.v_sku_demand_profile
with (security_invoker = true, security_barrier = true)
as
with active_setting as (
  select train_start, train_end
  from core.forecast_setting
  where active = true
  limit 1
),
target_items as (
  select item_id from core.item_policy
  union
  select distinct item_id from core.v_train_demand
  union
  select to_jsonb(m) ->> (chr(54408) || chr(47785) || chr(53076) || chr(46300))
  from raw.item_master m
),
periods as (
  select generate_series(
    date_trunc('month', train_start)::date,
    date_trunc('month', train_end)::date,
    interval '1 month'
  )::date as period_start
  from active_setting
  where train_start is not null and train_end is not null
),
monthly_demand as (
  select item_id, date_trunc('month', period_start)::date as period_start, sum(qty) as quantity
  from core.v_train_demand
  group by item_id, date_trunc('month', period_start)::date
),
period_grid as (
  select
    i.item_id,
    p.period_start,
    row_number() over (partition by i.item_id order by p.period_start) as period_index,
    case when d.item_id is null then 0::numeric else d.quantity end as quantity,
    case when d.item_id is null then true else false end as is_absent_period
  from target_items i
  cross join periods p
  left join monthly_demand d on d.item_id = i.item_id and d.period_start = p.period_start
),
profile_stats as (
  select
    item_id,
    count(*)::integer as n_periods,
    count(*) filter (where quantity > 0)::integer as n_nonzero_periods,
    count(*) filter (where quantity = 0)::numeric / nullif(count(*), 0) as zero_demand_rate,
    avg(quantity) filter (where quantity > 0) as nonzero_mean,
    stddev_samp(quantity) filter (where quantity > 0) as nonzero_stddev,
    regr_slope(quantity, period_index) filter (where quantity is not null) as trend,
    max(quantity) as peak_quantity
  from period_grid
  group by item_id
),
recent_periods as (
  select
    item_id,
    sum(quantity) filter (where period_index > n_periods - 3) as recent_three_total,
    sum(quantity) filter (where period_index between n_periods - 5 and n_periods - 3) as previous_three_total
  from (
    select g.*, s.n_periods
    from period_grid g
    join profile_stats s using (item_id)
  ) recent_source
  group by item_id
),
peak_periods as (
  select distinct on (item_id) item_id, period_start as peak_period
  from period_grid
  order by item_id, quantity desc, period_start asc
),
month_of_year as (
  select item_id, extract(month from period_start)::integer as month_number, avg(quantity) as avg_quantity, count(*) as observations
  from period_grid
  group by item_id, extract(month from period_start)
),
seasonality_stats as (
  select item_id, count(*)::integer as month_groups, min(observations)::integer as min_observations, avg(avg_quantity) as seasonal_mean, stddev_samp(avg_quantity) as seasonal_stddev
  from month_of_year
  group by item_id
),
base as (
  select
    s.item_id,
    coalesce(to_jsonb(m) ->> (chr(54408) || chr(47785) || chr(47749)), s.item_id) as item_name,
    s.n_periods,
    s.n_nonzero_periods,
    case when s.n_nonzero_periods > 0 then s.n_periods::numeric / s.n_nonzero_periods else null end as adi,
    case when s.n_nonzero_periods >= 2 and s.nonzero_mean <> 0 then s.nonzero_stddev / s.nonzero_mean else null end as cv,
    s.zero_demand_rate,
    case when s.n_periods >= 2 then s.trend else null end as trend,
    case when s.n_periods >= 6 and r.previous_three_total <> 0 then (r.recent_three_total - r.previous_three_total) / r.previous_three_total else null end as recent_change_rate,
    p.peak_period,
    case
      when s.n_periods < 24 then null
      when coalesce(ss.month_groups, 0) < 12 or coalesce(ss.min_observations, 0) < 2 or ss.seasonal_mean = 0 then null
      when ss.seasonal_stddev / ss.seasonal_mean >= 0.10 then true
      else false
    end as seasonality,
    case
      when s.n_periods < 24 then 'INSUFFICIENT_PERIODS'
      when s.n_nonzero_periods = 0 then 'NO_NONZERO_DEMAND'
      when s.n_nonzero_periods < 2 then 'INSUFFICIENT_NONZERO_PERIODS'
      when r.previous_three_total = 0 then 'ZERO_BASELINE'
      else null
    end as reason_code
  from profile_stats s
  join recent_periods r using (item_id)
  join peak_periods p using (item_id)
  left join seasonality_stats ss using (item_id)
  left join raw.item_master m on (to_jsonb(m) ->> (chr(54408) || chr(47785) || chr(53076) || chr(46300))) = s.item_id
)
select
  item_id,
  item_name,
  n_periods,
  n_nonzero_periods,
  round(adi, 4) as adi,
  round(cv, 4) as cv,
  round(cv * cv, 4) as cv_squared,
  round(zero_demand_rate, 4) as zero_demand_rate,
  round(trend::numeric, 4) as trend,
  round(recent_change_rate, 4) as recent_change_rate,
  peak_period,
  case
    when adi is null or cv is null then null
    when adi < 1.32 and (cv * cv) < 0.49 then 'SMOOTH'
    when adi >= 1.32 and (cv * cv) < 0.49 then 'INTERMITTENT'
    when adi < 1.32 and (cv * cv) >= 0.49 then 'ERRATIC'
    when adi >= 1.32 and (cv * cv) >= 0.49 then 'LUMPY'
  end as demand_type,
  seasonality,
  reason_code,
  case
    when adi is null or cv is null then 'CALCULATION_UNAVAILABLE'
    when (cv * cv) < 0.49 then 'STABLE'
    else 'VARIABLE'
  end as stability
from base;

create or replace view analytics.v_demand_profile_kpi
with (security_invoker = true)
as
select
  count(*)::integer as total_items,
  count(*) filter (where demand_type = 'SMOOTH')::integer as n_smooth,
  count(*) filter (where demand_type = 'INTERMITTENT')::integer as n_intermittent,
  count(*) filter (where demand_type = 'ERRATIC')::integer as n_erratic,
  count(*) filter (where demand_type = 'LUMPY')::integer as n_lumpy,
  count(*) filter (where demand_type in ('INTERMITTENT', 'LUMPY'))::integer as n_croston_needed,
  count(*) filter (where demand_type is null)::integer as n_calculation_unavailable
from analytics.v_sku_demand_profile;

revoke all on analytics.v_sku_demand_profile, analytics.v_demand_profile_kpi from anon;
grant select on analytics.v_sku_demand_profile, analytics.v_demand_profile_kpi to authenticated;

comment on view analytics.v_sku_demand_profile is 'Monthly training-only SKU demand profile. Peak-period ties choose the earliest period.';
comment on view analytics.v_demand_profile_kpi is 'Demand type counts for forecast model candidate selection.';
