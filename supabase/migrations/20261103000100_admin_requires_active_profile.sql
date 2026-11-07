-- One definition of admin, in the database and in the app.
--
-- private.is_admin() is what every row level security policy asks. Until now
-- it was true for any login that owned an Admin profile, whatever that
-- profile's status and whichever profile the login was using. The app's
-- requireAdmin() (lib/actions/auth/authz.server.ts) is stricter: the active
-- profile, user_settings.last_active_profile_id, has to be an Admin whose
-- status is Active. So a deactivated admin was refused by the app but could
-- still read and write everything the policies open to admins, through the
-- Data API with their own token.
--
-- This gives the function the app's definition. Its signature, owner and
-- grants are unchanged, so every policy and trigger that calls it picks the
-- new body up as it is, and there is still only one admin check to keep in
-- step with the app.
--
-- A service-role caller has no auth.uid() and was never an admin here; that
-- does not change, and the service role bypasses row level security anyway.
--
-- Because admin now hangs on the active profile, the active profile has to
-- be one of your own. user_settings_own lets a login update its own settings
-- row but never checked what last_active_profile_id was set to, and every
-- signed-in user can see Admin profiles (profiles_select_related), so a tutor
-- could point their own row at any Admin profile that was not already
-- someone's active profile (the column is unique) and the app's
-- requireAdmin(), which reads the active profile through that pointer, would
-- treat them as that admin. switchProfile() checks ownership in the app, but
-- the Data API does not go through it. The policy below keeps dev's rule and
-- adds that check.

begin;

drop policy if exists "user_settings_own" on public.user_settings;
create policy "user_settings_own"
  on public.user_settings for all to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()))
  with check (
    (user_id = (select auth.uid()) or (select private.is_admin()))
    and (
      last_active_profile_id is null
      or exists (
        select 1
        from public."Profiles" p
        where p.id = last_active_profile_id
          and p.user_id = user_settings.user_id
      )
    )
  );

create or replace function private.is_admin()
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
    where us.user_id = (select auth.uid())
      and p.role = 'Admin'
      and p.status = 'Active'
  );
$$;

commit;
