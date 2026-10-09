-- #807: deactivate tutors/students instead of deleting them.
--
-- Status can change through more than one code path (the admin
-- Deactivate/Reactivate buttons via setProfileStatus, and tutors/students
-- pausing themselves from Settings, which writes to Profiles directly with the
-- browser client), so everything that has to happen on a status change lives
-- here in the database rather than in any one action.

-- ===========================================================================
-- 1. When did they leave, and who did it?
-- ===========================================================================
-- deactivated_by records which of the two ways a profile went Inactive:
--   * a Student or Tutor pausing themselves from Settings (SettingsPage.tsx)
--     -> deactivated_by = their own auth uid
--   * an admin deactivating them (#807) -> deactivated_by = the admin's uid
-- Either way, only an admin can reactivate (see guard below). This column is
-- for reporting (voluntary pause vs. admin removal), not for permissions.
--
-- Profiles that are already Inactive keep both columns NULL on purpose: we
-- don't know when they left or who did it, and making up a date would corrupt
-- drop-off numbers.
alter table public."Profiles"
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivated_by uuid;

-- ===========================================================================
-- 2. Full history, not just the latest change
-- ===========================================================================
-- deactivated_at only holds the most recent deactivation. Someone who leaves,
-- comes back, and leaves again needs every transition recorded for drop-off
-- metrics to be right.
--
-- No FK to Profiles on purpose: hard deletes are logged here too (to_status =
-- 'Deleted'), and an FK would either block that insert or cascade the history
-- away with the profile.
create table if not exists public.profile_status_changes (
  id          bigint generated always as identity primary key,
  profile_id  uuid        not null,
  role        text,
  from_status text,
  to_status   text        not null,
  changed_at  timestamptz not null default now(),
  changed_by  uuid -- auth.uid() of the admin; NULL for service-role/cron writes
);

create index if not exists profile_status_changes_profile_id_idx
  on public.profile_status_changes (profile_id);
create index if not exists profile_status_changes_changed_at_idx
  on public.profile_status_changes (changed_at);

revoke all on public.profile_status_changes from anon;
alter table public.profile_status_changes enable row level security;

-- Admin read-only. There are no insert/update/delete policies: only the
-- security-definer triggers below write here, so the log can't be edited
-- from the client.
drop policy if exists "profile_status_changes_admin_read" on public.profile_status_changes;
create policy "profile_status_changes_admin_read"
  on public.profile_status_changes for select to authenticated
  using ((select private.is_admin()));

-- ===========================================================================
-- 3. Stamp deactivated_at / deactivated_by (BEFORE UPDATE)
-- ===========================================================================
-- Trigger name sorts after guard_profile_columns, so the guard sees the
-- caller's raw values before this overwrites deactivated_at.
create or replace function private.set_profile_deactivated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'Inactive' then
      new.deactivated_at := now();
      new.deactivated_by := (select auth.uid());
    else
      new.deactivated_at := null;
      new.deactivated_by := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists set_profile_deactivated_at on public."Profiles";
create trigger set_profile_deactivated_at
  before update of status on public."Profiles"
  for each row execute function private.set_profile_deactivated_at();

-- ===========================================================================
-- 4. On deactivation: log it, pause enrollments, leave the queue, and hand
--    pending matches to someone else (AFTER)
-- ===========================================================================
-- a) Queue: get_best_match picks candidates from pairing_requests where
--    in_queue is not false and never looks at Profiles.status, so without
--    this an Inactive tutor can still get matched.
-- b) Enrollments: paused = true is the same flag the admin summer-pause
--    toggle sets; session generation (add-sessions cron) skips paused
--    enrollments, so no new sessions get created for this person.
-- c) Pending matches: closed exactly like a tutor declining one
--    (updatePairingMatchStatus 'rejected'): tutor_status = 'rejected',
--    rejected_at = now(), the other person's request set back to 'pending',
--    and a pairing log. The other person is still in the queue, and this
--    person no longer is, so the next pairing run matches them with someone
--    else. Closing the match also stops an Inactive tutor (who can still
--    log in) from accepting it. Accepted matches are left alone; those are
--    real pairings, and their enrollments are paused by (b).
--
-- Reactivation deliberately undoes NONE of this: whether a returning tutor
-- or student goes back in the queue, and which enrollments resume, are
-- admin decisions (Enrollments page pause toggle / pairing queue).
create or replace function private.on_profile_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m        record;
  other_id uuid;
begin
  if new.status is distinct from old.status then
    insert into public.profile_status_changes
      (profile_id, role, from_status, to_status, changed_by)
    values
      (new.id, new.role, old.status::text, new.status::text, (select auth.uid()));

    if new.status = 'Inactive' then
      -- (a) leave the pairing queue
      update public.pairing_requests
         set in_queue = false
       where user_id = new.id
         and in_queue is distinct from false;

      -- (b) pause every enrollment they're part of
      update public."Enrollments"
         set paused = true
       where (tutor_id = new.id or student_id = new.id)
         and paused is distinct from true;

      -- (c) withdraw pending matches so the other person gets re-matched
      for m in
        update public.pairing_matches
           set tutor_status = 'rejected',
               rejected_at  = now()
         where (tutor_id = new.id or student_id = new.id)
           and coalesce(tutor_status, 'pending') = 'pending'
        returning id, tutor_id, student_id
      loop
        other_id := case when m.tutor_id = new.id then m.student_id else m.tutor_id end;

        update public.pairing_requests
           set status = 'pending'
         where user_id = other_id;

        insert into public.pairing_logs (type, role, message, error, metadata)
        values (
          'pairing-match-rejected',
          case lower(new.role) when 'tutor' then 'tutor' when 'student' then 'student' end,
          format('Match withdrawn: %s %s was deactivated',
                 coalesce(new.first_name, ''), coalesce(new.last_name, '')),
          false,
          jsonb_build_object(
            'reason', 'profile_deactivated',
            'match_id', m.id,
            'deactivated_profile_id', new.id,
            'rematch_profile_id', other_id
          )
        );
      end loop;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_status_change on public."Profiles";
create trigger on_profile_status_change
  after update of status on public."Profiles"
  for each row execute function private.on_profile_status_change();

create or replace function private.on_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profile_status_changes
    (profile_id, role, from_status, to_status, changed_by)
  values
    (old.id, old.role, old.status::text, 'Deleted', (select auth.uid()));
  return old;
end;
$$;

drop trigger if exists on_profile_delete on public."Profiles";
create trigger on_profile_delete
  after delete on public."Profiles"
  for each row execute function private.on_profile_delete();

-- ===========================================================================
-- 5. Keep Inactive profiles out of the queue for good
-- ===========================================================================
-- Section 4 archives their queue rows once, but createPairingRequest
-- (components/pairing/que/request-card.tsx on /dashboard/pairings, reachable
-- by tutors and students) flips in_queue back to true. Inactive users can
-- still log in, so without this a deactivated tutor could re-queue themselves
-- and get matched again.
create or replace function private.block_inactive_pairing_requests()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.in_queue is distinct from false
     and exists (
       select 1 from public."Profiles" p
       where p.id = new.user_id and p.status = 'Inactive'
     )
  then
    raise exception 'Inactive profiles cannot join the pairing queue'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists block_inactive_pairing_requests on public.pairing_requests;
create trigger block_inactive_pairing_requests
  before insert or update of in_queue, user_id on public.pairing_requests
  for each row execute function private.block_inactive_pairing_requests();

-- ===========================================================================
-- 6. guard_profile_columns: who may change status
-- ===========================================================================
-- The 20260911000000 version let ANY non-admin flip their own status between
-- Active and Inactive, in either direction, at any time. Policy now:
--   * Admins: pause/unpause anyone, any time.
--   * Students and Tutors: may pause THEMSELVES (Active -> Inactive) from
--     Settings, so admins don't have to process every pause.
--   * Nobody but an admin reactivates. Paused/deactivated students and
--     tutors contact ConnectMe to come back.
--   * Admins don't self-service through this path (is_admin() short-circuits
--     above), and any other/NULL role gets nothing.
--   * deactivated_at / deactivated_by are never client-writable.
-- Admin behavior and every other guarded column are unchanged from
-- 20260911000000.
--
-- Caveat (pre-existing, not introduced here): is_admin() depends on
-- auth.uid(), which is NULL for the service-role client, so service-role
-- updates to any guarded column are rejected by this trigger. Admin status
-- changes therefore go through the cookie-bound client (see setProfileStatus).
create or replace function private.guard_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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

  return new;
end;
$$;
