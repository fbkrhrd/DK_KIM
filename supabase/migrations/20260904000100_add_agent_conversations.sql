create table if not exists core.agent_conversation (
  conversation_id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), user_email text not null,
  title text not null, started_at timestamptz not null default now(), last_at timestamptz not null default now()
);
create table if not exists core.agent_message (
  message_id uuid primary key default gen_random_uuid(), conversation_id uuid not null references core.agent_conversation(conversation_id) on delete cascade,
  role text not null check (role in ('USER','ASSISTANT')), content text not null, answer jsonb, tool_trace jsonb, usage jsonb, guardrail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists agent_conversation_user_last_idx on core.agent_conversation(user_id,last_at desc);
create index if not exists agent_message_conversation_created_idx on core.agent_message(conversation_id,created_at);
alter table core.agent_conversation enable row level security;
alter table core.agent_message enable row level security;
revoke all on core.agent_conversation,core.agent_message from anon;
grant select,insert on core.agent_conversation,core.agent_message to authenticated;
create policy agent_conversation_select on core.agent_conversation for select to authenticated using ((select auth.uid())=user_id or (select core.is_admin()));
create policy agent_conversation_insert on core.agent_conversation for insert to authenticated with check ((select auth.uid())=user_id);
create policy agent_message_select on core.agent_message for select to authenticated using (exists(select 1 from core.agent_conversation c where c.conversation_id=agent_message.conversation_id and (c.user_id=(select auth.uid()) or (select core.is_admin()))));
create policy agent_message_insert on core.agent_message for insert to authenticated with check (exists(select 1 from core.agent_conversation c where c.conversation_id=agent_message.conversation_id and c.user_id=(select auth.uid())));
create or replace function core.save_agent_turn(p_title text,p_question text,p_answer jsonb,p_tool_trace jsonb,p_usage jsonb default null,p_guardrail jsonb default null)
returns uuid language plpgsql security definer set search_path=core,pg_temp as $$
declare cid uuid; uid uuid:=auth.uid(); mail text;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select email into mail from core.app_user where user_id=uid and active; if mail is null then raise exception 'ACTIVE_USER_REQUIRED'; end if;
  insert into core.agent_conversation(user_id,user_email,title) values(uid,mail,coalesce(nullif(trim(p_title),''),'SCM Agent')) returning conversation_id into cid;
  insert into core.agent_message(conversation_id,role,content) values(cid,'USER',p_question);
  insert into core.agent_message(conversation_id,role,content,answer,tool_trace,usage,guardrail) values(cid,'ASSISTANT',coalesce(p_answer->>'answer',''),p_answer,p_tool_trace,p_usage,p_guardrail);
  return cid;
end $$;
revoke all on function core.save_agent_turn(text,text,jsonb,jsonb,jsonb,jsonb) from public;
grant execute on function core.save_agent_turn(text,text,jsonb,jsonb,jsonb,jsonb) to authenticated;
