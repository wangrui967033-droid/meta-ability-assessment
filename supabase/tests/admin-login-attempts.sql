-- Run after migrations in the Supabase SQL editor or with `supabase test db`.
select relrowsecurity as admin_login_attempts_rls
from pg_class
where oid = 'public.admin_login_attempts'::regclass;

select has_table_privilege('anon', 'public.admin_login_attempts', 'select') as anon_can_select,
       has_table_privilege('authenticated', 'public.admin_login_attempts', 'select') as authenticated_can_select;
