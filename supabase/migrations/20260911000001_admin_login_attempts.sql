create table if not exists public.admin_login_attempts (
  project_id uuid not null references public.app_projects(id) on delete cascade,
  client_key_hash text not null check (client_key_hash ~ '^[A-Za-z0-9_-]{20,128}$'),
  failures integer not null check (failures >= 1 and failures <= 100),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (project_id, client_key_hash)
);

create index if not exists admin_login_attempts_expiry_idx
  on public.admin_login_attempts (expires_at);

alter table public.admin_login_attempts enable row level security;
revoke all on table public.admin_login_attempts from anon, authenticated;
