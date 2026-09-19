-- Auth email is an internal identifier. Users sign in using username/password only.
create table if not exists public.app_project_admins (
  project_id uuid not null references public.app_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[a-z0-9_-]{3,100}$'),
  auth_email text not null,
  primary key (project_id,user_id),
  unique(project_id,username)
);
alter table public.app_project_admins enable row level security;
revoke all on public.app_project_admins from public, anon, authenticated;
grant select, insert, update, delete on public.app_project_admins to service_role;
grant select, insert, update, delete on public.admin_login_attempts to service_role;
grant select, insert, update, delete on public.assessments, public.app_projects to service_role;

-- Correct the literal-backslash regex in the original migration.
alter table public.assessments drop constraint if exists assessments_phone_masked_check;
alter table public.assessments add constraint assessments_phone_masked_check check (phone_masked ~ '^[0-9]{3}[*]{4}[0-9]{4}$');

create or replace function public.assessment_rate_limit(p_project_key text,p_key text,p_max integer,p_seconds integer)
returns integer language plpgsql set search_path = '' as $$
declare pid uuid; hits integer; deadline timestamptz;
begin
  if p_max < 1 or p_max > 99 or p_seconds < 1 or p_seconds > 86400 then raise exception 'invalid limit'; end if;
  select id into strict pid from public.app_projects where project_key=p_project_key;
  insert into public.admin_login_attempts as a(project_id,client_key_hash,failures,expires_at)
  values(pid,p_key,1,clock_timestamp()+make_interval(secs=>p_seconds))
  on conflict(project_id,client_key_hash) do update
    set failures=case when a.expires_at<=clock_timestamp() then 1 else least(a.failures+1,100) end,
        expires_at=case when a.expires_at<=clock_timestamp() then clock_timestamp()+make_interval(secs=>p_seconds) else a.expires_at end,
        updated_at=clock_timestamp()
  returning failures,expires_at into hits,deadline;
  if hits>p_max then return greatest(1,ceil(extract(epoch from deadline-clock_timestamp()))::integer); end if;
  return 0;
end;
$$;
revoke all on function public.assessment_rate_limit(text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.assessment_rate_limit(text,text,integer,integer) to service_role;
