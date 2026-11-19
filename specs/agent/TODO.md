# TODO — tutor reliability issues (Oct 2026 feedback)

Tutor feedback this month: actions in the portal (cancel, reschedule, remove enrollment) don't
consistently persist, missed-SEF warning emails cause anxiety and can't be replied to, and Zoom
link sharing hurts lesson quality. Findings below are from code review plus read-only prod queries
on 2026-10-26.

## Done

- [x] **Failed session saves showed a success toast.** `updateSession` now throws instead of
      returning `null` (#899). Still worth checking PostHog `session_error` for how often SEF saves
      were failing.
- [x] Weekly `add-sessions` cron built the week that was ending (fires Sat ~8pm ET), creating
      already-past "phantom" sessions that turned Unconfirmed. Now builds the coming week, and
      `addSessionsForCron` never creates a past session. (9ad8921)
- [x] Biweekly frequency removed from enrollment add/edit forms (cron ignores `frequency`).

## Done (uncommitted)

- [x] **Missed-SEF warning resent every night.** Warnings now claim the enrollment by stamping
      `inactivity_warning_sent_at` (6-day cooldown), so the 3-week and 4-week warnings each go out
      once. Claim is released if the send fails. The 4-week warning runs first in
      `cleanup-schedule` so the stronger notice wins. Deletion notice is not throttled.
      Gotcha: PostgREST re-applies `.or()` to an UPDATE's returned rows, so the claim is read back
      by its exact stamp instead of `.select()` on the update.
- [x] **Tutors can't reply to warning emails.** Warning, deletion and probation emails set
      `replyTo: OPERATIONS_EMAIL`, and the templates tell tutors to reply if a technical issue
      stopped them submitting an SEF.

## Open

- [ ] **Orphaned sessions cleanup (prod).** Enrollments deleted before #897 left their sessions
      behind (`enrollment_id` null). ~1,441 future Active orphans for pairs with no enrollment still
      send reminders, hold Zoom rooms, and turn Unconfirmed. Simple delete: future, Active,
      `not is_standalone`, pair has no enrollment. Leave the ~180 still-enrolled-pair orphans until
      the cron fix is deployed. Decide whether past Unconfirmed orphans (~2,095) become `Expired`.
- [x] **Reschedule error ordering.** (uncommitted) Notification insert failure after the session
      moved is now logged, not thrown; `previous_date` comes from the pre-update row; the student
      reschedule email failure no longer shows "Failed to reschedule".
- [x] **Warning counts sessions, not weeks.** (uncommitted) Both missing-SEF queries count distinct
      Eastern weeks (`countMissedWeeks`).
- [x] **Zoom room double-booking.** (uncommitted) Cause: room availability was only checked
      client-side when the room dropdown opened, so changing day/time afterwards (or any path
      skipping the form) could double-book; nothing checked on the server.
      `lib/actions/meeting/room-conflicts.server.ts` now enforces it in `addEnrollment`,
      `updateEnrollment` (vs. other enrollments + `weekly_meeting_schedules`), `rescheduleSession`
      and `addStandaloneSession` (vs. live sessions; orphans ignored). Zoom Link HQ stays shareable.
      Not guarded: admin `updateSession` edits in ScheduleManagement.
- [ ] **Reassign the 11 enrollment pairs already double-booked in prod** (admin decision; the guard
      only stops new ones). Rooms B (Sat 13:00, Sat 14–16 vs 15–16), C (Thu 18:00), D (Wed 17:00,
      Wed 18:00 — one paused), I (Mon 19:00 — one paused), L (Mon 19:00 / 19:30, three-way),
      S (Mon 19:00, Sun 12:00), T (Wed 18:30 vs 19:00). Re-run the pair query to get ids.
- [ ] **Friendly server-action errors don't reach the UI in production.** Next redacts thrown
      Error messages from server actions, so "That Zoom link is already booked" and #890's
      duplicate-enrollment message show as the generic failure toast. Return `{ error }` instead
      of throwing if the message matters.
- [x] **Duplicate enrollments.**
      - ALREADY PRESENT (#890, 2026-10-24): duplicate check in `addEnrollment` + submit-button
        loading guard in `EnrollmentFormDialog`.
      - (uncommitted) Same check now in `updateEnrollment` via shared `assertNoDuplicateEnrollment`;
        unique-violation mapped to the friendly message.
      - (uncommitted, NOT APPLIED TO PROD) Migration `20261027000000_enrollments_unique_slot.sql`
        merges duplicate groups (keeper = most sessions, then oldest) and adds a unique index on
        (tutor_id, student_id, day, start_time). Prod preview: deletes 81 enrollments across 21
        slots, re-points 83 sessions. Tested locally in a rolled-back transaction.
- [x] **Undo in `components/tutor/components/CompletedSessionsTable.tsx`.**
      - ALREADY PRESENT (9ad8921): mobile card list mirrors the desktop Undo.
      - (uncommitted) Cancelled rows use `handleUndoCancel` (keeps cancellation reason and
        first-session flag) and the restored session moves into the current list.
      - (uncommitted) Unconfirmed rows are exempt from the 7-day undo window (late SEF).
        Caveat: the reopened session is Active and >48h old, so the nightly cleanup flips it back to
        Unconfirmed if the SEF isn't submitted before ~4am UTC.
- [ ] **Cron ignores `frequency`.** One existing biweekly enrollment still gets weekly sessions;
      convert it to weekly or honor frequency in `addSessionsForCron`.

## Not code

- Biweekly tutor meetings described as repetitive / burdensome.
- Check-in form's requirement to upload proof of an Instagram post.
