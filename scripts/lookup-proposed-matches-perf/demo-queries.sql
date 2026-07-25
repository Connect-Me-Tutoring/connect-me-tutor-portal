-- Queries only (run after sample-seed.sql). Used by npm run demo:lookup-matches.

\echo ''
\echo '=== lookup_proposed_matches: student (Alice) -> tutor candidates (Bob excluded via Pairings) ==='
SELECT *
FROM public.lookup_proposed_matches(
  'student',
  (SELECT pr.id FROM public.pairing_requests pr
   JOIN public."Profiles" p ON p.id = pr.user_id
   WHERE p.email = 'lpm_demo_student_alice@local.test' AND pr.type = 'student' LIMIT 1),
  NULL::uuid[],
  10
);

\echo ''
\echo '=== lookup_proposed_matches: tutor (Eve) -> student candidates ==='
SELECT *
FROM public.lookup_proposed_matches(
  'tutor',
  (SELECT pr.id FROM public.pairing_requests pr
   JOIN public."Profiles" p ON p.id = pr.user_id
   WHERE p.email = 'lpm_demo_tutor_eve@local.test' AND pr.type = 'tutor' LIMIT 1),
  NULL::uuid[],
  10
);

\echo ''
\echo '=== EXPLAIN ANALYZE (student flow) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.lookup_proposed_matches(
  'student',
  (SELECT pr.id FROM public.pairing_requests pr
   JOIN public."Profiles" p ON p.id = pr.user_id
   WHERE p.email = 'lpm_demo_student_alice@local.test' AND pr.type = 'student' LIMIT 1),
  NULL::uuid[],
  10
);
