-- STEP 2 RBAC policies for existing planning tables.
-- Run supabase/migrations/20260828000100_add_auth_rbac_audit.sql first.
revoke all on core.leadtime_plan, core.usage_profile from anon;
grant select, insert, update, delete on core.leadtime_plan, core.usage_profile to authenticated;

alter table core.leadtime_plan enable row level security;
alter table core.usage_profile enable row level security;

drop policy if exists "공급처 계획 전체 허용" on core.leadtime_plan;
drop policy if exists "공급처 계획 전체 허용" on core.usage_profile;
drop policy if exists "active users can read leadtime plan" on core.leadtime_plan;
drop policy if exists "active admins can insert leadtime plan" on core.leadtime_plan;
drop policy if exists "active admins can update leadtime plan" on core.leadtime_plan;
drop policy if exists "active admins can delete leadtime plan" on core.leadtime_plan;
drop policy if exists "active users can read usage profile" on core.usage_profile;
drop policy if exists "active admins can insert usage profile" on core.usage_profile;
drop policy if exists "active admins can update usage profile" on core.usage_profile;
drop policy if exists "active admins can delete usage profile" on core.usage_profile;

create policy "active users can read leadtime plan"
  on core.leadtime_plan for select to authenticated
  using (exists (select 1 from core.app_user u where u.user_id = auth.uid() and u.active));
create policy "active admins can insert leadtime plan"
  on core.leadtime_plan for insert to authenticated
  with check (core.is_admin());
create policy "active admins can update leadtime plan"
  on core.leadtime_plan for update to authenticated
  using (core.is_admin()) with check (core.is_admin());
create policy "active admins can delete leadtime plan"
  on core.leadtime_plan for delete to authenticated
  using (core.is_admin());

create policy "active users can read usage profile"
  on core.usage_profile for select to authenticated
  using (exists (select 1 from core.app_user u where u.user_id = auth.uid() and u.active));
create policy "active admins can insert usage profile"
  on core.usage_profile for insert to authenticated
  with check (core.is_admin());
create policy "active admins can update usage profile"
  on core.usage_profile for update to authenticated
  using (core.is_admin()) with check (core.is_admin());
create policy "active admins can delete usage profile"
  on core.usage_profile for delete to authenticated
  using (core.is_admin());
