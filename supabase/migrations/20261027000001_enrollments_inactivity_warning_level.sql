-- Which inactivity warning inactivity_warning_sent_at records: 3 (early, 3 missed weeks) or
-- 4 (final, 4 missed weeks). The two warnings share the stamp, so without the level a repeat
-- early warning could re-stamp the enrollment and hold back the final warning until the
-- cooldown ran out. The cron only re-sends the same level after the cooldown, but always
-- lets a higher level through.
ALTER TABLE public."Enrollments"
  ADD COLUMN IF NOT EXISTS inactivity_warning_level smallint;

-- Stamps written before this column existed are treated as early warnings: they still hold
-- back a repeat early warning but never the final one.
UPDATE public."Enrollments"
SET inactivity_warning_level = 3
WHERE inactivity_warning_sent_at IS NOT NULL
  AND inactivity_warning_level IS NULL;

COMMENT ON COLUMN public."Enrollments".inactivity_warning_level IS
  'Level of the inactivity warning recorded in inactivity_warning_sent_at: 3 = early warning, 4 = final warning.';
