-- Row-scoped reads for the pairing tables.
--
-- The baseline gave every signed-in user "Enable read access for all users"
-- (TO authenticated USING (true)) on the operational tables. That is not
-- authorization: it means any tutor or student can read every row through
-- PostgREST, whatever the page they were given says. The previous migration
-- closed the anonymous hole; this one scopes the authenticated one.
--
-- Scoped here, from an inventory of every session-client read in the app:
--   Pairings          - the pairings you are in
--   pairing_matches   - the matches you are in
--   pairing_requests  - your own request
--   pairing_logs      - admins only; it is an audit view with no per-user
--                       notion of "mine". Students and tutors still INSERT
--                       into it when they enter the queue or answer a match,
--                       which their INSERT policy still allows.
--   User_Availabilities - admins only. Nothing in the application reads this
--                       table from any client; the availability shown in the
--                       UI comes from Profiles.availability.
--
-- Deliberately NOT scoped here: "Profiles" and "Sessions". Both carry
-- legitimate cross-user reads that a row-scoped policy would break, and the
-- fixes belong with the code that needs them rather than in this migration:
--   - every signed-in user reads all Admin profiles to label chat messages
--   - a tutor reads their paired students, and each counterpart profile
--     embedded in every session, enrollment and pairing row
--   - the reschedule dialog reads other people's sessions in a +/-12h window
--     to see whether a Zoom room is already booked, which own-rows-only would
--     silently turn into double bookings
-- docs/rls-read-inventory.md records the full list and what each one needs.

begin;

-- The caller's own profiles. A person may hold several under one login (a
-- parent with two students, a tutor who also enrolls), so "mine" is every
-- profile sharing their user id, not just the active one.
--
-- Security definer so that scoping Profiles later cannot make this recurse
-- through the policy that calls it.
create or replace function public.my_profile_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from public."Profiles" where user_id = auth.uid();
$$;

revoke all on function public.my_profile_ids() from public;
grant execute on function public.my_profile_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- Pairings
-- ---------------------------------------------------------------------------

drop policy if exists "Enable read access for all users" on public."Pairings";
drop policy if exists "Read own pairings" on public."Pairings";
create policy "Read own pairings"
  on public."Pairings"
  for select to authenticated
  using (
    student_id in (select public.my_profile_ids())
    or tutor_id in (select public.my_profile_ids())
    or public.is_active_admin()
  );

-- ---------------------------------------------------------------------------
-- pairing_matches
-- ---------------------------------------------------------------------------

drop policy if exists "Enable read access for all users" on public.pairing_matches;
drop policy if exists "Read own pairing matches" on public.pairing_matches;
create policy "Read own pairing matches"
  on public.pairing_matches
  for select to authenticated
  using (
    student_id in (select public.my_profile_ids())
    or tutor_id in (select public.my_profile_ids())
    or public.is_active_admin()
  );

-- ---------------------------------------------------------------------------
-- pairing_requests
-- ---------------------------------------------------------------------------
-- user_id here holds a profile id in some rows and an auth user id in others;
-- the pairing SQL joins on both, so both are accepted.

drop policy if exists "Enable read access for all users" on public.pairing_requests;
drop policy if exists "Read own pairing request" on public.pairing_requests;
create policy "Read own pairing request"
  on public.pairing_requests
  for select to authenticated
  using (
    user_id in (select public.my_profile_ids())
    or user_id = (select auth.uid())
    or public.is_active_admin()
  );

-- ---------------------------------------------------------------------------
-- pairing_logs: an admin audit view
-- ---------------------------------------------------------------------------

drop policy if exists "Enable read access for all users" on public.pairing_logs;
drop policy if exists "Admins read pairing logs" on public.pairing_logs;
create policy "Admins read pairing logs"
  on public.pairing_logs
  for select to authenticated
  using (public.is_active_admin());

-- ---------------------------------------------------------------------------
-- User_Availabilities: unread by the application
-- ---------------------------------------------------------------------------

drop policy if exists "Enable read access for all users" on public."User_Availabilities";
drop policy if exists "Admins read user availabilities" on public."User_Availabilities";
create policy "Admins read user availabilities"
  on public."User_Availabilities"
  for select to authenticated
  using (public.is_active_admin());

commit;
