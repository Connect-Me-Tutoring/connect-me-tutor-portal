-- Performance checks for public.lookup_proposed_matches (full app schema: pairing_requests, Profiles).
-- Plain docker-compose Postgres has no these tables — use Supabase-linked DB or run perf seed first.
-- Prefer: benchmark-sample.sql + sample-seed.sql via npm run benchmark:lookup-matches (demo data).
-- This file uses perf_lpm_* anchors; run seed.sql before use.

\timing on

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT *
FROM public.lookup_proposed_matches(
  'student',
  (
    SELECT pr.id
    FROM public.pairing_requests pr
    JOIN public."Profiles" p ON p.id = pr.user_id
    WHERE p.email = 'perf_lpm_student_anchor@local.test'
      AND pr.type = 'student'
    LIMIT 1
  ),
  NULL::uuid[],
  50
);

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT *
FROM public.lookup_proposed_matches(
  'tutor',
  (
    SELECT pr.id
    FROM public.pairing_requests pr
    JOIN public."Profiles" p ON p.id = pr.user_id
    WHERE p.email = 'perf_lpm_tutor_anchor@local.test'
      AND pr.type = 'tutor'
    LIMIT 1
  ),
  NULL::uuid[],
  50
);

\timing off
