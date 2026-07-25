-- Synthetic data for local/staging performance testing of lookup_proposed_matches.
-- Tags: emails perf_lpm_%@local.test — remove with cleanup.sql
--
-- Tune scale at top (defaults are moderate; raise for stress tests).
-- Requires: migrations through 20260403120000_lookup_proposed_matches.sql applied.
-- Expects: public."Profiles", public.pairing_requests, public."Pairings", auth.users (typical Supabase).
--
-- Profiles columns follow app inserts (lib/type-utils InterfaceToTableProfiles + id).
-- If your table has extra NOT NULL columns without defaults, add them to the INSERT lists below.

-- Pool sizes (required): psql -v tutor_pool=N -v student_pool=M
-- scripts/lookup-proposed-matches-perf/run.sh passes defaults.
-- Interactive default if you omit -v:
--   \set tutor_pool 2000
--   \set student_pool 500

BEGIN;

-- 1) Auth users (Profiles.user_id usually references auth.users.id)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
SELECT
  (SELECT id FROM auth.instances LIMIT 1),
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'perf_lpm_tutor_' || gs.n || '@local.test',
  crypt('perf-local-only', gen_salt('bf')),
  now(),
  '{}',
  '{}',
  now(),
  now()
FROM generate_series(1, :tutor_pool) AS gs(n)
ON CONFLICT (email) DO NOTHING;

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
SELECT
  (SELECT id FROM auth.instances LIMIT 1),
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'perf_lpm_student_' || gs.n || '@local.test',
  crypt('perf-local-only', gen_salt('bf')),
  now(),
  '{}',
  '{}',
  now(),
  now()
FROM generate_series(1, :student_pool) AS gs(n)
ON CONFLICT (email) DO NOTHING;

-- Anchor rows (fixed emails for benchmark.sql)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
SELECT
  (SELECT id FROM auth.instances LIMIT 1),
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  email,
  crypt('perf-local-only', gen_salt('bf')),
  now(),
  '{}',
  '{}',
  now(),
  now()
FROM (VALUES
  ('perf_lpm_student_anchor@local.test'),
  ('perf_lpm_tutor_anchor@local.test')
) AS v(email)
ON CONFLICT (email) DO NOTHING;

-- 2) Profiles + pairing_requests for bulk tutors (numeric suffix only; not anchors)
WITH au AS (
  SELECT u.id AS auth_id, u.email
  FROM auth.users u
  WHERE u.email ~ '^perf_lpm_tutor_[0-9]+@local\.test$'
),
ins AS (
  INSERT INTO public."Profiles" (
    id,
    user_id,
    email,
    role,
    first_name,
    last_name,
    age,
    grade,
    gender,
    start_date,
    availability,
    parent_name,
    parent_phone,
    parent_email,
    phone_number,
    timezone,
    subjects_of_interest,
    status,
    student_number,
    languages_spoken
  )
  SELECT
    gen_random_uuid(),
    au.auth_id,
    au.email,
    'Tutor',
    'Perf',
    split_part(au.email, '@', 1),
    '18',
    '12',
    'na',
    '2020-01-01',
    '[]'::jsonb,
    '',
    '',
    '',
    '',
    'America/New_York',
    CASE (abs(hashtext(au.email)) % 6)
      WHEN 0 THEN ARRAY['math', 'science', 'reading']::text[]
      WHEN 1 THEN ARRAY['math', 'science']::text[]
      WHEN 2 THEN ARRAY['math']::text[]
      WHEN 3 THEN ARRAY['science', 'reading']::text[]
      WHEN 4 THEN ARRAY['reading']::text[]
      ELSE ARRAY[]::text[]
    END,
    'Active',
    '',
    ARRAY['en']::text[]
  FROM au
  RETURNING id, email
)
INSERT INTO public.pairing_requests (
  user_id,
  type,
  priority,
  notes,
  status,
  in_queue,
  exclude_rejected_tutors
)
SELECT
  ins.id,
  'tutor',
  1 + (abs(hashtext(ins.email)) % 3),
  'perf seed',
  'pending',
  true,
  true
FROM ins;

-- 3) Profiles + pairing_requests for bulk students (numeric suffix only)
WITH au AS (
  SELECT u.id AS auth_id, u.email
  FROM auth.users u
  WHERE u.email ~ '^perf_lpm_student_[0-9]+@local\.test$'
),
ins AS (
  INSERT INTO public."Profiles" (
    id,
    user_id,
    email,
    role,
    first_name,
    last_name,
    age,
    grade,
    gender,
    start_date,
    availability,
    parent_name,
    parent_phone,
    parent_email,
    phone_number,
    timezone,
    subjects_of_interest,
    status,
    student_number,
    languages_spoken
  )
  SELECT
    gen_random_uuid(),
    au.auth_id,
    au.email,
    'Student',
    'Perf',
    split_part(au.email, '@', 1),
    '14',
    '9',
    'na',
    '2020-01-01',
    '[]'::jsonb,
    '',
    '',
    '',
    '',
    'America/New_York',
    CASE (abs(hashtext(au.email)) % 5)
      WHEN 0 THEN ARRAY['math', 'science']::text[]
      WHEN 1 THEN ARRAY['math']::text[]
      WHEN 2 THEN ARRAY['science', 'reading']::text[]
      WHEN 3 THEN ARRAY['reading']::text[]
      ELSE ARRAY['math', 'science', 'reading', 'writing']::text[]
    END,
    'Active',
    '',
    ARRAY['en']::text[]
  FROM au
  RETURNING id, email
)
INSERT INTO public.pairing_requests (
  user_id,
  type,
  priority,
  notes,
  status,
  in_queue,
  exclude_rejected_tutors
)
SELECT
  ins.id,
  'student',
  1 + (abs(hashtext(ins.email)) % 3),
  'perf seed',
  'pending',
  true,
  true
FROM ins;

-- 4) Anchor student (subjects overlap with many tutors)
INSERT INTO public."Profiles" (
  id,
  user_id,
  email,
  role,
  first_name,
  last_name,
  age,
  grade,
  gender,
  start_date,
  availability,
  parent_name,
  parent_phone,
  parent_email,
  phone_number,
  timezone,
  subjects_of_interest,
  status,
  student_number,
  languages_spoken
)
SELECT
  gen_random_uuid(),
  u.id,
  'perf_lpm_student_anchor@local.test',
  'Student',
  'Anchor',
  'Student',
  '15',
  '10',
  'na',
  '2020-01-01',
  '[]'::jsonb,
  '',
  '',
  '',
  '',
  'America/New_York',
  ARRAY['math', 'science', 'reading']::text[],
  'Active',
  '',
  ARRAY['en']::text[]
FROM auth.users u
WHERE u.email = 'perf_lpm_student_anchor@local.test'
  AND NOT EXISTS (
    SELECT 1 FROM public."Profiles" p WHERE p.email = 'perf_lpm_student_anchor@local.test'
  );

INSERT INTO public.pairing_requests (
  user_id,
  type,
  priority,
  notes,
  status,
  in_queue,
  exclude_rejected_tutors
)
SELECT
  p.id,
  'student',
  1,
  'perf anchor student',
  'pending',
  true,
  true
FROM public."Profiles" p
WHERE p.email = 'perf_lpm_student_anchor@local.test'
  AND NOT EXISTS (
    SELECT 1 FROM public.pairing_requests pr
    WHERE pr.user_id = p.id AND pr.type = 'student'
  );

-- 5) Anchor tutor
INSERT INTO public."Profiles" (
  id,
  user_id,
  email,
  role,
  first_name,
  last_name,
  age,
  grade,
  gender,
  start_date,
  availability,
  parent_name,
  parent_phone,
  parent_email,
  phone_number,
  timezone,
  subjects_of_interest,
  status,
  student_number,
  languages_spoken
)
SELECT
  gen_random_uuid(),
  u.id,
  'perf_lpm_tutor_anchor@local.test',
  'Tutor',
  'Anchor',
  'Tutor',
  '30',
  'na',
  'na',
  '2020-01-01',
  '[]'::jsonb,
  '',
  '',
  '',
  '',
  'America/New_York',
  ARRAY['math', 'science']::text[],
  'Active',
  '',
  ARRAY['en']::text[]
FROM auth.users u
WHERE u.email = 'perf_lpm_tutor_anchor@local.test'
  AND NOT EXISTS (
    SELECT 1 FROM public."Profiles" p WHERE p.email = 'perf_lpm_tutor_anchor@local.test'
  );

INSERT INTO public.pairing_requests (
  user_id,
  type,
  priority,
  notes,
  status,
  in_queue,
  exclude_rejected_tutors
)
SELECT
  p.id,
  'tutor',
  1,
  'perf anchor tutor',
  'pending',
  true,
  true
FROM public."Profiles" p
WHERE p.email = 'perf_lpm_tutor_anchor@local.test'
  AND NOT EXISTS (
    SELECT 1 FROM public.pairing_requests pr
    WHERE pr.user_id = p.id AND pr.type = 'tutor'
  );

-- 6) Sample exclusion: one Pairings row for anchor student + first bulk tutor (optional)
INSERT INTO public."Pairings" (student_id, tutor_id)
SELECT
  ps.id,
  pt.id
FROM public."Profiles" ps
CROSS JOIN public."Profiles" pt
WHERE ps.email = 'perf_lpm_student_anchor@local.test'
  AND pt.email = 'perf_lpm_tutor_1@local.test'
  AND NOT EXISTS (
    SELECT 1 FROM public."Pairings" x
    WHERE x.student_id = ps.id AND x.tutor_id = pt.id
  );

COMMIT;

-- Summary (run with psql to see counts)
SELECT
  (SELECT count(*) FROM auth.users WHERE email LIKE 'perf_lpm_%@local.test') AS perf_auth_users,
  (SELECT count(*) FROM public."Profiles" WHERE email LIKE 'perf_lpm_%@local.test') AS perf_profiles,
  (SELECT count(*) FROM public.pairing_requests pr
   JOIN public."Profiles" p ON p.id = pr.user_id
   WHERE p.email LIKE 'perf_lpm_%@local.test') AS perf_pairing_requests;
