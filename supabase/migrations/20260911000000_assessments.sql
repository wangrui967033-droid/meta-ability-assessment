-- Shared, project-scoped storage for assessment products.
create table if not exists public.app_projects (
  id uuid primary key default gen_random_uuid(),
  project_key text not null unique check (project_key ~ '^[a-z][a-z0-9-]{2,62}$'),
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.app_projects (project_key, display_name)
values ('meta-ability-assessment', '元能力测评')
on conflict (project_key) do nothing;

create table if not exists public.assessments (
  id uuid primary key,
  project_id uuid not null references public.app_projects(id) on delete restrict,
  submission_id uuid not null,
  submission_payload_hash text not null check (submission_payload_hash ~ '^[0-9a-fA-F]{64}$'),
  student_name text not null,
  phone_encrypted text not null,
  phone_lookup_hash text not null,
  phone_masked text not null check (phone_masked ~ '^\\d{3}\\*{4}\\d{4}$'),
  grade text not null,
  foreign_language text not null,
  selected_subjects jsonb not null,
  responses jsonb not null,
  report jsonb not null,
  bank_version text not null,
  scoring_version text not null,
  mapping_version text not null,
  report_generated_at timestamptz not null,
  report_revision integer not null default 1 check (report_revision >= 1),
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null check (status in ('submitted', 'processing', 'ready', 'failed')),
  unique (project_id, submission_id)
);

create index if not exists assessments_project_completed_at_id_idx
  on public.assessments (project_id, completed_at desc, id desc);
create index if not exists assessments_project_phone_lookup_hash_idx
  on public.assessments (project_id, phone_lookup_hash);

alter table public.app_projects enable row level security;
alter table public.assessments enable row level security;
revoke all on table public.app_projects from anon, authenticated;
revoke all on table public.assessments from anon, authenticated;

create or replace function public.create_or_find_assessment(
  p_id uuid, p_project_key text, p_submission_id uuid, p_submission_payload_hash text,
  p_student_name text, p_phone_encrypted text, p_phone_lookup_hash text, p_phone_masked text,
  p_grade text, p_foreign_language text, p_selected_subjects jsonb, p_responses jsonb,
  p_report jsonb, p_bank_version text, p_scoring_version text, p_mapping_version text,
  p_report_generated_at timestamptz, p_completed_at timestamptz, p_status text
)
returns table (id uuid, created boolean, matches_payload boolean, status text)
language plpgsql set search_path = '' as $$
declare current_project_id uuid;
begin
  select project.id into current_project_id from public.app_projects project where project.project_key = p_project_key;
  if not found then raise exception 'project not found'; end if;
  insert into public.assessments as assessment (
    id, project_id, submission_id, submission_payload_hash, student_name, phone_encrypted,
    phone_lookup_hash, phone_masked, grade, foreign_language, selected_subjects, responses,
    report, bank_version, scoring_version, mapping_version, report_generated_at, completed_at, status
  ) values (
    p_id, current_project_id, p_submission_id, p_submission_payload_hash, p_student_name,
    p_phone_encrypted, p_phone_lookup_hash, p_phone_masked, p_grade, p_foreign_language,
    p_selected_subjects, p_responses, p_report, p_bank_version, p_scoring_version,
    p_mapping_version, p_report_generated_at, p_completed_at, p_status
  ) on conflict (project_id, submission_id) do nothing
  returning assessment.id, true, true, assessment.status into id, created, matches_payload, status;
  if found then return next; return; end if;
  select assessment.id, false, assessment.submission_payload_hash = p_submission_payload_hash, assessment.status
    into id, created, matches_payload, status
    from public.assessments assessment
    where assessment.project_id = current_project_id and assessment.submission_id = p_submission_id;
  if not found then raise exception 'submission conflict could not be resolved'; end if;
  return next;
end;
$$;

create or replace function public.replace_assessment_report_snapshot(
  p_id uuid, p_project_key text, p_report jsonb, p_report_generated_at timestamptz
)
returns table (report_revision integer, report_generated_at timestamptz, updated_at timestamptz)
language plpgsql set search_path = '' as $$
declare current_project_id uuid;
begin
  select project.id into current_project_id from public.app_projects project where project.project_key = p_project_key;
  if not found then raise exception 'project not found'; end if;
  update public.assessments assessment set report = p_report, report_generated_at = p_report_generated_at,
    report_revision = assessment.report_revision + 1, updated_at = now()
    where assessment.id = p_id and assessment.project_id = current_project_id
    returning assessment.report_revision, assessment.report_generated_at, assessment.updated_at
    into report_revision, report_generated_at, updated_at;
  if found then return next; end if;
end;
$$;

revoke all on function public.create_or_find_assessment(
  uuid, text, uuid, text, text, text, text, text, text, text, jsonb, jsonb, jsonb, text, text, text, timestamptz, timestamptz, text
) from public, anon, authenticated;
revoke all on function public.replace_assessment_report_snapshot(uuid, text, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.create_or_find_assessment(
  uuid, text, uuid, text, text, text, text, text, text, text, jsonb, jsonb, jsonb, text, text, text, timestamptz, timestamptz, text
) to service_role;
grant execute on function public.replace_assessment_report_snapshot(uuid, text, jsonb, timestamptz) to service_role;
