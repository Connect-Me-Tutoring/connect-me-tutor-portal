-- Tighten write permissions on Profiles, Sessions, Events, Enrollments and
-- pairing_matches.
--
-- Each function below keeps its existing checks and adds new ones. Service-role
-- writes (createAdminClient: crons, email sync, updateFutureSessions) stay
-- exempt via private.is_service_call().
--
--   1. Profiles.email      changed only by admins or the email change flow
--   2. Sessions INSERT     tutors only for students they're paired or enrolled with
--   3. Sessions.duration   set by admins
--   4. Events              written by admins; tutors can read their own
--   5. Enrollments.paused  resumed by admins; participants can still pause
--   6. pairing_matches     a decided match stays decided; only Active tutors accept

-- ===========================================================================
-- 0. Helper: is this a service-role call?
-- ===========================================================================
-- Same exemption guard_session_columns already used (no JWT claims), plus an
-- explicit service_role claim.
create or replace function private.is_service_call()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select current_setting('request.jwt.claims', true) is null
      or current_setting('request.jwt.claims', true) = ''
      or (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role';
$$;

revoke all on function private.is_service_call() from public, anon, authenticated;

-- ===========================================================================
-- 1. guard_profile_columns: email is a privileged column
-- ===========================================================================
-- Email changes go through updateAccountEmail (admin) or requestEmailChange
-- -> /auth/confirm, both of which write with the service role.
create or replace function private.guard_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  caller uuid := (select auth.uid());
begin
  if private.is_admin() then
    return new;
  end if;

  -- coalesce(..., false): user_id and role are nullable. In SQL, NOT (NULL)
  -- is NULL and IF NULL does not raise, so without this a NULL would
  -- silently ALLOW the change.
  if new.status is distinct from old.status
     and not coalesce(
       -- the only non-admin status change: a Student/Tutor pausing themselves
       caller is not null
       and old.user_id = caller
       and old.role in ('Student', 'Tutor')
       and old.status = 'Active'
       and new.status = 'Inactive',
       false
     )
  then
    raise exception 'Not allowed to modify privileged Profiles columns'
      using errcode = '42501';
  end if;

  if new.deactivated_at    is distinct from old.deactivated_at
     or new.deactivated_by is distinct from old.deactivated_by
     or new.role           is distinct from old.role
     or new.user_id        is distinct from old.user_id
     or new.settings_id    is distinct from old.settings_id
     or new.tutor_ids      is distinct from old.tutor_ids
     or new.tutoring_hours is distinct from old.tutoring_hours
     or new.start_date     is distinct from old.start_date
     or new.subject_embed  is distinct from old.subject_embed
     or new.ai_tutor_chatlogs is distinct from old.ai_tutor_chatlogs
  then
    raise exception 'Not allowed to modify privileged Profiles columns'
      using errcode = '42501';
  end if;

  if new.email is distinct from old.email and not private.is_service_call() then
    raise exception 'Use the email change flow to change Profiles.email'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

-- ===========================================================================
-- 2. Sessions INSERT: tutors only for their own students
-- ===========================================================================
-- Tutors create sessions through enrollments (the first session) once a
-- pairing exists; other standalone sessions come from the admin schedule page.
drop policy if exists "sessions_tutor_insert" on public."Sessions";
create policy "sessions_tutor_insert"
  on public."Sessions" for insert to authenticated
  with check (
    (select private.is_admin())
    or (
      tutor_id = any ((select private.profile_ids())::uuid[])
      and (
        exists (
          select 1 from public."Pairings" p
          where p.tutor_id = "Sessions".tutor_id and p.student_id = "Sessions".student_id
        )
        or exists (
          select 1 from public."Enrollments" e
          where e.tutor_id = "Sessions".tutor_id and e.student_id = "Sessions".student_id
        )
      )
    )
  );

-- ===========================================================================
-- 3. guard_session_columns: duration is set by admins
-- ===========================================================================
-- Tutor flows (rescheduleSession, the SEF and cancellation forms) don't change
-- duration; admins edit it from ScheduleManagement.
create or replace function private.guard_session_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  -- updateFutureSessions (lib/actions/enrollment/server.actions.ts)
  -- upserts student_id/tutor_id on future Sessions via createAdminClient()
  -- when an admin reassigns an Enrollment, so service-role calls are exempt
  -- (private.is_admin() reads auth.uid(), which a service-role call lacks).
  if private.is_service_call() then
    return new;
  end if;

  if private.is_admin() then
    return new;
  end if;

  if new.student_id is distinct from old.student_id
     or new.tutor_id is distinct from old.tutor_id
  then
    raise exception 'Not allowed to reassign Sessions.student_id/tutor_id'
      using errcode = '42501';
  end if;

  if new.duration is distinct from old.duration then
    raise exception 'Not allowed to change Sessions.duration'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

-- ===========================================================================
-- 4. Events: admins write, tutors read their own
-- ===========================================================================
-- The app writes Events from admin pages (HoursManagement: createEvent,
-- createEventsBatch, removeEvent).
drop policy if exists "events_own" on public."Events";
drop policy if exists "events_select_own" on public."Events";
drop policy if exists "events_admin_write" on public."Events";

create policy "events_select_own"
  on public."Events" for select to authenticated
  using (
    (select private.is_admin())
    or tutor_id = any ((select private.profile_ids())::uuid[])
  );

create policy "events_admin_write"
  on public."Events" for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- ===========================================================================
-- 5. guard_enrollment_columns: admins resume paused enrollments
-- ===========================================================================
-- Pausing stays open to participants and to the deactivation trigger (which
-- runs as the deactivating user). Resuming is an admin decision, as described
-- in 20260926000000_profile_deactivation.sql.
create or replace function private.guard_enrollment_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  -- Same service-role exemption as the other guards.
  if private.is_service_call() then
    return new;
  end if;

  if private.is_admin() then
    return new;
  end if;

  if new.student_id is distinct from old.student_id
     or new.tutor_id is distinct from old.tutor_id
  then
    raise exception 'Not allowed to reassign Enrollments.student_id/tutor_id'
      using errcode = '42501';
  end if;

  if old.paused and not new.paused then
    raise exception 'Only an admin can resume a paused enrollment'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

-- ===========================================================================
-- 6. guard_pairing_match_columns: decided matches stay decided
-- ===========================================================================
-- A tutor decides a pending match once. pending -> rejected stays allowed for
-- everyone, because the deactivation trigger withdraws a deactivated tutor's
-- pending matches that way, running as the deactivating user.
create or replace function private.guard_pairing_match_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if private.is_admin() then
    return new;
  end if;

  if new.tutor_id is distinct from old.tutor_id
     or new.student_id is distinct from old.student_id
     or new.similarity is distinct from old.similarity
  then
    raise exception 'Tutors may only change tutor_status/rejected_at'
      using errcode = '42501';
  end if;

  if new.tutor_status is distinct from old.tutor_status and not private.is_service_call() then
    if coalesce(old.tutor_status, 'pending') <> 'pending' then
      raise exception 'This match has already been decided'
        using errcode = '42501';
    end if;

    if new.tutor_status = 'accepted' and not exists (
      select 1 from public."Profiles" p
      where p.id = new.tutor_id and p.status = 'Active'
    ) then
      raise exception 'Inactive tutors cannot accept matches'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$function$;
