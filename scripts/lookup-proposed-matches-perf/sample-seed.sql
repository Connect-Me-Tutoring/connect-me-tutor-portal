-- Sample student/tutor rows for lookup_proposed_matches (lpm_demo_*@local.test).
-- Used by demo-lookup-matches.sql and run-benchmark.sh.
-- Requires: Supabase-style auth + public schema with migrations applied.

BEGIN;

DELETE FROM public.pairing_requests pr
USING public."Profiles" p
WHERE pr.user_id = p.id AND p.email LIKE 'lpm_demo_%@local.test';

DELETE FROM public."Pairings" pair
USING public."Profiles" ps, public."Profiles" pt
WHERE pair.student_id = ps.id AND pair.tutor_id = pt.id
  AND (ps.email LIKE 'lpm_demo_%@local.test' OR pt.email LIKE 'lpm_demo_%@local.test');

DELETE FROM public."Profiles" p WHERE p.email LIKE 'lpm_demo_%@local.test';
DELETE FROM auth.users u WHERE u.email LIKE 'lpm_demo_%@local.test';

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
SELECT
  (SELECT id FROM auth.instances LIMIT 1),
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  e,
  crypt('demo-local', gen_salt('bf')),
  now(), '{}', '{}', now(), now()
FROM unnest(ARRAY[
  'lpm_demo_student_alice@local.test',
  'lpm_demo_student_frank@local.test',
  'lpm_demo_tutor_bob@local.test',
  'lpm_demo_tutor_carol@local.test',
  'lpm_demo_tutor_dan@local.test',
  'lpm_demo_tutor_eve@local.test'
]::text[]) AS u(e);

INSERT INTO public."Profiles" (
  id, user_id, email, role, first_name, last_name, age, grade, gender, start_date,
  availability, parent_name, parent_phone, parent_email, phone_number, timezone,
  subjects_of_interest, status, student_number, languages_spoken
)
SELECT gen_random_uuid(), u.id, u.email, r.role, r.fn, r.ln, r.age, r.gr, 'na', '2020-01-01',
  r.avail::jsonb, '', '', '', '', 'America/New_York', r.subjects, 'Active', '', ARRAY['en']::text[]
FROM auth.users u
JOIN (VALUES
  ('lpm_demo_student_alice@local.test', 'Student', 'Alice', 'Student', '15', '10',
   '[{"day":"Monday","startTime":"3:00 PM","endTime":"6:00 PM"},{"day":"Wednesday","startTime":"3:00 PM","endTime":"6:00 PM"}]',
   ARRAY['math', 'reading']::text[]),
  ('lpm_demo_student_frank@local.test', 'Student', 'Frank', 'Student', '16', '11',
   '[{"day":"Tuesday","startTime":"4:00 PM","endTime":"7:00 PM"}]',
   ARRAY['science', 'math']::text[]),
  ('lpm_demo_tutor_bob@local.test', 'Tutor', 'Bob', 'Tutor', '22', '12',
   '[{"day":"Monday","startTime":"2:00 PM","endTime":"8:00 PM"},{"day":"Friday","startTime":"9:00 AM","endTime":"12:00 PM"}]',
   ARRAY['math', 'science']::text[]),
  ('lpm_demo_tutor_carol@local.test', 'Tutor', 'Carol', 'Tutor', '24', 'na',
   '[{"day":"Wednesday","startTime":"1:00 PM","endTime":"5:00 PM"}]',
   ARRAY['reading', 'writing']::text[]),
  ('lpm_demo_tutor_dan@local.test', 'Tutor', 'Dan', 'Tutor', '30', 'na',
   '[{"day":"Thursday","startTime":"10:00 AM","endTime":"2:00 PM"}]',
   ARRAY['history']::text[]),
  ('lpm_demo_tutor_eve@local.test', 'Tutor', 'Eve', 'Tutor', '28', 'na',
   '[{"day":"Monday","startTime":"3:00 PM","endTime":"7:00 PM"}]',
   ARRAY['math']::text[])
) AS r(email, role, fn, ln, age, gr, avail, subjects)
  ON u.email = r.email;

INSERT INTO public.pairing_requests (
  user_id, type, priority, notes, status, in_queue, exclude_rejected_tutors
)
SELECT p.id, pr.req_type, pr.pri, pr.notes, 'pending', true, true
FROM public."Profiles" p
JOIN (VALUES
  ('lpm_demo_student_alice@local.test', 'student', 1, 'demo student queue'),
  ('lpm_demo_student_frank@local.test', 'student', 2, 'demo student queue'),
  ('lpm_demo_tutor_bob@local.test', 'tutor', 1, 'demo tutor queue'),
  ('lpm_demo_tutor_carol@local.test', 'tutor', 2, 'demo tutor queue'),
  ('lpm_demo_tutor_dan@local.test', 'tutor', 2, 'demo tutor queue'),
  ('lpm_demo_tutor_eve@local.test', 'tutor', 1, 'demo tutor queue')
) AS pr(email, req_type, pri, notes)
  ON p.email = pr.email;

INSERT INTO public."Pairings" (student_id, tutor_id)
SELECT ps.id, pt.id
FROM public."Profiles" ps
CROSS JOIN public."Profiles" pt
WHERE ps.email = 'lpm_demo_student_alice@local.test'
  AND pt.email = 'lpm_demo_tutor_bob@local.test';

COMMIT;
