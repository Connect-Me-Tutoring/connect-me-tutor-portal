# Tutor onboarding recovery

Deactivate Tutor remains the standard way to remove access. Delete Tutor is for a newly registered tutor's first portal access failure after all standard account recovery methods have failed. The administrator must describe the onboarding problem and recovery attempts, acknowledge both conditions, and type the selected tutor's email.

The server and database independently require an authenticated Admin. The database rejects non-Tutors, inconsistent or shared authentication accounts/emails/settings, credited hours, completed orientation, sessions of any status, enrollments, pairings/matches, previous status changes, and other associated activity. Only untouched automatic pairing queue entries, initial availability and private default settings are cleaned up.

The history check includes UUID columns, UUID arrays, JSON and named legacy ID fields across application/storage tables, plus foreign keys from other schemas. It also checks Zoom attendance by email. Unknown associated records block recovery for manual investigation. A blocked tutor should normally be deactivated.

## Atomic deletion and audit

`prepare_tutor_onboarding_deletion` creates an admin-confirmed audit request valid for five minutes. A failed eligibility check records a blocked attempt. Supabase Auth's normal hard-delete API remains responsible for deleting the authentication account; the application never separately deletes its profile.

The auth-users deletion trigger locks the inspected application tables, rechecks admin access and all eligibility conditions, removes only recognized onboarding artifacts, and records success inside the auth transaction. An after-delete trigger verifies the profile cascade completed and removes unshared default notification settings. An error rolls back the account, profile, artifacts and success audit together. The previously committed attempt remains available for diagnosis; the server marks failed requests and reconciles lost/delayed responses against the committed audit.

These rare recovery transactions temporarily block writes to inspected tables (reads continue). A three-second lock timeout fails closed under contention. Other user types retain their normal auth deletion behavior, except accounts with a previously eligible Tutor recovery attempt remain guarded against a later role-change bypass.

Audits have no deletion-cascading foreign keys. Authenticated admins can read them; ordinary clients cannot insert, update or delete them. Each includes the actor, profile/auth IDs, original email, reason, acknowledgments, timestamps and outcome. Abandoned pending attempts expire after five minutes and are marked failed when superseded.

```sql
select id, actor_id, profile_id, email, reason, status, failure, created_at, completed_at
from public.tutor_deletion_audit
order by created_at desc;
```

After confirmed success, the tutor disappears from All Tutors and the original email is prefilled for the normal Add Tutor workflow. Add Tutor sends a fresh invite and creates a new profile. An invitation error now preserves existing authentication accounts instead of deleting an account found by email.

## Rollout and verification

Apply `20261022194521_tutor_onboarding_deletion_guard.sql` before deploying the UI/server changes. Without the migration, the server fails before starting deletion. No production account deletion or migration application is part of automated tests.

The PostgreSQL tests use PGlite with the repository's actual table/enum/foreign-key definitions and existing profile-delete audit trigger, plus representative auth/storage tables. They execute auth deletion under `supabase_auth_admin` without a caller JWT and verify rollback, rejected calls, shared accounts, legacy history, stale requests and original-email reuse. Server-action tests cover API errors and response reconciliation; provisioning tests cover reinvitation. The GoTrue HTTP service itself is mocked; the database transaction boundary is tested directly.

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run format:check`. A pre-existing `next.config.test.ts` failure on `dev` expects development `unsafe-eval`, while the returned CSP is a separate hard-coded value. This change does not modify either file.
