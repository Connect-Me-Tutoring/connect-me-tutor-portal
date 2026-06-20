-- EXPLAIN ANALYZE for lookup_proposed_matches using demo sample rows (lpm_demo_*).
-- Load data first: demo-lookup-matches.sql or run-benchmark.sh (default seeds).
--
-- psql vars: match_limit (default 50)
--   psql ... -v match_limit=100 -f benchmark-sample.sql

\timing on

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT *
FROM public.lookup_proposed_matches(
  'student',
  (
    SELECT pr.id
    FROM public.pairing_requests pr
    JOIN public."Profiles" p ON p.id = pr.user_id
    WHERE p.email = 'lpm_demo_student_alice@local.test'
      AND pr.type = 'student'
    LIMIT 1
  ),
  NULL::uuid[],
  :match_limit
);

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT *
FROM public.lookup_proposed_matches(
  'tutor',
  (
    SELECT pr.id
    FROM public.pairing_requests pr
    JOIN public."Profiles" p ON p.id = pr.user_id
    WHERE p.email = 'lpm_demo_tutor_eve@local.test'
      AND pr.type = 'tutor'
    LIMIT 1
  ),
  NULL::uuid[],
  :match_limit
);

\timing off
