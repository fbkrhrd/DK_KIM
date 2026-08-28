-- STEP 2 RBAC grants. Run the auth/RBAC migration before this file.
-- The anon role must not access business schemas.
revoke all on schema core, analytics, raw from anon;
revoke all on all tables in schema core from anon;
revoke all on all tables in schema analytics from anon;
revoke all on all tables in schema raw from anon;

grant usage on schema core, analytics to authenticated;
grant select on all tables in schema core to authenticated;
grant select on all tables in schema analytics to authenticated;

alter default privileges in schema core revoke all on tables from anon;
alter default privileges in schema analytics revoke all on tables from anon;
alter default privileges in schema core grant select on tables to authenticated;
alter default privileges in schema analytics grant select on tables to authenticated;

select has_schema_privilege('anon', 'analytics', 'usage') as anon_schema_ok,
       has_table_privilege('anon', 'analytics.v_leadtime_gap', 'select') as anon_view_ok;
