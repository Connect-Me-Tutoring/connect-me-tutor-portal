-- Migration 1 of 2 for row level security.
-- Creates the private helper schema and the column-guard triggers.
-- Applying this alone changes NO access: RLS is still off everywhere except
-- chat_room_notification_preferences. It is safe to ship ahead of 20260820120001.

-- ============================================================================
-- RLS DRAFT — Part 1: helper functions
--
-- These live in a `private` schema so they are not exposed via PostgREST.
-- All are SECURITY DEFINER + STABLE so that:
--   * they can read "Profiles" without tripping the RLS policy that is itself
--     defined in terms of them (infinite recursion),
--   * Postgres evaluates them once per statement (InitPlan) instead of once
--     per row.
-- search_path is pinned on every one of them (search_path injection).
-- ============================================================================

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

-- Every Profiles row belonging to the calling auth user.
-- NOTE: one auth user can own several profiles (see user_settings.last_active_profile_id),
-- so this is intentionally a set, not a single id.
create or replace function private.profile_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(p.id), '{}'::uuid[])
  from public."Profiles" p
  where p.user_id = (select auth.uid());
$$;

-- The profile the user is currently acting as.
create or replace function private.active_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select us.last_active_profile_id
  from public.user_settings us
  where us.user_id = (select auth.uid());
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public."Profiles" p
    where p.user_id = (select auth.uid())
      and p.role = 'Admin'
  );
$$;

create or replace function private.is_tutor()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public."Profiles" p
    where p.user_id = (select auth.uid())
      and p.role = 'Tutor'
  );
$$;

-- ---------------------------------------------------------------------------
-- Relationship graph
-- ---------------------------------------------------------------------------

-- Profiles the caller is allowed to see: their own, plus everyone they are
-- connected to through a pairing, enrollment, session, proposed match, or a
-- shared admin conversation.
create or replace function private.visible_profile_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with me as (select unnest(private.profile_ids()) as id)
  select coalesce(array_agg(distinct v.id), '{}'::uuid[])
  from (
    select id from me
    union select pr.tutor_id   from public."Pairings" pr join me on pr.student_id = me.id
    union select pr.student_id from public."Pairings" pr join me on pr.tutor_id   = me.id
    union select e.tutor_id    from public."Enrollments" e join me on e.student_id = me.id
    union select e.student_id  from public."Enrollments" e join me on e.tutor_id   = me.id
    union select s.tutor_id    from public."Sessions" s join me on s.student_id = me.id
    union select s.student_id  from public."Sessions" s join me on s.tutor_id   = me.id
    -- a tutor must be able to read the student profile attached to a match
    -- they have been offered, before they accept or reject it
    union select m.student_id  from public.pairing_matches m join me on m.tutor_id = me.id
    union select m.tutor_id    from public.pairing_matches m join me on m.student_id = me.id
    -- co-participants of admin conversations the caller belongs to
    union select cp_other.profile_id
      from public.conversation_participant cp_mine
      join me on cp_mine.profile_id = me.id
      join public.conversation_participant cp_other
        on cp_other.conversation_id = cp_mine.conversation_id
  ) v(id)
  where v.id is not null;
$$;

-- Conversations (admin chat) the caller participates in.
create or replace function private.conversation_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(distinct cp.conversation_id), '{}'::uuid[])
  from public.conversation_participant cp
  where cp.profile_id = any (private.profile_ids());
$$;

-- Pairings the caller is one half of.
create or replace function private.pairing_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(p.id), '{}'::uuid[])
  from public."Pairings" p
  where p.student_id = any (private.profile_ids())
     or p.tutor_id   = any (private.profile_ids());
$$;

-- messages.room_id is polymorphic: it is either a Pairings.id, a
-- conversations.id, or one of the two hard-coded announcement room ids
-- (constants/chat.ts). Keep these two literals in sync with that file.
create or replace function private.chat_room_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select private.pairing_ids()
       || private.conversation_ids()
       || case
            when private.is_admin() then array[
              'aeff2967-75be-4af7-b7b4-8414e659ca16'::uuid,  -- TutorAnnouncementRoomId
              '9916f82f-0bbf-4af5-ac5c-91add30d7941'::uuid   -- StudentAnnouncementsRoomId
            ]
            when private.is_tutor() then array['aeff2967-75be-4af7-b7b4-8414e659ca16'::uuid]
            else array['9916f82f-0bbf-4af5-ac5c-91add30d7941'::uuid]
          end;
$$;

-- Read access to announcements is broader than write access: everyone reads
-- their own announcement room, only admins post to it (see the messages policies).
create or replace function private.announcement_room_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select array[
    'aeff2967-75be-4af7-b7b4-8414e659ca16'::uuid,
    '9916f82f-0bbf-4af5-ac5c-91add30d7941'::uuid
  ];
$$;

-- Meetings the caller has a legitimate reason to see (the row carries a
-- join link and a password, so this is not blanket-readable).
create or replace function private.accessible_meeting_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(distinct m.id), '{}'::uuid[])
  from (
    select s.meeting_id as id
      from public."Sessions" s
     where s.tutor_id = any (private.profile_ids())
        or s.student_id = any (private.profile_ids())
    union
    select e."meetingId" as id
      from public."Enrollments" e
     where e.tutor_id = any (private.profile_ids())
        or e.student_id = any (private.profile_ids())
    union
    -- webinars / biweekly meetings are visible to every signed-in user
    select w.meeting_id as id
      from public.weekly_meeting_schedules w
  ) m
  where m.id is not null;
$$;

grant execute on all functions in schema private to authenticated;

-- Privilege escalation guard. A policy cannot restrict *which columns* a user
-- changes, and column-level GRANTs would also block admins (who edit
-- Profiles.status from the browser client, lib/actions/admin.actions.ts:206).
-- So enforce it with a trigger that knows about the caller's role.
create or replace function private.guard_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if private.is_admin() then
    return new;
  end if;

  if new.role            is distinct from old.role
     or new.status       is distinct from old.status
     or new.user_id      is distinct from old.user_id
     or new.settings_id  is distinct from old.settings_id
     or new.tutor_ids    is distinct from old.tutor_ids
     or new.tutoring_hours is distinct from old.tutoring_hours
     or new.start_date   is distinct from old.start_date
     or new.subject_embed is distinct from old.subject_embed
     or new.ai_tutor_chatlogs is distinct from old.ai_tutor_chatlogs
  then
    raise exception 'Not allowed to modify privileged Profiles columns'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_columns on public."Profiles";
create trigger guard_profile_columns
  before update on public."Profiles"
  for each row execute function private.guard_profile_columns();

-- NOTE: the trigger runs for service_role too. If a server action legitimately
-- needs to change role/status, it must go through createAdminClient() AND the
-- trigger must be taught about it -- add `if current_setting('request.jwt.claims',
-- true) is null then return new; end if;` at the top to exempt non-JWT
-- (service) callers.


create or replace function private.guard_pairing_match_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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

  return new;
end;
$$;

drop trigger if exists guard_pairing_match_columns on public.pairing_matches;
create trigger guard_pairing_match_columns
  before update on public.pairing_matches
  for each row execute function private.guard_pairing_match_columns();


