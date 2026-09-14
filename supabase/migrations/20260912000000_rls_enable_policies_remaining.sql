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
    or student_id = any ((select private.profile_ids())::uuid[])
    or tutor_id   = any ((select private.profile_ids())::uuid[])
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
      tutor_id = any ((select private.profile_ids())::uuid[])
      and exists (
        select 1 from public.pairing_matches pm
        where pm.tutor_id = "Pairings".tutor_id
          and pm.student_id = "Pairings".student_id
          and pm.tutor_status = 'accepted'
      )
    )
  );

create policy "pairings_tutor_delete_own"
  on public."Pairings" for delete to authenticated
  using ((select private.is_admin()) or tutor_id = any ((select private.profile_ids())::uuid[]));

create policy "pairings_admin_update"
  on public."Pairings" for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "Delete Events" on public."Events";
drop policy if exists "Enable insert for authenticated users only" on public."Events";
drop policy if exists "Enable read access for all users" on public."Events";
drop policy if exists "analytics read" on public."Events";

create policy "events_own"
  on public."Events" for all to authenticated
  using ((select private.is_admin()) or tutor_id = any ((select private.profile_ids())::uuid[]))
  with check ((select private.is_admin()) or tutor_id = any ((select private.profile_ids())::uuid[]));


drop policy if exists "Enable insert for authenticated users only" on public."Meetings";
drop policy if exists "Enable read access for all users" on public."Meetings";

create policy "meetings_select_accessible"
  on public."Meetings" for select to authenticated
  using (
    (select private.is_admin())
    or (select private.is_tutor())
    or id = any ((select private.accessible_meeting_ids())::uuid[])
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

drop policy if exists "Enable delete for users based on user_id" on public.conversations;
drop policy if exists "Enable insert for authenticated users only" on public.conversations;
drop policy if exists "Enable read access for all users" on public.conversations;
drop policy if exists "Enable update access for all users" on public.conversations;

create policy "conversations_select_participant"
  on public.conversations for select to authenticated
  using ((select private.is_admin()) or id = any ((select private.conversation_ids())::uuid[]));

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
  using ((select private.is_admin()) or conversation_id = any ((select private.conversation_ids())::uuid[]));

create policy "conversation_participant_self_insert"
  on public.conversation_participant for insert to authenticated
  with check (
    (select private.is_admin())
    or (
      profile_id = any ((select private.profile_ids())::uuid[])
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

drop policy if exists "Enable delete for users based on user_id" on public.messages;
drop policy if exists "Enable insert for authenticated users only" on public.messages;
drop policy if exists "Enable read access for all users" on public.messages;
drop policy if exists "Messages Update" on public.messages;

create policy "messages_select_rooms"
  on public.messages for select to authenticated
  using (
    (select private.is_admin())
    or room_id = any ((select private.chat_room_ids())::uuid[])
  );

create policy "messages_insert_participant"
  on public.messages for insert to authenticated
  with check (
    user_id = any ((select private.profile_ids())::uuid[])
    and (
      (select private.is_admin())
      or (
        room_id <> all ((select private.announcement_room_ids()))
        and room_id = any ((select private.chat_room_ids())::uuid[])
      )
    )
  );

create policy "messages_update_own"
  on public.messages for update to authenticated
  using ((select private.is_admin()) or user_id = any ((select private.profile_ids())::uuid[]))
  with check (
    user_id = any ((select private.profile_ids())::uuid[])
    and (
      (select private.is_admin())
      or (
        room_id <> all ((select private.announcement_room_ids()))
        and room_id = any ((select private.chat_room_ids())::uuid[])
      )
    )
  );

create policy "messages_delete_own"
  on public.messages for delete to authenticated
  using ((select private.is_admin()) or user_id = any ((select private.profile_ids())::uuid[]));

drop policy if exists "select_own_chat_room_notification_preferences" on public.chat_room_notification_preferences;
drop policy if exists "insert_own_chat_room_notification_preferences" on public.chat_room_notification_preferences;
drop policy if exists "update_own_chat_room_notification_preferences" on public.chat_room_notification_preferences;
drop policy if exists "delete_own_chat_room_notification_preferences" on public.chat_room_notification_preferences;

create policy "chat_prefs_select_own"
  on public.chat_room_notification_preferences for select to authenticated
  using (profile_id = any ((select private.profile_ids())::uuid[]));

create policy "chat_prefs_insert_own"
  on public.chat_room_notification_preferences for insert to authenticated
  with check (profile_id = any ((select private.profile_ids())::uuid[]));

create policy "chat_prefs_update_own"
  on public.chat_room_notification_preferences for update to authenticated
  using (profile_id = any ((select private.profile_ids())::uuid[]))
  with check (profile_id = any ((select private.profile_ids())::uuid[]));

create policy "chat_prefs_delete_own"
  on public.chat_room_notification_preferences for delete to authenticated
  using (profile_id = any ((select private.profile_ids())::uuid[]));

create policy "chat_prefs_admin_all"
  on public.chat_room_notification_preferences for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));


drop policy if exists "Enable delete for users based on user_id" on public.pairing_requests;
drop policy if exists "Enable insert for authenticated users only" on public.pairing_requests;
drop policy if exists "Enable read access for all users" on public.pairing_requests;
drop policy if exists "Enable update" on public.pairing_requests;
drop policy if exists "analytics read" on public.pairing_requests;

create policy "pairing_requests_select_own"
  on public.pairing_requests for select to authenticated
  using ((select private.is_admin()) or user_id = any ((select private.profile_ids())::uuid[]));

create policy "pairing_requests_self_insert"
  on public.pairing_requests for insert to authenticated
  with check ((select private.is_admin()) or user_id = any ((select private.profile_ids())::uuid[]));

create policy "pairing_requests_self_update"
  on public.pairing_requests for update to authenticated
  using ((select private.is_admin()) or user_id = any ((select private.profile_ids())::uuid[]))
  with check ((select private.is_admin()) or user_id = any ((select private.profile_ids())::uuid[]));

create policy "pairing_requests_update_matched_party"
  on public.pairing_requests for update to authenticated
  using (
    exists (
      select 1 from public.pairing_matches pm
      where (pm.tutor_id = any ((select private.profile_ids())::uuid[]) and pm.student_id = pairing_requests.user_id)
         or (pm.student_id = any ((select private.profile_ids())::uuid[]) and pm.tutor_id = pairing_requests.user_id)
    )
  )
  with check (
    exists (
      select 1 from public.pairing_matches pm
      where (pm.tutor_id = any ((select private.profile_ids())::uuid[]) and pm.student_id = pairing_requests.user_id)
         or (pm.student_id = any ((select private.profile_ids())::uuid[]) and pm.tutor_id = pairing_requests.user_id)
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
    or tutor_id   = any ((select private.profile_ids())::uuid[])
    or student_id = any ((select private.profile_ids())::uuid[])
  );

create policy "pairing_matches_tutor_update"
  on public.pairing_matches for update to authenticated
  using ((select private.is_admin()) or tutor_id = any ((select private.profile_ids())::uuid[]))
  with check ((select private.is_admin()) or tutor_id = any ((select private.profile_ids())::uuid[]));

create policy "pairing_matches_admin_write"
  on public.pairing_matches for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

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


create policy "requests_admin_read"
  on public."Requests" for select to authenticated
  using ((select private.is_admin()));

create policy "forms_admin_read"
  on public."Forms" for select to authenticated
  using ((select private.is_admin()));

drop policy if exists "Enable delete for users based on user_id" on public.zoom_participant_events;
drop policy if exists "Enable insert for authenticated users only" on public.zoom_participant_events;
drop policy if exists "Enable read access for all users" on public.zoom_participant_events;
drop policy if exists "Enable update access " on public.zoom_participant_events;
drop policy if exists "analytics read" on public.zoom_participant_events;

create policy "zoom_participant_events_admin_all"
  on public.zoom_participant_events for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
