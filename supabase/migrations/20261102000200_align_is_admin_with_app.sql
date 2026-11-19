-- Align private.is_admin() with the app's requireAdmin(): the caller's active
-- profile (user_settings.last_active_profile_id) must be their own Admin
-- profile with status Active. Signature, owner and grants are unchanged, so
-- existing policies pick up the new body.
--
-- user_settings_own additionally requires last_active_profile_id to reference
-- one of the row owner's own profiles, matching switchProfile().

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
