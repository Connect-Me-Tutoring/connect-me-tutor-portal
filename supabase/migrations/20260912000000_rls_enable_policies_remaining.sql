-- Migration 3 of 3 for row level security.
-- Enables RLS + installs policies on the tables deferred from
-- 20260911000001_rls_enable_policies.sql: the pairing pipeline, chat,
-- meetings, and admin/service-only tables. Split out so the
-- personal-data/identity tables (Profiles, Enrollments, Sessions, account
-- settings, Notifications, emails) could ship first -- this set has more
-- self-service write logic (pairing queue join/leave, admin-chat
-- self-creation) and deserves its own soak time.
-- REQUIRES 20260911000000_rls_helpers.sql and 20260911000001_rls_enable_policies.sql.
-- Verify on a Supabase branch / staging project before pushing to prod:
--   the browser anon-key client reads these tables directly all over the app.

-- ---------------------------------------------------------------------------
-- Blanket grant hygiene -- the tables NOT already covered by
-- 20260911000001_rls_enable_policies.sql.
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'Pairings', 'Events', 'Meetings', 'weekly_meeting_schedules',
    'conversations', 'conversation_participant', 'messages',
    'chat_room_notification_preferences', 'pairing_requests',
    'pairing_matches', 'pairing_logs', 'Requests', 'Forms',
    'zoom_participant_events', 'discord_chatbot_conversations'
  ]
  loop
    execute format('revoke all on public.%I from anon', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;


-- ===========================================================================
-- Pairings, Events
-- (the rest of the original "Scheduling" grouping -- Enrollments and
-- Sessions already shipped in 20260911000001_rls_enable_policies.sql)
-- ===========================================================================

drop policy if exists "Enable delete for users based on user_id" on public."Pairings";
drop policy if exists "Enable insert for authenticated users only" on public."Pairings";
drop policy if exists "Enable read access for all users" on public."Pairings";
drop policy if exists "analytics read" on public."Pairings";

create policy "pairings_select_own"
  on public."Pairings" for select to authenticated
  using (
    (select private.is_admin())
    or student_id = any ((select private.profile_ids()))
    or tutor_id   = any ((select private.profile_ids()))
  );

-- updatePairingMatchStatus() (lib/actions/pairing/client.actions.ts:721)
-- creates the resulting Pairings row via the RLS-bound client when a tutor
-- accepts their offered match -- not admin-only in the app. Scoped to an
-- EXISTS check against an accepted pairing_matches row for the exact same
-- tutor/student pair (rather than a bare tutor_id ownership check) so a
-- tutor can't fabricate an arbitrary Pairings row for any student outside
-- the vetted matching workflow.
create policy "pairings_tutor_insert_from_accepted_match"
  on public."Pairings" for insert to authenticated
  with check (
    (select private.is_admin())
    or (
      tutor_id = any ((select private.profile_ids()))
      and exists (
        select 1 from public.pairing_matches pm
        where pm.tutor_id = "Pairings".tutor_id
          and pm.student_id = "Pairings".student_id
          and pm.tutor_status = 'accepted'
      )
    )
  );

-- Same function's error-path rollback (client.actions.ts:785-789) deletes
-- the Pairings row it just inserted if the confirmation emails fail to
-- send. Scoped to the tutor's own pairings, matching the delete precedent
-- already set by enrollments_participant_delete.
create policy "pairings_tutor_delete_own"
  on public."Pairings" for delete to authenticated
  using ((select private.is_admin()) or tutor_id = any ((select private.profile_ids())));

create policy "pairings_admin_update"
  on public."Pairings" for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Tutor hour logs (Sub Hotline, referrals, etc.) belong to one tutor.
drop policy if exists "Delete Events" on public."Events";
drop policy if exists "Enable insert for authenticated users only" on public."Events";
drop policy if exists "Enable read access for all users" on public."Events";
drop policy if exists "analytics read" on public."Events";

create policy "events_own"
  on public."Events" for all to authenticated
  using ((select private.is_admin()) or tutor_id = any ((select private.profile_ids())))
  with check ((select private.is_admin()) or tutor_id = any ((select private.profile_ids())));


-- ===========================================================================
-- Meetings — rows carry a join link and a password
-- ===========================================================================

drop policy if exists "Enable insert for authenticated users only" on public."Meetings";
drop policy if exists "Enable read access for all users" on public."Meetings";

-- Meetings are a shared, reusable pool (Zoom rooms), not one row per
-- enrollment: getMeetings() (lib/actions/meeting/server.actions.ts:50) has
-- no admin gate and fetches the *whole* pool so a tutor can pick an unused
-- link for a brand-new enrollment -- accessible_meeting_ids() alone (only
-- meetings already tied to an existing session/enrollment) can never
-- surface a free one. Students stay scoped to meetings they're already in.
create policy "meetings_select_accessible"
  on public."Meetings" for select to authenticated
  using (
    (select private.is_admin())
    or (select private.is_tutor())
    or id = any ((select private.accessible_meeting_ids()))
  );

create policy "meetings_admin_write"
  on public."Meetings" for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "Enable delete for users" on public.weekly_meeting_schedules;
drop policy if exists "Enable insert for authenticated users only" on public.weekly_meeting_schedules;
drop policy if exists "Enable read access for all users" on public.weekly_meeting_schedules;
drop policy if exists "Policy with table joins" on public.weekly_meeting_schedules;

create policy "weekly_meeting_schedules_select_all"
  on public.weekly_meeting_schedules for select to authenticated
  using (true);

create policy "weekly_meeting_schedules_admin_write"
  on public.weekly_meeting_schedules for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));


-- ===========================================================================
-- Chat
-- ===========================================================================

drop policy if exists "Enable delete for users based on user_id" on public.conversations;
drop policy if exists "Enable insert for authenticated users only" on public.conversations;
drop policy if exists "Enable read access for all users" on public.conversations;
drop policy if exists "Enable update access for all users" on public.conversations;

create policy "conversations_select_participant"
  on public.conversations for select to authenticated
  using ((select private.is_admin()) or id = any ((select private.conversation_ids())));

-- createAdminConversation() (lib/actions/chat/server.actions.ts:16-51) is
-- gated by requireSelfOrAdmin(user_id) -- i.e. a student/tutor opening their
-- own first admin chat -- but writes with the RLS-bound client. Self-service
-- creation is scoped to admin_conversation=true rows; everything else about
-- conversations stays admin-only.
create policy "conversations_self_create_admin_chat"
  on public.conversations for insert to authenticated
  with check ((select private.is_admin()) or admin_conversation = true);

create policy "conversations_admin_update"
  on public.conversations for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "conversations_admin_delete"
  on public.conversations for delete to authenticated
  using ((select private.is_admin()));

drop policy if exists "Enable delete for users based on user_id" on public.conversation_participant;
drop policy if exists "Enable insert for authenticated users only" on public.conversation_participant;
drop policy if exists "Enable read access for all users" on public.conversation_participant;
drop policy if exists "Enable update access for all users" on public.conversation_participant;

create policy "conversation_participant_select"
  on public.conversation_participant for select to authenticated
  using ((select private.is_admin()) or conversation_id = any ((select private.conversation_ids())));

-- Same self-service case as conversations_self_create_admin_chat above:
-- createAdminConversation() adds the caller as the sole participant of the
-- room it just created. Scoped to conversations with NO existing
-- participant yet -- without the not-exists clause, any authenticated user
-- who learns an existing admin conversation's UUID (support ticket, logs,
-- a shared screen) could self-join it and read its messages via
-- conversation_ids()/chat_room_ids(), since those are derived from
-- conversation_participant membership.
create policy "conversation_participant_self_insert"
  on public.conversation_participant for insert to authenticated
  with check (
    (select private.is_admin())
    or (
      profile_id = any ((select private.profile_ids()))
      and not exists (
        select 1 from public.conversation_participant existing
        where existing.conversation_id = conversation_participant.conversation_id
      )
    )
  );

create policy "conversation_participant_admin_update"
  on public.conversation_participant for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "conversation_participant_admin_delete"
  on public.conversation_participant for delete to authenticated
  using ((select private.is_admin()));

-- Read: any room the caller belongs to. (select private.chat_room_ids())
-- already folds in the announcement room for the caller's role (admins get
-- both), so do NOT also OR in announcement_room_ids() here -- that would let
-- students read the tutor announcements room.
drop policy if exists "Enable delete for users based on user_id" on public.messages;
drop policy if exists "Enable insert for authenticated users only" on public.messages;
drop policy if exists "Enable read access for all users" on public.messages;
drop policy if exists "Messages Update" on public.messages;

create policy "messages_select_rooms"
  on public.messages for select to authenticated
  using (
    (select private.is_admin())
    or room_id = any ((select private.chat_room_ids()))
  );

-- Write: must be a real participant, must post as yourself, and only admins
-- may post into announcements. Mirrors assertCanSendChatMessage().
create policy "messages_insert_participant"
  on public.messages for insert to authenticated
  with check (
    user_id = any ((select private.profile_ids()))
    and (
      (select private.is_admin())
      or (
        room_id <> all ((select private.announcement_room_ids()))
        and room_id = any ((select private.chat_room_ids()))
      )
    )
  );

-- WITH CHECK mirrors messages_insert_participant's shape: without the
-- room_id constraint here, a user could post into a room they belong to and
-- then UPDATE ... SET room_id = <a room they don't belong to>, relocating
-- their message (e.g. into the student announcements room).
create policy "messages_update_own"
  on public.messages for update to authenticated
  using ((select private.is_admin()) or user_id = any ((select private.profile_ids())))
  with check (
    user_id = any ((select private.profile_ids()))
    and (
      (select private.is_admin())
      or (
        room_id <> all ((select private.announcement_room_ids()))
        and room_id = any ((select private.chat_room_ids()))
      )
    )
  );

create policy "messages_delete_own"
  on public.messages for delete to authenticated
  using ((select private.is_admin()) or user_id = any ((select private.profile_ids())));

-- chat_room_notification_preferences. These four self-access policies were
-- originally created by 202604120002_enable_chat_room_notification_preferences_rls.sql;
-- they are restated here (idempotently) so this file does not depend on that
-- migration still being present. Rewritten to use (select private.profile_ids())
-- so a user with more than one profile is handled the same way as everywhere else.
drop policy if exists "select_own_chat_room_notification_preferences" on public.chat_room_notification_preferences;
drop policy if exists "insert_own_chat_room_notification_preferences" on public.chat_room_notification_preferences;
drop policy if exists "update_own_chat_room_notification_preferences" on public.chat_room_notification_preferences;
drop policy if exists "delete_own_chat_room_notification_preferences" on public.chat_room_notification_preferences;

create policy "chat_prefs_select_own"
  on public.chat_room_notification_preferences for select to authenticated
  using (profile_id = any ((select private.profile_ids())));

create policy "chat_prefs_insert_own"
  on public.chat_room_notification_preferences for insert to authenticated
  with check (profile_id = any ((select private.profile_ids())));

create policy "chat_prefs_update_own"
  on public.chat_room_notification_preferences for update to authenticated
  using (profile_id = any ((select private.profile_ids())))
  with check (profile_id = any ((select private.profile_ids())));

create policy "chat_prefs_delete_own"
  on public.chat_room_notification_preferences for delete to authenticated
  using (profile_id = any ((select private.profile_ids())));

create policy "chat_prefs_admin_all"
  on public.chat_room_notification_preferences for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));


-- ===========================================================================
-- Pairing pipeline
-- ===========================================================================

-- pairing_requests.user_id is a Profiles.id (see pairing_requests_user_id_fkey),
-- not an auth user id.
drop policy if exists "Enable delete for users based on user_id" on public.pairing_requests;
drop policy if exists "Enable insert for authenticated users only" on public.pairing_requests;
drop policy if exists "Enable read access for all users" on public.pairing_requests;
drop policy if exists "Enable update" on public.pairing_requests;
drop policy if exists "analytics read" on public.pairing_requests;

create policy "pairing_requests_select_own"
  on public.pairing_requests for select to authenticated
  using ((select private.is_admin()) or user_id = any ((select private.profile_ids())));

-- createPairingRequest / removePairingRequest / updatePairingRequest /
-- setExcludeRejectedTutorsPreference (lib/actions/pairing/client.actions.ts)
-- let a student or tutor join/leave/edit their own queue entry -- this
-- isn't admin-only in the app. Delete has no non-admin call site, so it
-- stays restricted.
create policy "pairing_requests_self_insert"
  on public.pairing_requests for insert to authenticated
  with check ((select private.is_admin()) or user_id = any ((select private.profile_ids())));

create policy "pairing_requests_self_update"
  on public.pairing_requests for update to authenticated
  using ((select private.is_admin()) or user_id = any ((select private.profile_ids())))
  with check ((select private.is_admin()) or user_id = any ((select private.profile_ids())));

-- updatePairingMatchStatus()'s reject branch (client.actions.ts:816-821)
-- resets BOTH parties' pairing_requests row to "pending" in one .update()
-- .in("user_id", [student.id, tutor.id]) call. pairing_requests_self_update
-- alone only covers the caller's own row -- RLS silently excludes the other
-- party's row from the UPDATE rather than erroring, so the rejected
-- student's queue status never actually resets. Scope the cross-party case
-- to only fire when a pairing_matches row genuinely ties the caller to that
-- other party, so this can't be used to edit an unrelated user's request.
create policy "pairing_requests_update_matched_party"
  on public.pairing_requests for update to authenticated
  using (
    exists (
      select 1 from public.pairing_matches pm
      where (pm.tutor_id = any ((select private.profile_ids())) and pm.student_id = pairing_requests.user_id)
         or (pm.student_id = any ((select private.profile_ids())) and pm.tutor_id = pairing_requests.user_id)
    )
  )
  with check (
    exists (
      select 1 from public.pairing_matches pm
      where (pm.tutor_id = any ((select private.profile_ids())) and pm.student_id = pairing_requests.user_id)
         or (pm.student_id = any ((select private.profile_ids())) and pm.tutor_id = pairing_requests.user_id)
    )
  );

create policy "pairing_requests_admin_delete"
  on public.pairing_requests for delete to authenticated
  using ((select private.is_admin()));

drop policy if exists "Enable delete for users based on user_id" on public.pairing_matches;
drop policy if exists "Enable insert for authenticated users only" on public.pairing_matches;
drop policy if exists "Enable read access for all users" on public.pairing_matches;
drop policy if exists "Pairing Matches Update" on public.pairing_matches;
drop policy if exists "analytics read" on public.pairing_matches;

create policy "pairing_matches_select_own"
  on public.pairing_matches for select to authenticated
  using (
    (select private.is_admin())
    or tutor_id   = any ((select private.profile_ids()))
    or student_id = any ((select private.profile_ids()))
  );

-- A tutor accepts or rejects the match offered to them. guard_pairing_match_columns
-- (20260911000000_rls_helpers.sql) keeps them from rewriting similarity or
-- reassigning the student.
create policy "pairing_matches_tutor_update"
  on public.pairing_matches for update to authenticated
  using ((select private.is_admin()) or tutor_id = any ((select private.profile_ids())))
  with check ((select private.is_admin()) or tutor_id = any ((select private.profile_ids())));

create policy "pairing_matches_admin_write"
  on public.pairing_matches for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Operator audit trail — admins read/write it, but createPairingRequest()
-- also writes a log row as the requesting user when they join/rejoin the
-- queue (lib/actions/pairing/client.actions.ts:299,324). pairing_logs has no
-- column to scope "self" by (metadata is unstructured jsonb, not a real
-- foreign key), so insert is intentionally open to any authenticated user;
-- read/update/delete stay admin-only.
drop policy if exists "Enable delete for users based on user_id" on public.pairing_logs;
drop policy if exists "Enable insert for authenticated users only" on public.pairing_logs;
drop policy if exists "Enable read access for all users" on public.pairing_logs;
drop policy if exists "Update Pairing Logs" on public.pairing_logs;
drop policy if exists "analytics read" on public.pairing_logs;

create policy "pairing_logs_select_admin"
  on public.pairing_logs for select to authenticated
  using ((select private.is_admin()));

create policy "pairing_logs_insert_any_authenticated"
  on public.pairing_logs for insert to authenticated
  with check (true);

create policy "pairing_logs_update_admin"
  on public.pairing_logs for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "pairing_logs_delete_admin"
  on public.pairing_logs for delete to authenticated
  using ((select private.is_admin()));


-- ===========================================================================
-- Admin-only / service-only tables
-- ===========================================================================

create policy "requests_admin_read"
  on public."Requests" for select to authenticated
  using ((select private.is_admin()));

create policy "forms_admin_read"
  on public."Forms" for select to authenticated
  using ((select private.is_admin()));

-- Rows are written by the Zoom webhook via service_role. Admins need read
-- plus update: deleting a session detaches its participant events
-- (lib/actions/admin.actions.ts:459 runs on the browser client).
-- Note the trailing space in "Enable update access " below -- that's the
-- literal legacy policy name, not a typo.
drop policy if exists "Enable delete for users based on user_id" on public.zoom_participant_events;
drop policy if exists "Enable insert for authenticated users only" on public.zoom_participant_events;
drop policy if exists "Enable read access for all users" on public.zoom_participant_events;
drop policy if exists "Enable update access " on public.zoom_participant_events;
drop policy if exists "analytics read" on public.zoom_participant_events;

create policy "zoom_participant_events_admin_all"
  on public.zoom_participant_events for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- No policies at all on discord_chatbot_conversations: RLS is on, nothing is
-- granted, so it is reachable only via service_role (the Discord bot path).
