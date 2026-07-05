-- Extend get_best_match to accept optional p_exclude_tutor_ids so students can exclude tutors who previously rejected them.
-- If get_best_match already exists in your project, copy its current definition from Supabase Dashboard (Database > Functions),
-- then add the parameter and exclusion logic below. Replace the placeholder with your full function body.

-- Parameter to add: p_exclude_tutor_ids uuid[] DEFAULT NULL
-- In the candidate/tutor selection subquery or WHERE clause, add:
--   AND (p_exclude_tutor_ids IS NULL OR cardinality(p_exclude_tutor_ids) = 0 OR tutor_id != ALL(p_exclude_tutor_ids))

-- Example signature change (adapt to your existing function):
-- CREATE OR REPLACE FUNCTION get_best_match(
--   request_type text,
--   request_id uuid,
--   p_exclude_tutor_ids uuid[] DEFAULT NULL
-- )
-- RETURNS ... AS $$
--   -- existing logic; in the part that selects the tutor, add:
--   -- AND (p_exclude_tutor_ids IS NULL OR cardinality(p_exclude_tutor_ids) = 0 OR <tutor_id_column> != ALL(p_exclude_tutor_ids))
-- $$ LANGUAGE plpgsql;

-- Placeholder: no-op so migration runs. Replace with actual CREATE OR REPLACE FUNCTION after copying from Supabase.
SELECT 1;
