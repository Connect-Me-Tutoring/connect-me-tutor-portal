-- Migration 2 of 2 for row level security.
-- Enables RLS on every public table and installs the policies.
-- REQUIRES 20260820120000_rls_helpers.sql.
-- Verify on a Supabase branch / staging project before pushing to prod:
--   the browser anon-key client reads these tables directly all over the app.

-- ---------------------------------------------------------------------------
-- Blanket grant hygiene
-- ---------------------------------------------------------------------------

do $$
declare t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('revoke all on public.%I from anon', t.tablename);
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;


-- ===========================================================================
-- Profiles  — the most sensitive table (DOB, parent phone/email, student number)
-- ===========================================================================

create policy "profiles_select_related"
  on public."Profiles" for select to authenticated
  using (private.is_admin() or id = any (private.visible_profile_ids()));

create policy "profiles_update_own"
  on public."Profiles" for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "profiles_admin_all"
  on public."Profiles" for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- ===========================================================================
-- Account settings
-- ===========================================================================

create policy "user_settings_own"
  on public.user_settings for all to authenticated
  using (user_id = (select auth.uid()) or private.is_admin())
  with check (user_id = (select auth.uid()) or private.is_admin());

-- Reached through Profiles.settings_id (1:1).
create policy "user_notification_settings_own"
  on public.user_notification_settings for all to authenticated
  using (
    private.is_admin()
    or exists (
      select 1 from public."Profiles" p
      where p.settings_id = user_notification_settings.id
        and p.id = any (private.profile_ids())
    )
  )
  with check (
    private.is_admin()
    or exists (
      select 1 from public."Profiles" p
      where p.settings_id = user_notification_settings.id
        and p.id = any (private.profile_ids())
    )
  );

create policy "user_availabilities_read_related"
  on public."User_Availabilities" for select to authenticated
  using (private.is_admin() or profile_id = any (private.visible_profile_ids()));

create policy "user_availabilities_write_own"
  on public."User_Availabilities" for all to authenticated
  using (private.is_admin() or profile_id = any (private.profile_ids()))
  with check (private.is_admin() or profile_id = any (private.profile_ids()));


-- ===========================================================================
-- Scheduling: Pairings, Enrollments, Sessions
-- ===========================================================================

create policy "pairings_select_own"
  on public."Pairings" for select to authenticated
  using (
    private.is_admin()
    or student_id = any (private.profile_ids())
    or tutor_id   = any (private.profile_ids())
  );

create policy "pairings_admin_write"
  on public."Pairings" for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "enrollments_select_own"
  on public."Enrollments" for select to authenticated
  using (
    private.is_admin()
    or student_id = any (private.profile_ids())
    or tutor_id   = any (private.profile_ids())
  );

-- Creating/removing enrollments is admin-only in the app
-- (lib/actions/enrollment/server.actions.ts), so keep it admin-only here too.
create policy "enrollments_admin_write"
  on public."Enrollments" for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "sessions_select_own"
  on public."Sessions" for select to authenticated
  using (
    private.is_admin()
    or student_id = any (private.profile_ids())
    or tutor_id   = any (private.profile_ids())
  );

-- Tutors submit/complete their own sessions. Students get read-only.
create policy "sessions_tutor_insert"
  on public."Sessions" for insert to authenticated
  with check (private.is_admin() or tutor_id = any (private.profile_ids()));

create policy "sessions_tutor_update"
  on public."Sessions" for update to authenticated
  using (private.is_admin() or tutor_id = any (private.profile_ids()))
  with check (private.is_admin() or tutor_id = any (private.profile_ids()));

create policy "sessions_admin_delete"
  on public."Sessions" for delete to authenticated
  using (private.is_admin());

-- Tutor hour logs (Sub Hotline, referrals, etc.) belong to one tutor.
create policy "events_own"
  on public."Events" for all to authenticated
  using (private.is_admin() or tutor_id = any (private.profile_ids()))
  with check (private.is_admin() or tutor_id = any (private.profile_ids()));


-- ===========================================================================
-- Meetings — rows carry a join link and a password
-- ===========================================================================

create policy "meetings_select_accessible"
  on public."Meetings" for select to authenticated
  using (private.is_admin() or id = any (private.accessible_meeting_ids()));

create policy "meetings_admin_write"
  on public."Meetings" for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "weekly_meeting_schedules_select_all"
  on public.weekly_meeting_schedules for select to authenticated
  using (true);

create policy "weekly_meeting_schedules_admin_write"
  on public.weekly_meeting_schedules for all to authenticated
  using (private.is_admin()) with check (private.is_admin());


-- ===========================================================================
-- Chat
-- ===========================================================================

create policy "conversations_select_participant"
  on public.conversations for select to authenticated
  using (private.is_admin() or id = any (private.conversation_ids()));

create policy "conversations_admin_write"
  on public.conversations for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "conversation_participant_select"
  on public.conversation_participant for select to authenticated
  using (private.is_admin() or conversation_id = any (private.conversation_ids()));

create policy "conversation_participant_admin_write"
  on public.conversation_participant for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Read: any room the caller belongs to. private.chat_room_ids() already folds
-- in the announcement room for the caller's role (admins get both), so do NOT
-- also OR in announcement_room_ids() here -- that would let students read the
-- tutor announcements room.
create policy "messages_select_rooms"
  on public.messages for select to authenticated
  using (
    private.is_admin()
    or room_id = any (private.chat_room_ids())
  );

-- Write: must be a real participant, must post as yourself, and only admins
-- may post into announcements. Mirrors assertCanSendChatMessage().
create policy "messages_insert_participant"
  on public.messages for insert to authenticated
  with check (
    user_id = any (private.profile_ids())
    and (
      private.is_admin()
      or (
        room_id <> all (private.announcement_room_ids())
        and room_id = any (private.chat_room_ids())
      )
    )
  );

create policy "messages_update_own"
  on public.messages for update to authenticated
  using (private.is_admin() or user_id = any (private.profile_ids()))
  with check (private.is_admin() or user_id = any (private.profile_ids()));

create policy "messages_delete_own"
  on public.messages for delete to authenticated
  using (private.is_admin() or user_id = any (private.profile_ids()));

-- chat_room_notification_preferences. These four self-access policies were
-- originally created by 202604120002_enable_chat_room_notification_preferences_rls.sql;
-- they are restated here (idempotently) so this file does not depend on that
-- migration still being present. Rewritten to use private.profile_ids() so a
-- user with more than one profile is handled the same way as everywhere else.
drop policy if exists "select_own_chat_room_notification_preferences" on public.chat_room_notification_preferences;
drop policy if exists "insert_own_chat_room_notification_preferences" on public.chat_room_notification_preferences;
drop policy if exists "update_own_chat_room_notification_preferences" on public.chat_room_notification_preferences;
drop policy if exists "delete_own_chat_room_notification_preferences" on public.chat_room_notification_preferences;

create policy "chat_prefs_select_own"
  on public.chat_room_notification_preferences for select to authenticated
  using (profile_id = any (private.profile_ids()));

create policy "chat_prefs_insert_own"
  on public.chat_room_notification_preferences for insert to authenticated
  with check (profile_id = any (private.profile_ids()));

create policy "chat_prefs_update_own"
  on public.chat_room_notification_preferences for update to authenticated
  using (profile_id = any (private.profile_ids()))
  with check (profile_id = any (private.profile_ids()));

create policy "chat_prefs_delete_own"
  on public.chat_room_notification_preferences for delete to authenticated
  using (profile_id = any (private.profile_ids()));

create policy "chat_prefs_admin_all"
  on public.chat_room_notification_preferences for all to authenticated
  using (private.is_admin()) with check (private.is_admin());


-- ===========================================================================
-- Notifications & Emails
-- ===========================================================================

create policy "notifications_select_own"
  on public."Notifications" for select to authenticated
  using (
    private.is_admin()
    or student_id = any (private.profile_ids())
    or tutor_id   = any (private.profile_ids())
  );

-- Reschedule / cancel requests are raised by the participants themselves.
create policy "notifications_insert_own"
  on public."Notifications" for insert to authenticated
  with check (
    private.is_admin()
    or student_id = any (private.profile_ids())
    or tutor_id   = any (private.profile_ids())
  );

create policy "notifications_update_own"
  on public."Notifications" for update to authenticated
  using (
    private.is_admin()
    or student_id = any (private.profile_ids())
    or tutor_id   = any (private.profile_ids())
  )
  with check (
    private.is_admin()
    or student_id = any (private.profile_ids())
    or tutor_id   = any (private.profile_ids())
  );

create policy "notifications_admin_delete"
  on public."Notifications" for delete to authenticated
  using (private.is_admin());

-- Delivery log. Written by server/cron only; recipients may read their own.
create policy "emails_select_own"
  on public."Emails" for select to authenticated
  using (private.is_admin() or recipient_id::text = any (private.profile_ids()::text[]));


-- ===========================================================================
-- Pairing pipeline
-- ===========================================================================

-- pairing_requests.user_id is a Profiles.id (see pairing_requests_user_id_fkey),
-- not an auth user id.
create policy "pairing_requests_select_own"
  on public.pairing_requests for select to authenticated
  using (private.is_admin() or user_id = any (private.profile_ids()));

create policy "pairing_requests_admin_write"
  on public.pairing_requests for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "pairing_matches_select_own"
  on public.pairing_matches for select to authenticated
  using (
    private.is_admin()
    or tutor_id   = any (private.profile_ids())
    or student_id = any (private.profile_ids())
  );

-- A tutor accepts or rejects the match offered to them. Column-level grant
-- keeps them from rewriting similarity or reassigning the student.
create policy "pairing_matches_tutor_update"
  on public.pairing_matches for update to authenticated
  using (private.is_admin() or tutor_id = any (private.profile_ids()))
  with check (private.is_admin() or tutor_id = any (private.profile_ids()));

create policy "pairing_matches_admin_write"
  on public.pairing_matches for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Operator audit trail — admins only.
create policy "pairing_logs_admin_all"
  on public.pairing_logs for all to authenticated
  using (private.is_admin()) with check (private.is_admin());


-- ===========================================================================
-- Admin-only / service-only tables
-- ===========================================================================

create policy "requests_admin_read"
  on public."Requests" for select to authenticated
  using (private.is_admin());

create policy "forms_admin_read"
  on public."Forms" for select to authenticated
  using (private.is_admin());

-- Rows are written by the Zoom webhook via service_role. Admins need read
-- plus update: deleting a session detaches its participant events
-- (lib/actions/admin.actions.ts:459 runs on the browser client).
create policy "zoom_participant_events_admin_all"
  on public.zoom_participant_events for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- No policies at all on discord_chatbot_conversations: RLS is on, nothing is
-- granted, so it is reachable only via service_role (the Discord bot path).

