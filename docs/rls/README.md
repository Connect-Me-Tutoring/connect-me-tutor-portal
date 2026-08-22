# Row Level Security

## Current state (before these migrations)

RLS is enabled on exactly one table: `chat_room_notification_preferences`.
Every other table is wide open.

That matters more than it sounds, because this app is not
service-role-only. `lib/supabase/client.ts` exports a browser client built on
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, and ~30 modules query tables through it
directly (`lib/actions/*/client.actions.ts`, `hooks/*`, `components/admin/*`).
The anon key ships in the client bundle. With RLS off, any signed-in user — or
anyone who lifts the key out of the bundle — can `select *` from `Profiles`
(dates of birth, parent phone numbers, student numbers), `Meetings` (join links
and passwords), and `messages`.

The server-side authz helpers in `lib/actions/auth/authz.server.ts`
(`requireAdmin`, `requireTutorProfileAccess`, …) are real, but they only guard
the server-action path. They do nothing about a direct PostgREST call.

## What the two migrations do

| File | Effect |
|---|---|
| `20260820120000_rls_helpers.sql` | Creates the `private` schema, the helper functions, and two column-guard triggers. **Changes no access on its own.** Safe to ship independently. |
| `20260820120001_rls_enable_policies.sql` | Revokes `anon`, enables RLS on every public table, installs 47 policies. **This is the one that can break pages.** |

They are split so you can land the first, confirm nothing moves, then schedule
the second.

## Model

- `service_role` bypasses RLS. Everything through `createAdminClient()` is
  unaffected — including the Vercel crons, which already use the `ForCron`
  variants.
- `authenticated` is the anon-key client. The policies are the whole boundary.
- `anon` is revoked everywhere.
- Default deny: RLS on, nothing reachable unless a policy grants it.

Access shape:

| Role | Sees |
|---|---|
| Admin | everything |
| Tutor | own profile; students they're paired/enrolled/sessioned with, or matched to; own sessions, enrollments, events; their meetings; their pairing rooms + tutor announcements |
| Student | own profile; their tutors; own sessions and enrollments; their meetings; their pairing rooms + student announcements |
| Anyone | nothing without a session |

One auth user can own several profiles (`user_settings.last_active_profile_id`),
so `private.profile_ids()` returns a set, not a single id.

`messages.room_id` is polymorphic — a `Pairings.id`, a `conversations.id`, or one
of the two announcement UUIDs. `private.chat_room_ids()` mirrors
`assertCanSendChatMessage()` in `lib/actions/chat/server.actions.ts`. **The two
announcement UUIDs are duplicated from `constants/chat.ts`** — if those ever
change, this migration has to change too.

Privilege escalation is blocked by triggers, not column grants: admins edit
`Profiles.status` from the browser (`lib/actions/admin.actions.ts:206`), so a
`revoke update` would have locked them out too.

## Verified

Both migrations were applied to a scratch Postgres 18 instance built from a stub
schema generated out of `types/database.types.ts`, seeded with an admin, a
tutor, a paired student, and an unrelated student. Confirmed:

- tutor sees only self + paired student; unpaired student sees only self; admin sees all
- tutor cannot read a `Meetings` row (and its password) they have no session for
- student cannot read the *tutor* announcements room
- tutor cannot self-promote to Admin, but can edit own phone number
- admin can still set `Profiles.status`
- student cannot post to announcements, cannot impersonate another `user_id`, cannot post into a pairing room they aren't in
- the admin session-delete flow (detach `zoom_participant_events` → delete `Notifications` → delete `Sessions`) still works from the browser client
- every public table ends up RLS-enabled; only `discord_chatbot_conversations` is left policy-less (service-role only, by design)

## Before pushing migration 2

1. **Apply to a Supabase branch or staging project first, never straight to
   prod.** There is known migration drift between this repo and the prod
   Supabase project, so `supabase db push` is not a safe no-op here.
2. Walk the app as each of Admin / Tutor / Student. The failure mode is not an
   error — it is a list that silently renders empty.
3. **Check the RPCs.** Only 2 of 18 functions in `supabase/migrations/` are
   `SECURITY DEFINER`; the rest are `SECURITY INVOKER` and will start being
   RLS-filtered. The hour-aggregation ones (`get_all_hours_batch`,
   `get_total_hours`, `get_session_completion_stats`, …) are the ones to watch —
   they scan across all users, so under RLS a tutor's dashboard number may
   quietly shrink to their own rows. Decide per function whether it should
   become `SECURITY DEFINER` with its own internal check.

## Migration history was squashed

Every migration other than these two was deleted (see the commit that removed
them; `git log --diff-filter=D -- supabase/migrations` will find them again).
Two consequences:

- **The repo has no base schema.** There was never a `CREATE TABLE` migration
  for the core tables — they were created in the Supabase dashboard — so
  `supabase db reset` could not bootstrap a database before this change either.
  `supabase/migrations/` is a change log, not a source of truth. If you want one,
  `supabase db dump --schema public` against prod is the way to get it.
- **~16 RPC definitions now live only in the database**, not in the repo:
  `get_best_match`, `get_all_pairing_requests`, `lookup_proposed_matches(_static)`,
  `get_user_enrollments*`, `get_enrollment_with_profiles`,
  `get_pairing_matches_with_profiles`, `pairing_subject_priority_alignment*`,
  `get_profile_pairing_queue_state`, and others. Deleting the files did not drop
  the functions from prod, and several are still called from `lib/actions/`.
  Recovering one means `git show` on the deleted file or `pg_get_functiondef`
  against the database.

The four `chat_room_notification_preferences` self-access policies that used to
live in `202604120002` are restated inside `20260820120001` (guarded by
`drop policy if exists`), so the two remaining files no longer depend on
anything that was deleted.

## Not covered

- **Storage.** `worksheets` is a storage bucket, not a table, and
  `WorksheetsList.tsx` calls `getPublicUrl()` on it. `storage.objects` has its
  own policy set that this draft does not touch.
- **`types/database.types.ts` may be stale** — regenerate before treating the
  table list here as complete.
