-- Exercise lookup_proposed_matches_static (no app tables required).
-- Apply migrations: supabase db push — or (in order):
--   psql ... -f supabase/migrations/20260407180000_lookup_proposed_matches_static.sql
--   psql ... -f supabase/migrations/20260407190000_lookup_proposed_matches_static_requestor_role.sql
--   psql ... -f supabase/migrations/20260408120000_pairing_subject_priority_alignment.sql
--   psql ... -f supabase/migrations/20260408130000_subject_alignment_json_output.sql
--
-- Then: npm run test:lookup-static   or   ./scripts/lookup-proposed-matches-perf/run-static-test.sh
--
-- The middle block matches samples/lookup-static-input.sample.json (10 tutors, no exclude) so you see 10 rows.
-- Older tiny fixtures only had 4 tutors and excluded t1 → 3 rows.

\echo '=== pairing_subject_jaccard (legacy unordered set overlap) ==='
SELECT public.pairing_subject_jaccard(
  ARRAY['math', 'reading']::text[],
  ARRAY['math', 'science']::text[]
) AS jaccard;

\echo ''
\echo '=== pairing_subject_priority_alignment (ordered lists; first = highest priority) ==='
SELECT public.pairing_subject_priority_alignment(
  ARRAY['math', 'reading']::text[],
  ARRAY['math', 'reading']::text[]
) AS perfect_align;
SELECT public.pairing_subject_priority_alignment(
  ARRAY['math', 'reading']::text[],
  ARRAY['reading', 'math']::text[]
) AS swapped_order;
SELECT public.pairing_subject_priority_alignment(
  ARRAY['math', 'reading']::text[],
  ARRAY['math', 'science']::text[]
) AS partial_overlap;

\echo ''
\echo '=== pairing_subject_priority_alignment_detail (JSON: lists + matched index pairs) ==='
SELECT public.pairing_subject_priority_alignment_detail(
  ARRAY['math', 'reading']::text[],
  ARRAY['math', 'algebra', 'science']::text[]
) AS detail_json;

\echo ''
\echo '=== lookup_proposed_matches_static: 10 tutors (aligned with lookup-static-input.sample.json), no exclude, no role filter ==='
SELECT *
FROM public.lookup_proposed_matches_static(
  ARRAY['math', 'reading']::text[],
  $candidates$
[
  {"id":"t1","role":"tutor","priority":1,"subjects":["math","algebra","science","physics"],"first_name":"Bob","last_name":"Alpha","email":"tutor01@example.com"},
  {"id":"t2","role":"tutor","priority":2,"subjects":["reading","writing","social_studies"],"first_name":"Carol","last_name":"Beta","email":"tutor02@example.com"},
  {"id":"t3","role":"tutor","priority":2,"subjects":["history","art"],"first_name":"Dan","last_name":"Gamma","email":"tutor03@example.com"},
  {"id":"t4","role":"tutor","priority":1,"subjects":["geometry"],"first_name":"Eve","last_name":"Delta","email":"tutor04@example.com"},
  {"id":"t5","role":"tutor","priority":3,"subjects":["math","reading","writing","science","computer_science"],"first_name":"Finn","last_name":"Epsilon","email":"tutor05@example.com"},
  {"id":"t6","role":"tutor","priority":1,"subjects":["biology","chemistry","reading"],"first_name":"Gia","last_name":"Zeta","email":"tutor06@example.com"},
  {"id":"t7","role":"tutor","priority":2,"subjects":["spanish","music"],"first_name":"Hal","last_name":"Eta","email":"tutor07@example.com"},
  {"id":"t8","role":"tutor","priority":2,"subjects":["math","reading"],"first_name":"Ivy","last_name":"Theta","email":"tutor08@example.com"},
  {"id":"t9","role":"tutor","priority":3,"subjects":["reading","history","writing"],"first_name":"Jules","last_name":"Iota","email":"tutor09@example.com"},
  {"id":"t10","role":"tutor","priority":1,"subjects":["science","earth_science"],"first_name":"Kai","last_name":"Kappa","email":"tutor10@example.com"}
]
  $candidates$::jsonb,
  NULL::text[],
  10,
  NULL::text
);

\echo ''
\echo '=== requestor_role=student: only candidates with role=tutor (mixed list) ==='
SELECT *
FROM public.lookup_proposed_matches_static(
  ARRAY['math', 'reading']::text[],
  '[
    {"id":"s_wrong","role":"student","priority":1,"subjects":["math"],"first_name":"Wrong","last_name":"Student","email":"w@x.com"},
    {"id":"t_ok","role":"tutor","priority":1,"subjects":["math","science"],"first_name":"Right","last_name":"Tutor","email":"r@x.com"}
  ]'::jsonb,
  NULL::text[],
  10,
  'student'::text
);
