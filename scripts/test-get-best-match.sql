-- Test queries for public.get_best_match(request_type, request_id, p_exclude_tutor_ids)
-- Run in Supabase SQL Editor or: psql $DATABASE_URL -f scripts/test-get-best-match.sql
--
-- 1) Find queued requests you can use as inputs (pick one id + its type).
SELECT
  pr.id AS request_id,
  pr.type AS request_type,
  pr.in_queue,
  pr.priority,
  pr.status,
  p.email AS requestor_email
FROM pairing_requests pr
JOIN public."Profiles" p ON p.id = pr.user_id
WHERE pr.in_queue IS DISTINCT FROM false
  AND pr.type IN ('student', 'tutor')
ORDER BY pr.created_at DESC
LIMIT 20;

-- 2) Replace the placeholders below with a real request_id and matching request_type from step 1.
--    Student flow: finds best tutor; optional third arg excludes tutor profile UUIDs.
-- \set request_id '00000000-0000-0000-0000-000000000000'
-- For psql you can: \set request_id '''xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'''

SELECT
  pairing_request_id,
  similarity,
  jsonb_pretty(match_profile)    AS match_profile,
  jsonb_pretty(requestor_profile) AS requestor_profile
FROM public.get_best_match(
  'student',                                                      -- or 'tutor'
  '00000000-0000-0000-0000-000000000000'::uuid,                   -- <-- paste request_id
  NULL::uuid[]                                                     -- or ARRAY['uuid-of-tutor-to-exclude'::uuid]
);

-- 3) Same call without pretty-print (raw jsonb, one row).
-- SELECT * FROM public.get_best_match('student', '00000000-0000-0000-0000-000000000000'::uuid, NULL);

-- 4) If step 2 returns no rows: the request may be missing from queue, have no overlapping
--    availability with any opposite-type candidate, or no candidates pass Pairings / exclude rules.
