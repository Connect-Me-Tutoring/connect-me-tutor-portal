-- One enrollment per (tutor, student, day, start_time). addEnrollment checks for a
-- duplicate before inserting (#890), but check-then-insert lets concurrent or rapidly
-- repeated requests through, and prod had 21 such slots (up to 24 copies of one).
--
-- Merge each duplicate group into one keeper before indexing: the copy with the most
-- sessions (then the oldest), so the slot's history stays on a single enrollment. The
-- other copies' sessions are re-pointed to the keeper and the copies are deleted.
-- Only Sessions references Enrollments. The keeper's summary/meeting/start_date win.
--
-- Rows with a NULL in any key column are left alone: the unique index treats NULLs as
-- distinct, so they are not duplicates (e.g. legacy enrollments that keep their schedule
-- in `availability` with NULL day/start_time), but PARTITION BY would lump them together.

CREATE TEMP TABLE _enrollment_merge AS
WITH ranked AS (
  SELECT
    e.id,
    first_value(e.id) OVER slot AS keeper_id
  FROM public."Enrollments" e
  WHERE e.tutor_id IS NOT NULL
    AND e.student_id IS NOT NULL
    AND e.day IS NOT NULL
    AND e.start_time IS NOT NULL
  WINDOW slot AS (
    PARTITION BY e.tutor_id, e.student_id, e.day, e.start_time
    ORDER BY
      (SELECT count(*) FROM public."Sessions" s WHERE s.enrollment_id = e.id) DESC,
      e.created_at,
      e.id
  )
)
SELECT id AS duplicate_id, keeper_id
FROM ranked
WHERE id <> keeper_id;

UPDATE public."Sessions" s
SET enrollment_id = m.keeper_id
FROM _enrollment_merge m
WHERE s.enrollment_id = m.duplicate_id;

DELETE FROM public."Enrollments" e
USING _enrollment_merge m
WHERE e.id = m.duplicate_id;

-- Every duplicate enrollment got its own copy of each weekly session, so the keeper now
-- has several sessions at the same time. Keep one per (enrollment, date), preferring a
-- copy that has an exit form or a final status. Only untouched copies (Active or
-- Unconfirmed, no exit form, no Zoom attendance) are deleted, so no submitted data is
-- lost; a group where several copies were filled in keeps those copies.
CREATE TEMP TABLE _session_dedupe AS
WITH ranked AS (
  SELECT
    s.id,
    s.status,
    s.session_exit_form,
    row_number() OVER (
      PARTITION BY s.enrollment_id, s.date
      ORDER BY
        (s.session_exit_form IS NOT NULL) DESC,
        (s.status NOT IN ('Active', 'Unconfirmed')) DESC,
        s.created_at,
        s.id
    ) AS copy_rank
  FROM public."Sessions" s
  WHERE s.enrollment_id IN (SELECT DISTINCT keeper_id FROM _enrollment_merge)
    AND s.date IS NOT NULL
)
SELECT r.id AS session_id
FROM ranked r
WHERE r.copy_rank > 1
  AND r.status IN ('Active', 'Unconfirmed')
  AND r.session_exit_form IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.zoom_participant_events z WHERE z.session_id = r.id
  );

-- session_reminders has no foreign key to Sessions; drop the deleted copies' rows too.
DELETE FROM public.session_reminders sr
USING _session_dedupe d
WHERE sr.session_id = d.session_id;

DELETE FROM public."Sessions" s
USING _session_dedupe d
WHERE s.id = d.session_id;

CREATE UNIQUE INDEX IF NOT EXISTS enrollments_unique_slot
  ON public."Enrollments" (tutor_id, student_id, day, start_time);

DROP TABLE _session_dedupe;
DROP TABLE _enrollment_merge;
