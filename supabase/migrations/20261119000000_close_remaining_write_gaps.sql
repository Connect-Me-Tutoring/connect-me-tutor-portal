-- Close the write paths 20261025000000_security_hardening.sql left open.
--
-- Tutors and students write these tables directly through PostgREST, so the
-- server actions' checks aren't a permission boundary. Each trigger below
-- derives the value from data the caller can't fake, instead of trusting the
-- client, so the existing app flows keep working unchanged.
--
--   1. Enrollments.duration      = end_time - start_time (tutors set the schedule, not the hours)
--   2. Sessions.duration on INSERT = the enrollment's duration (Complete sessions x duration = credited hours)
--   3. pairing_requests.priority   computed by the database; user_id/type fixed
--
-- Admins (private.is_admin()) and service-role calls (crons, createAdminClient,
-- provisionUser) are exempt, as in the other guard_* functions.

-- ===========================================================================
-- 1. Enrollments.duration follows the schedule
-- ===========================================================================
-- addEnrollment / updateEnrollment already compute this with
-- handleCalculateDuration (lib/utils): end - start, +24h if it crosses midnight.
-- On prod 557 of 559 enrollments already match; the other two cross midnight
-- or are zero-length, which this formula handles the same way.
create or replace function private.enforce_enrollment_duration()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  hours real;
begin
  if private.is_service_call() or private.is_admin() then
    return new;
  end if;

  if new.start_time is null or new.end_time is null then
    raise exception 'An enrollment needs a start and end time'
      using errcode = '23514';
  end if;

  hours := extract(epoch from (new.end_time - new.start_time)) / 3600.0;
  if hours < 0 then
    hours := hours + 24;
  end if;
  new.duration := hours;

  return new;
end;
$function$;

revoke all on function private.enforce_enrollment_duration() from public, anon, authenticated;

drop trigger if exists enforce_enrollment_duration on public."Enrollments";
create trigger enforce_enrollment_duration
  before insert or update of duration, start_time, end_time on public."Enrollments"
  for each row execute function private.enforce_enrollment_duration();

-- ===========================================================================
-- 2. Sessions.duration on INSERT comes from the enrollment
-- ===========================================================================
-- guard_session_columns already blocks tutors from changing duration on
-- UPDATE. Tutor inserts (addEnrollment's first session) copy the enrollment's
-- duration; a session not tied to an enrollment is capped at the longest
-- enrollment the pair has (1 hour if none).
create or replace function private.enforce_session_insert_duration()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  enrollment_hours real;
begin
  if private.is_service_call() or private.is_admin() then
    return new;
  end if;

  if new.enrollment_id is not null then
    select e.duration into enrollment_hours
    from public."Enrollments" e
    where e.id = new.enrollment_id
      and e.tutor_id = new.tutor_id
      and e.student_id = new.student_id;

    if not found then
      raise exception 'Session enrollment does not match its tutor and student'
        using errcode = '42501';
    end if;

    new.duration := enrollment_hours;
  else
    select coalesce(max(e.duration), 1) into enrollment_hours
    from public."Enrollments" e
    where e.tutor_id = new.tutor_id
      and e.student_id = new.student_id;

    new.duration := least(coalesce(new.duration, enrollment_hours), enrollment_hours);
  end if;

  return new;
end;
$function$;

revoke all on function private.enforce_session_insert_duration() from public, anon, authenticated;

drop trigger if exists enforce_session_insert_duration on public."Sessions";
create trigger enforce_session_insert_duration
  before insert on public."Sessions"
  for each row execute function private.enforce_session_insert_duration();

-- ===========================================================================
-- 3. pairing_requests: priority is set by admins or computed
-- ===========================================================================
-- get_top_pairing_request orders the queue by priority DESC. Users write their
-- own row (pairing_requests_self_insert / _self_update), and the other party
-- of a match can update it (pairing_requests_update_matched_party).
-- createPairingRequest sets priority 1 with no enrollments, 2 otherwise; the
-- database now computes that value itself, so a client-sent number is ignored.
-- An admin's queue-page priority survives the user's other edits (notes,
-- exclude_rejected_tutors) because those don't touch priority.
create or replace function private.guard_pairing_request_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if private.is_service_call() or private.is_admin() then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id
       or new.type is distinct from old.type
    then
      raise exception 'Not allowed to change pairing_requests.user_id/type'
        using errcode = '42501';
    end if;

    if new.priority is not distinct from old.priority then
      return new;
    end if;
  end if;

  new.priority := case
    when exists (
      select 1 from public."Enrollments" e
      where e.tutor_id = new.user_id or e.student_id = new.user_id
    ) then 2
    else 1
  end;

  return new;
end;
$function$;

revoke all on function private.guard_pairing_request_columns() from public, anon, authenticated;

drop trigger if exists guard_pairing_request_columns on public.pairing_requests;
create trigger guard_pairing_request_columns
  before insert or update on public.pairing_requests
  for each row execute function private.guard_pairing_request_columns();
