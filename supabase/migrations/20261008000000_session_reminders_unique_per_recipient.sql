-- One pending "Session Reminder" per (session, recipient). Previously scheduleReminder
-- addressed both the Tutor and Student reminder to the tutor, so existing sessions have
-- two rows with the same recipient; keep the oldest and drop the rest before indexing.
-- (The dropped rows' QStash messages are not cancelled here.)
DELETE FROM public.session_reminders a
USING public.session_reminders b
WHERE a.description = 'Session Reminder'
  AND b.description = 'Session Reminder'
  AND a.session_id = b.session_id
  AND a.recipient_id = b.recipient_id
  AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS session_reminders_one_per_recipient
  ON public.session_reminders (session_id, recipient_id)
  WHERE description = 'Session Reminder'
    AND session_id IS NOT NULL
    AND recipient_id IS NOT NULL;
