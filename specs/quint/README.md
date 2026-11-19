# Quint specs for the Connect Me portal

Executable models of every part of the app whose state changes over time. Each module models one
area, abstracts the rest, and cites the code, trigger or RLS policy behind each action. The
schema, triggers and policies were checked against **prod** (2026-10-24), not just
`supabase/migrations/`, because prod has drifted from the migrations.

| Module | Covers |
| --- | --- |
| `connect_me.qnt` | Pairing queue → matches → pairings → enrollments → weekly sessions; profile deactivation triggers |
| `accounts.qnt` | Logins with several profiles, `provisionUser`, legacy parental-consent provisioning, profile switching and deletion, email changes |
| `authz.qnt` | Writes each role can make directly through the database API (RLS + `guard_*` triggers), compared with what the product intends |
| `sessions.qnt` | Weekly session generation, frequency, reschedule, extra sessions, enrollment edits, SEF cleanup, Zoom rooms and attendance attribution |
| `notifications.qnt` | Session reminders (claim → QStash → send route), early check-in emails |
| `chat_support.qnt` | Admin conversations, chat and announcement emails, pairing-room history, support tickets |

**Not modelled, and why:** reporting that only reads data (analytics, hours totals, pairing-length
snapshots, admin dashboard counts, logs); hours are covered as derived from Sessions and Events
in `authz.qnt`. Also left out: tables that are empty and unused in prod (`Forms`, `Requests`,
`User_Availabilities`, `discord_chatbot_conversations`), the AI chatbot (stateless), the monthly
check-in cron (a stub that emails one hardcoded address and isn't scheduled), the login quote,
and UI-only state.

## Running

```sh
specs/quint/check.sh                    # everything: typecheck, safety, known findings
SAMPLES=50000 specs/quint/check.sh      # more thorough

# one property; a violation prints a counterexample trace (--mbt labels each action)
npx @informalsystems/quint run specs/quint/sessions.qnt --invariant=noDoubleBooking --mbt
```

`check.sh` requires each module's `safety` to hold **and** each known finding to still be
violated. Once a bug is fixed, its invariant stops failing and the script prints `NOTE`; then move
that invariant into the module's `safety`. Tested with Quint 0.33.0. This is random simulation,
not proof; for a bounded proof use `quint verify` (Apalache).

## Results

### Holds

| Module | Invariant | Enforced by |
| --- | --- | --- |
| connect_me | `inactiveNotQueued` | `block_inactive_pairing_requests` + deactivation trigger |
| connect_me | `inactiveHasNoPendingMatch` | deactivation trigger (c) |
| connect_me | `terminalSessionsNeverDeleted` | `deletePairingServer` keeps Complete / Student Did Not Attend |
| connect_me | `sessionsBelongToPairs` | sessions only come from enrollments |
| accounts | `activeProfileValid`, `everyLoginHasActiveProfile` | FK on `user_settings.last_active_profile_id` (it also makes `deleteUser`'s unawaited replace fail safe, not corrupt) |
| accounts | `profilesHaveLogin`, `loginEmailsUnique` | `ON DELETE CASCADE` from `auth.users`; Supabase Auth |
| authz | `onlyAdminReactivates` | `guard_profile_columns` |
| sessions | `sessionsHaveEnrollment`, `cronAtMostWeekly` | — |
| notifications | `oneMessagePerRecipient`, `noStaleReminder`, `claimsMatchQueue` | claim-first insert + unique index; send route re-checks status and time |
| chat_support | `ticketsChangedOnlyByAdmin`, `ticketsHaveOwners` | `tickets_*` RLS |

### Likely bugs

Ordered roughly by impact.

| ID | Module: invariant | Shortest trace | Cause |
| --- | --- | --- | --- |
| A1 | accounts: `noAccountDeletedByProvisioning` | admin changes a user's email, the profile sync fails → admin creates a user with that email | `provisionUser` looks for existing accounts by `Profiles.email`. If none matches, it invites the email; the invite fails because the login exists, and the cleanup then calls `get_user_by_email` + `auth.admin.deleteUser` on **that existing login**. The cascade removes their profiles, enrollments and pairings. **85 logins in prod** have a `Profiles.email` that differs from their login email. |
| A2 | accounts: `provisionedProfileGoesToEmailOwner` | a user sets their own `Profiles.email` to address X → admin creates a student with email X | `Profiles.email` isn't a guarded column, so a user can write any address into it. `provisionUser` then attaches the new student profile to **that user's login**, and they can switch to it. |
| Z1 | authz: `tutorSeesOnlyLinkedStudents` | tutor inserts a Session naming any student id | `sessions_tutor_insert` checks only `tutor_id`. That session adds the student to `visible_profile_ids()`, exposing their profile, including parent name, email and phone. |
| Z2 | authz: `creditedHoursMatchSchedule` | tutor updates their session's `duration`, or inserts sessions with any duration | Hours count Complete sessions × `duration`. `sessions_tutor_update` lets a tutor change every column except the participants. |
| Z3 | authz: `eventsEnteredByAdmin` | tutor inserts an Event | `events_own` is `FOR ALL` on the tutor's own rows, so tutors can give themselves volunteer hours. The app only inserts events from admin pages. |
| F1 | connect_me: `inactiveTutorCannotPair` | match proposed → tutor deactivated (match withdrawn) → tutor accepts | `updatePairingMatchStatus` doesn't check the match's current status or the tutor's profile status, and RLS allows the update. |
| F2b / Z4 | connect_me: `onlyAdminResumesInactive`, authz: `inactiveResumedOnlyByAdmin` | enrollment → student deactivated (enrollment paused) → student or tutor sets `paused = false` | `enrollments_participant_update` + `guard_enrollment_columns` protect only `student_id`/`tutor_id`. The deactivation migration says resuming is an admin decision. |
| F2 | connect_me: `inactiveEnrollmentsPaused` | F1, or F2b | Consequence: sessions keep being generated for an Inactive person. |
| N1 | notifications: `startedSessionsWereReminded` | reminder claimed for a session (within 20 min of start) → tutor reschedules it later | `rescheduleSession` doesn't clear `session_reminders`. The old message is dropped because the time changed, and the new window's claim hits the unique index ("already scheduled"), so **nobody is reminded**. Control run with `rescheduleSession` removed: holds. (`updateSession` clears reminders correctly.) |
| S4 | sessions: `noRegularSessionSkipped` | tutor adds an extra session (or reschedules one) into a future week → that week's cron runs | `addSessionsForCron` skips an enrollment if **any** session with its `enrollment_id` falls in the week, so the regular session isn't created. |
| S1–S3 | sessions: `noDoubleBooking`, `enrollmentRoomsDisjoint`, `zoomAttributionUnambiguous` | two room checks before either saves; or reschedule / extra session / enrollment edit into a busy room | The room-free check runs only in the browser, against a snapshot. Nothing on the server checks or locks the room. When two sessions share a Zoom room at once, the webhook credits all participant events to one of them and the other shows no attendance. |
| S6 | sessions: `cleanupResolvesPastSessions` | enrollment created → first session passes without an SEF → cleanup cron | `addEnrollment` creates the first session with `is_standalone = true`, and `markUnconfirmedSEFCron` skips standalone sessions, so it stays Active forever. The same applies to every extra session. |
| S7 | sessions: `editKeepsUpcomingSessionsUpcoming` | today is day 1, this week's session is later → admin moves the enrollment to day 0 | `computeSessionDateForSchedule` keeps the week and changes the weekday, so the upcoming session moves into the past (then it's flagged Unconfirmed / missed). |
| F3 | connect_me: `acceptedMatchIsPaired` | accept, confirmation email fails | The rollback deletes the enrollment and pairing but leaves `tutor_status = accepted`, and the pair can never be re-proposed. |
| F4 | connect_me: `pairingHasEnrollment` | accept with no overlapping availability | The Pairings row is inserted before the auto-enrollment throws. |
| A3 | accounts: `consentProvisionsOnce` | claim → provision creates the profile but the queue insert throws → request back to pending → claim → provision | `provisionUser` isn't idempotent, so the retry adds a **second** profile for the same student. |
| S5 | sessions: `biweeklyRespected` | biweekly enrollment, two weekly cron runs | `Enrollments.frequency` is never read; `isSessioninPastWeek` exists but is unused. One biweekly enrollment is live in prod. |
| N2 | notifications: `everyDueRecipientCheckedIn` | one check-in log insert fails | The loop throws, and recipients after it never get their check-in (it only fires on day 14). |
| C1, C2 | chat_support: `oneAdminConversationPerUser`, `conversationsHaveParticipant` | two tabs open the admin chat; or the participant insert fails | `createAdminConversation` is fetch-then-insert with no unique constraint, and it ignores the participant insert's error. |
| Z5 | authz: `priorityAdminOnly` | user updates own `pairing_requests.priority` | No column guard, and the queue is ordered by priority. |

### Questions (may be intended)

| ID | Module: invariant | Observation |
| --- | --- | --- |
| F5 | connect_me: `pairedStudentGetsNoNewOffers` | Accepting doesn't archive queue rows, so paired students keep getting new tutors offered. |
| F6 | connect_me: `atMostOnePendingOfferPerStudent` | A student can hold several offers, and each acceptance creates a pairing. |
| A4 | accounts: `adminLoginHasOnlyAdminProfile` | `provisionUser` means to stop admins having other profiles, but checks one arbitrary match, in one direction. 3 admin logins in prod own other profiles; `is_admin()` applies to the whole login. |
| A5 | accounts: `profileEmailMatchesLogin` | Data quality: the precondition for A1 and A2. |
| Z6, Z7 | authz: `orientationViaQuiz`, `pairedTutorsOriented` | `orientation_completed_at` is writable by the tutor, and nothing in pairing checks it. |
| C3 | chat_support: `inactiveNotEmailed` | Announcement emails go to every profile with the role, Inactive included. |
| C4 | chat_support: `inactiveCannotPost` | Deactivation leaves the Pairings row, so the pairing room stays writable. |
| C5 | chat_support: `historyReachable` | A pairing room is keyed by `Pairings.id`; unpair → re-pair gives an empty room, and the old messages become unreachable. |

### Found while modelling (not encoded as invariants)

- **Students can't reschedule.** `StudentDashboard` calls `rescheduleSession`, but `Sessions` has
  no update policy for students, so `.single()` throws and the student sees "Failed to reschedule
  session".
- **The reschedule Notification records the wrong old date.** `rescheduleSession` reads the row back
  after updating it, so `previous_date` equals `suggested_date`.
- **Some session deletes can fail.** `zoom_participant_events.session_id` has no `ON DELETE` action.
  Only `removeSessionServer` clears those rows first; `deletePairingServer`, `removeFutureSessions`
  and enrollment deletion don't, so they fail if Zoom has logged participants for an upcoming
  session (an early join).
- **The pairing queue:** `unique_pairing_match` means a pair can never be re-proposed, so the
  rejection cooldown and `exclude_rejected_tutors = false` have no effect. `get_top_pairing_request`
  ignores `in_queue`.
- **Prod-only schema objects** relied on by these specs, none of which are in `supabase/migrations/`:
  `UNIQUE (tutor_id, student_id)` on `Pairings`, and the triggers
  `Automatically_create_pairing_from_new_enrollment`, `insert_user_settings_from_profiles` and
  `Automatically_set_default_settings_for_new_profiles`. `handle_new_user` exists but isn't attached.
