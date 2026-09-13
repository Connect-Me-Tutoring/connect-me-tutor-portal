
do $$
declare t text;
begin
  foreach t in array array[
    'Profiles', 'Enrollments', 'Sessions', 'user_settings',
    'user_notification_settings', 'User_Availabilities', 'Notifications',
    'session_reminders', 'emails'
  ]
  loop
    execute format('revoke all on public.%I from anon', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;



-- anyone. "analytics read" is the worst of these: it grants SELECT to the
-- *anon* role, i.e. unauthenticated public read access to this table.
drop policy if exists "Enable insert for authenticated users only" on public."Profiles";
drop policy if exists "Enable read access for all users" on public."Profiles";
drop policy if exists "Update profile if admin" on public."Profiles";
drop policy if exists "update if owner" on public."Profiles";
drop policy if exists "analytics read" on public."Profiles";

-- Admin profiles are visible to any authenticated user: fetchAdmins()
-- (lib/actions/chat/server.actions.ts:82) and createAdminConversation()'s
-- discovery step need to find an admin before any conversation/pairing
-- relationship exists between the caller and that admin.
create policy "profiles_select_related"
  on public."Profiles" for select to authenticated
  using (
    (select private.is_admin())
    or role = 'Admin'
    or id = any ((select private.visible_profile_ids()))
  );

create policy "profiles_update_own"
  on public."Profiles" for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "profiles_admin_all"
  on public."Profiles" for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- ===========================================================================
-- Account settings
-- ===========================================================================

drop policy if exists "Enable Update" on public.user_settings;
drop policy if exists "Enable delete for users based on user_id" on public.user_settings;
drop policy if exists "Enable insert for authenticated users only" on public.user_settings;
drop policy if exists "Enable read access for all users" on public.user_settings;

create policy "user_settings_own"
  on public.user_settings for all to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()))
  with check (user_id = (select auth.uid()) or (select private.is_admin()));

-- Reached through Profiles.settings_id (1:1).
-- "Enable insert for authenticated users only" on this table was already
-- dropped by 20260829225535_remote_schema.sql; the other two legacy grants
-- are still live.
drop policy if exists "Enable read access for all users" on public.user_notification_settings;
drop policy if exists "Enable update for users" on public.user_notification_settings;

create policy "user_notification_settings_own"
  on public.user_notification_settings for all to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1 from public."Profiles" p
      where p.settings_id = user_notification_settings.id
        and p.id = any ((select private.profile_ids()))
    )
  )
  with check (
    (select private.is_admin())
    or exists (
      select 1 from public."Profiles" p
      where p.settings_id = user_notification_settings.id
        and p.id = any ((select private.profile_ids()))
    )
  );

drop policy if exists "Enable delete for users based on user_id" on public."User_Availabilities";
drop policy if exists "Enable insert for authenticated users only" on public."User_Availabilities";
drop policy if exists "Enable read access for all users" on public."User_Availabilities";
drop policy if exists "Enable update access" on public."User_Availabilities";
drop policy if exists "analytics read" on public."User_Availabilities";

create policy "user_availabilities_read_related"
  on public."User_Availabilities" for select to authenticated
  using ((select private.is_admin()) or profile_id = any ((select private.visible_profile_ids())));

create policy "user_availabilities_write_own"
  on public."User_Availabilities" for all to authenticated
  using ((select private.is_admin()) or profile_id = any ((select private.profile_ids())))
  with check ((select private.is_admin()) or profile_id = any ((select private.profile_ids())));


-- ===========================================================================
-- Enrollments, Sessions
-- (Pairings and Events -- the rest of the original "Scheduling" grouping --
-- move to the follow-up migration with the rest of the pairing pipeline.)
-- ===========================================================================

drop policy if exists "Enable delete for users based on user_id" on public."Enrollments";
drop policy if exists "Enable insert for authenticated users only" on public."Enrollments";
drop policy if exists "Enable read access for all users" on public."Enrollments";
drop policy if exists "Enable update for users based on email" on public."Enrollments";
drop policy if exists "Update policy for enrollments" on public."Enrollments";
drop policy if exists "Users can view enrollments they're involved in" on public."Enrollments";
drop policy if exists "analytics read" on public."Enrollments";

create policy "enrollments_select_own"
  on public."Enrollments" for select to authenticated
  using (
    (select private.is_admin())
    or student_id = any ((select private.profile_ids()))
    or tutor_id   = any ((select private.profile_ids()))
  );

-- addEnrollment() gates on requireTutorProfileAccess(tutorId) then writes
-- with the RLS-bound client (lib/actions/enrollment/server.actions.ts:538,544)
-- -- tutors create their own enrollments, not just admins.
create policy "enrollments_tutor_insert"
  on public."Enrollments" for insert to authenticated
  with check ((select private.is_admin()) or tutor_id = any ((select private.profile_ids())));

-- updateEnrollment/removeEnrollment gate on requireEnrollmentAccess, which
-- explicitly allows the enrollment's own student or tutor
-- (lib/actions/auth/authz.server.ts:134), not just admins.
create policy "enrollments_participant_update"
  on public."Enrollments" for update to authenticated
  using (
    (select private.is_admin())
    or student_id = any ((select private.profile_ids()))
    or tutor_id   = any ((select private.profile_ids()))
  )
  with check (
    (select private.is_admin())
    or student_id = any ((select private.profile_ids()))
    or tutor_id   = any ((select private.profile_ids()))
  );

create policy "enrollments_participant_delete"
  on public."Enrollments" for delete to authenticated
  using (
    (select private.is_admin())
    or student_id = any ((select private.profile_ids()))
    or tutor_id   = any ((select private.profile_ids()))
  );

drop policy if exists "Enable delete for users if admin" on public."Sessions";
drop policy if exists "Enable insert for authenticated users only" on public."Sessions";
drop policy if exists "Enable read access for all users" on public."Sessions";
drop policy if exists "Enable sessions if tutor" on public."Sessions";
drop policy if exists "Update sessions if admin" on public."Sessions";
drop policy if exists "Update sessions if student" on public."Sessions";
drop policy if exists "analytics read" on public."Sessions";

create policy "sessions_select_own"
  on public."Sessions" for select to authenticated
  using (
    (select private.is_admin())
    or student_id = any ((select private.profile_ids()))
    or tutor_id   = any ((select private.profile_ids()))
  );

-- Tutors submit/complete their own sessions. Students get read-only.
create policy "sessions_tutor_insert"
  on public."Sessions" for insert to authenticated
  with check ((select private.is_admin()) or tutor_id = any ((select private.profile_ids())));

create policy "sessions_tutor_update"
  on public."Sessions" for update to authenticated
  using ((select private.is_admin()) or tutor_id = any ((select private.profile_ids())))
  with check ((select private.is_admin()) or tutor_id = any ((select private.profile_ids())));

create policy "sessions_admin_delete"
  on public."Sessions" for delete to authenticated
  using ((select private.is_admin()));


-- ===========================================================================
-- Notifications & Emails
-- ===========================================================================

drop policy if exists "Enable insert for authenticated users only" on public."Notifications";
drop policy if exists "Enable read access for all users" on public."Notifications";
drop policy if exists "Update notification if admin" on public."Notifications";
drop policy if exists "analytics read" on public."Notifications";

create policy "notifications_select_own"
  on public."Notifications" for select to authenticated
  using (
    (select private.is_admin())
    or student_id = any ((select private.profile_ids()))
    or tutor_id   = any ((select private.profile_ids()))
  );

-- Reschedule / cancel requests are raised by the participants themselves.
create policy "notifications_insert_own"
  on public."Notifications" for insert to authenticated
  with check (
    (select private.is_admin())
    or student_id = any ((select private.profile_ids()))
    or tutor_id   = any ((select private.profile_ids()))
  );

create policy "notifications_update_own"
  on public."Notifications" for update to authenticated
  using (
    (select private.is_admin())
    or student_id = any ((select private.profile_ids()))
    or tutor_id   = any ((select private.profile_ids()))
  )
  with check (
    (select private.is_admin())
    or student_id = any ((select private.profile_ids()))
    or tutor_id   = any ((select private.profile_ids()))
  );

create policy "notifications_admin_delete"
  on public."Notifications" for delete to authenticated
  using ((select private.is_admin()));

-- Delivery log. Written by server/cron only; recipients may read their own.
-- 20260903222009_update_emails_table.sql renamed the old "Emails" table to
-- session_reminders and replaced "Emails" with a security_invoker view over
-- it, so the policy has to attach to the real table -- Postgres doesn't
-- allow CREATE POLICY on a view. The RENAME carried the legacy policies
-- below over to session_reminders under their original names.
drop policy if exists "Enable insert for authenticated users only" on public.session_reminders;
drop policy if exists "Enable read access for all users" on public.session_reminders;
drop policy if exists "Policy with table joins" on public.session_reminders;

-- recipient_id is uuid in prod; (select private.profile_ids()) returns
-- uuid[], so the previous ::text cast on both sides was pure overhead (and
-- defeats any index on recipient_id).
create policy "emails_select_own"
  on public.session_reminders for select to authenticated
  using ((select private.is_admin()) or recipient_id = any ((select private.profile_ids())));

-- Admin-triggered reminder scheduling/cancellation writes this table via the
-- RLS-bound client, not createAdminClient() --
-- app/api/admin/email/before-sessions/schedule-reminder/route.ts:45 (insert)
-- and .../delete-reminder/route.ts:70 (delete, through the "Emails" view,
-- which forwards to this table). Without a write policy here, those two
-- admin-gated (verifyAdmin()) routes would get denied outright.
create policy "session_reminders_admin_write"
  on public.session_reminders for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- public.emails (added by 20260903222009_update_emails_table.sql) is an
-- unrelated generic send-log (recipient_email/subject/content), not the
-- renamed session_reminders data above. It shipped with its own USING(true)
-- policies for any authenticated user; lock it down the same way as the
-- other service-written logs.
drop policy if exists "Enable insert for authenticated users" on public.emails;
drop policy if exists "Enable read access for authenticated users" on public.emails;

create policy "emails_log_admin_all"
  on public.emails for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
