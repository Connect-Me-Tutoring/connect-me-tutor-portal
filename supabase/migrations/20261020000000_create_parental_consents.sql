-- Verifiable parental consent (COPPA) for students under 13.
--
-- Lives in its own table, not on "Profiles": the profiles_update_own RLS policy
-- lets a user edit their own profile row, so a child could otherwise set their
-- own consent flag. This table has no policies for non-admins; the app reads and
-- writes it only through the service-role client (lib/consent/*).
--
-- No auth account or "Profiles" row exists for the child until the parent
-- approves: the admin's form input waits in pending_profile and is deleted on
-- decline or expiry.
--
-- NOTE: prod Supabase has had migration drift. Verify against prod before pushing.

create table if not exists public.parental_consents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- sha256 of the emailed token; the raw token is never stored
  token_hash text not null unique,
  parent_email text not null,
  parent_name text,
  student_first_name text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'approved', 'declined', 'expired')),
  expires_at timestamptz not null,
  -- CreatedProfileData as entered by the admin; nulled once resolved
  pending_profile jsonb,
  requested_by uuid references auth.users (id) on delete set null,
  -- set on approval
  profile_id uuid references public."Profiles" (id) on delete set null,
  resolved_at timestamptz,
  consent_text_version text,
  resolved_ip text,
  resolved_user_agent text,
  -- 'processing' is the short window while an approval creates the account;
  -- once resolved, the request must not keep the child's data around
  constraint parental_consents_no_data_when_resolved
    check (status in ('pending', 'processing') or pending_profile is null)
);

create index if not exists parental_consents_parent_email_idx
  on public.parental_consents (parent_email);
create index if not exists parental_consents_status_expires_idx
  on public.parental_consents (status, expires_at);
create index if not exists parental_consents_profile_id_idx
  on public.parental_consents (profile_id);

revoke all on public.parental_consents from anon, authenticated;
alter table public.parental_consents enable row level security;

-- Admins can see the consent trail; no one but the service role can write it.
create policy "parental_consents_admin_select"
  on public.parental_consents for select to authenticated
  using ((select private.is_admin()));

grant select on public.parental_consents to authenticated;
