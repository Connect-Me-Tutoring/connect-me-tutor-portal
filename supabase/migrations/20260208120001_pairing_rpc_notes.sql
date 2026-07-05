-- Reference only: apply these rules inside your existing Supabase function bodies.
-- Replace placeholders with your actual parameter names and table aliases.

-- get_pairing_matches_with_profiles (inbox):
--   AND (pm.tutor_status IS NULL OR pm.tutor_status NOT IN ('rejected', 'accepted'))
--   (adjust to match how you represent "pending".)

-- get_top_pairing_request / get_all_pairing_requests:
--   AND pr.in_queue IS DISTINCT FROM false

-- get_best_match: after picking a candidate tutor–student pair, exclude if EXISTS (
--   SELECT 1 FROM pairing_matches pm
--   WHERE pm.student_id = <candidate_student> AND pm.tutor_id = <candidate_tutor>
--     AND pm.tutor_status = 'rejected'
--     AND (
--       current_setting('app.pairing_rejection_mode', true) = 'never'
--       OR coalesce(pm.rejected_at, pm.created_at) > now() - make_interval(days => <N>)
--     )
-- );
-- For "never", omit the interval clause or use a config flag from vault.
