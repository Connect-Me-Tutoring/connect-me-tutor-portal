-- One enrollment per (tutor, student, day, start_time). addEnrollment checks for a
-- duplicate before inserting (#890), but check-then-insert lets concurrent or rapidly
-- repeated requests through, and prod had 21 such slots (up to 24 copies of one).
--
-- Merge each duplicate group into one keeper before indexing: the copy with the most
-- sessions (then the oldest), so the slot's history stays on a single enrollment. The
-- other copies' sessions are re-pointed to the keeper and the copies are deleted.
-- Only Sessions references Enrollments. The keeper's summary/meeting/start_date win.

CREATE TEMP TABLE _enrollment_merge AS
WITH ranked AS (
  SELECT
    e.id,
    first_value(e.id) OVER slot AS keeper_id
  FROM public."Enrollments" e
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

CREATE UNIQUE INDEX IF NOT EXISTS enrollments_unique_slot
  ON public."Enrollments" (tutor_id, student_id, day, start_time);

DROP TABLE _enrollment_merge;
