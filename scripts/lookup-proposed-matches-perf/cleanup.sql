-- Remove synthetic rows: perf_lpm_* (bulk perf seed) and lpm_demo_* (demo-lookup-matches.sql)
-- Run against the same DB you used for seed/demo (local or staging only).

BEGIN;

DELETE FROM public.pairing_requests pr
USING public."Profiles" p
WHERE pr.user_id = p.id
  AND (p.email LIKE 'perf_lpm_%@local.test' OR p.email LIKE 'lpm_demo_%@local.test');

DELETE FROM public."Pairings" pair
USING public."Profiles" ps, public."Profiles" pt
WHERE pair.student_id = ps.id
  AND pair.tutor_id = pt.id
  AND (
    ps.email LIKE 'perf_lpm_%@local.test' OR pt.email LIKE 'perf_lpm_%@local.test'
    OR ps.email LIKE 'lpm_demo_%@local.test' OR pt.email LIKE 'lpm_demo_%@local.test'
  );

DELETE FROM public."Profiles" p
WHERE p.email LIKE 'perf_lpm_%@local.test'
   OR p.email LIKE 'lpm_demo_%@local.test';

DELETE FROM auth.users u
WHERE u.email LIKE 'perf_lpm_%@local.test'
   OR u.email LIKE 'lpm_demo_%@local.test';

COMMIT;
