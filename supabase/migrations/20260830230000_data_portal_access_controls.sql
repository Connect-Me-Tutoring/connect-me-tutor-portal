-- Access controls the Data Portal's admin gate depends on.
--
-- The overview function decides from the caller's active profile role, which
-- only means something if (1) the source tables cannot be read around it and
-- (2) a caller cannot make themselves an Admin. Both were possible:
--
--   - "analytics read" policies gave the anon role unrestricted SELECT on
--     Profiles, Sessions, Pairings, pairing_requests, User_Availabilities,
--     pairing_logs and pairing_matches. Any holder of the public anon key
--     could read every row through PostgREST.
--   - "update if owner" on Profiles and "Enable Update" on user_settings were
--     USING (true) WITH CHECK (true): any signed-in user could set their own
--     role to Admin, or point their active profile at any profile.
--
-- What changes:
--   - The anon read policies are dropped. Tooling that read these tables with
--     the anon key must use the service-role key instead.
--   - Profiles and user_settings updates are limited to the row's owner or an
--     active Admin (admins edit other people's profiles through their own
--     session, e.g. deactivateUser).
--   - A trigger stops non-admins from creating an Admin profile or changing
--     any profile's role or status (students may still set their own status,
--     which the Settings page offers them). Service-role callers (sign-up,
--     cron) are unaffected.
--   - handle_new_user() refuses an Admin role arriving in signup metadata,
--     which anyone can set; the portal never passes a role there.
--
-- public.is_active_admin() uses the same definition as the app's
-- requireAdmin() and the overview function: the ACTIVE profile is an Admin.

begin;

create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_settings us
    join public."Profiles" p
      on p.id = us.last_active_profile_id
     and p.user_id = us.user_id
    where us.user_id = auth.uid()
      and p.role = 'Admin'
      and p.status = 'Active'
  );
$$;

revoke all on function public.is_active_admin() from public;
grant execute on function public.is_active_admin() to authenticated;

-- 1. No anonymous reads of operational tables.
drop policy if exists "analytics read" on public."Pairings";
drop policy if exists "analytics read" on public."Profiles";
drop policy if exists "analytics read" on public."Sessions";
drop policy if exists "analytics read" on public."User_Availabilities";
drop policy if exists "analytics read" on public."pairing_logs";
drop policy if exists "analytics read" on public."pairing_matches";
drop policy if exists "analytics read" on public."pairing_requests";

-- 2. Profiles: owner or admin may update.
drop policy if exists "update if owner" on public."Profiles";
drop policy if exists "Update profile if admin" on public."Profiles";
drop policy if exists "Update own profile or any profile as admin" on public."Profiles";
create policy "Update own profile or any profile as admin"
  on public."Profiles"
  for update to authenticated
  using (auth.uid() = user_id or public.is_active_admin())
  with check (auth.uid() = user_id or public.is_active_admin());

-- 3. user_settings: owner or admin may update, and the active profile must
--    belong to the settings row's user, so nobody can activate someone else's
--    profile.
drop policy if exists "Enable Update" on public.user_settings;
drop policy if exists "Update own settings or any settings as admin" on public.user_settings;
create policy "Update own settings or any settings as admin"
  on public.user_settings
  for update to authenticated
  using (auth.uid() = user_id or public.is_active_admin())
  with check (
    (auth.uid() = user_id or public.is_active_admin())
    and exists (
      select 1 from public."Profiles" p
      where p.id = last_active_profile_id and p.user_id = user_settings.user_id
    )
  );

-- 4. Role and status changes need an admin. Policies cannot compare old and new values,
--    so this is a trigger. It runs as the invoker on purpose: current_user is
--    then the role PostgREST switched to (anon, authenticated, service_role),
--    whereas a security-definer body would always see the owner and let
--    everyone through. is_active_admin() is the security-definer part.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin', 'supabase_auth_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' and new.role = 'Admin' and not public.is_active_admin() then
    raise exception 'Only an admin can create an Admin profile';
  end if;

  if tg_op = 'UPDATE' and new.role is distinct from old.role and not public.is_active_admin() then
    raise exception 'Only an admin can change a profile role';
  end if;

  -- Otherwise a deactivated admin could reactivate themselves. Students set
  -- their own status in Settings, so their rows are exempt.
  if tg_op = 'UPDATE' and new.status is distinct from old.status
     and old.role is distinct from 'Student' and not public.is_active_admin() then
    raise exception 'Only an admin can change a profile status';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_role on public."Profiles";
create trigger guard_profile_role
  before insert or update of role, status on public."Profiles"
  for each row execute function public.guard_profile_role();

-- 5. Signup metadata cannot mint an Admin profile. This is the baseline
--    definition of handle_new_user() with one check added; if the auth.users
--    trigger is not attached on the hosted project this is inert. It also
--    casts status to the profile_status enum, which the baseline version
--    did not, so signups through this trigger would fail since 8/30.
CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    -- public, not empty: the Profiles insert below fires
    -- insert_user_settings_from_profiles, which names user_settings
    -- unqualified and cannot resolve it under an empty search path.
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  -- raw_user_meta_data is set by whoever signs up; an administrative role
  -- must never come from it. The portal creates admins through the service
  -- role, not through signup metadata.
  if new.raw_user_meta_data ->> 'role' = 'Admin' then
    raise exception 'Signup metadata cannot assign the Admin role';
  end if;

  insert into public."Profiles" (
    user_id, 
    email, 
    role,
    first_name, 
    last_name, 
    age,
    grade,
    gender,
    start_date,
    availability,
    parent_name,
    parent_email,
    phone_number,
    timezone,
    subjects_of_interest,
    status,
    student_number,
    languages_spoken
  )
  values (
    new.id, 
    new.email,
    new.raw_user_meta_data ->> 'role',
    new.raw_user_meta_data ->> 'first_name', 
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'age',
    new.raw_user_meta_data ->> 'grade',
    new.raw_user_meta_data ->> 'gender',
    (new.raw_user_meta_data ->> 'start_date')::DATE,
  (SELECT array_agg(value) FROM jsonb_array_elements(new.raw_user_meta_data -> 'availability')),
    new.raw_user_meta_data ->> 'parent_name',
    new.raw_user_meta_data ->> 'parent_email',
    new.raw_user_meta_data ->> 'phone_number',
    new.raw_user_meta_data ->> 'timezone',
    (SELECT array_agg(value) FROM jsonb_array_elements(new.raw_user_meta_data -> 'subjects_of_interest')),
    -- Profiles.status is an enum and not null since 20260830164809.
    coalesce(new.raw_user_meta_data ->> 'status', 'Active')::public.profile_status,
    new.raw_user_meta_data ->> 'student_number',
      (SELECT array_agg(value) FROM jsonb_array_elements(new.raw_user_meta_data -> 'languages_spoken'))
  );
  return new;
end;
$$;

commit;
