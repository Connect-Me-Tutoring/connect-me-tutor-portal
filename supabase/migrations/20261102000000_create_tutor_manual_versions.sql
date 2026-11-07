-- Tutor Portal Manual (/dashboard/manual), editable by admins in the portal.
--
-- Append-only: every admin save inserts a row, and the newest row is the live manual, so
-- earlier versions are kept for reference and rollback. `sections` is a JSON array of
-- { "title": text, "body": markdown }.
--
-- No policies for non-admins: the app reads and writes this table only through the
-- service-role client in lib/actions/tutor-manual/server.actions.ts, which checks the role
-- (tutors and admins can read; only admins can save).
--
-- NOTE: prod Supabase has had migration drift. Verify against prod before pushing.

create table if not exists public.tutor_manual_versions (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  sections jsonb not null
    check (jsonb_typeof(sections) = 'array' and jsonb_array_length(sections) > 0),
  created_by uuid references public."Profiles" (id) on delete set null
);

create index if not exists tutor_manual_versions_created_at_idx
  on public.tutor_manual_versions (created_at desc);

revoke all on public.tutor_manual_versions from anon, authenticated;
alter table public.tutor_manual_versions enable row level security;

-- Admins can see the edit history directly; no one but the service role can write it.
create policy "tutor_manual_versions_admin_select"
  on public.tutor_manual_versions for select to authenticated
  using ((select private.is_admin()));

grant select on public.tutor_manual_versions to authenticated;
