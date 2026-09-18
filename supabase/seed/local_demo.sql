-- A demo dataset for the local stack. Never run this against anything shared.
--
-- One admin you can sign in as, a handful of tutors and students, pairings and
-- four months of sessions, so the Data Portal has something real to draw.

\set ON_ERROR_STOP on
begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------
-- GoTrue signs a user in on auth.users plus a matching auth.identities row.

create temporary table seed_people (
  uid uuid, pid uuid, role text, first_name text, last_name text,
  email text, created_at timestamptz, subjects text[]
) on commit drop;

insert into seed_people values
  ('10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Admin','Ada','Admin','admin@local.test', now() - interval '400 days', null),
  ('10000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000002','Tutor','Tom','Tutor','tutor@local.test',  now() - interval '300 days', array['Algebra I','Reading']),
  ('10000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000003','Student','Sue','Student','student@local.test', now() - interval '250 days', array['Algebra I']);

-- Plus a cohort, so retention and the funnel have more than one point.
insert into seed_people
select
  ('10000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid,
  ('a0000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid,
  case when i % 4 = 0 then 'Tutor' else 'Student' end,
  'Person', 'Number ' || i,
  'person' || i || '@local.test',
  now() - make_interval(days => 30 + (i * 11) % 330),
  case when i % 3 = 0 then array['Algebra I']
       when i % 3 = 1 then array['Reading','Writing']
       else array['Geometry','Chemistry'] end
from generate_series(1, 28) as i;

-- The token columns are declared nullable but GoTrue scans them into Go
-- strings, so a NULL there makes every sign-in fail with a 500. Empty string,
-- not NULL.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token,
  reauthentication_token
)
select
  '00000000-0000-0000-0000-000000000000', p.uid, 'authenticated', 'authenticated',
  p.email, crypt('localdemo123', gen_salt('bf')),
  p.created_at, p.created_at, p.created_at,
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('first_name', p.first_name, 'last_name', p.last_name),
  '', '', '', '', '', '', '', ''
from seed_people p;

insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
select p.uid::text, p.uid,
       jsonb_build_object('sub', p.uid::text, 'email', p.email, 'email_verified', true),
       'email', p.created_at, p.created_at
from seed_people p;

-- Profiles. A trigger on this table creates the matching user_settings row,
-- which is what the admin gate reads.
insert into "Profiles" (
  id, user_id, role, status, first_name, last_name, email,
  created_at, subjects_of_interest, settings_id, timezone
)
select p.pid, p.uid, p.role, 'Active', p.first_name, p.last_name, p.email,
       p.created_at, p.subjects, gen_random_uuid(), 'America/New_York'
from seed_people p;

-- ---------------------------------------------------------------------------
-- Pairings, requests and sessions
-- ---------------------------------------------------------------------------

insert into "Pairings" (tutor_id, student_id, created_at)
select t.id, s.id, greatest(t.created_at, s.created_at) + interval '3 days'
from (select id, created_at, row_number() over (order by created_at) rn
      from "Profiles" where role = 'Tutor') t
join (select id, created_at, row_number() over (order by created_at) rn
      from "Profiles" where role = 'Student') s
  on s.rn % greatest((select count(*) from "Profiles" where role = 'Tutor'), 1)
     = t.rn % greatest((select count(*) from "Profiles" where role = 'Tutor'), 1);

insert into pairing_requests (type, user_id, created_at, priority, status)
select 'student', s.id, s.created_at + interval '1 day', 1, 'pending'
from "Profiles" s where s.role = 'Student';

-- Completed sessions across the last 120 days, weekly per pairing, with a few
-- cancellations so the numbers are not uniformly clean.
insert into "Sessions" (tutor_id, student_id, date, status, duration)
select pr.tutor_id, pr.student_id, d::timestamptz, 
       case when (extract(day from d)::int + abs(hashtext(pr.tutor_id::text))) % 9 = 0
            then 'Cancelled'::session_status else 'Complete'::session_status end,
       60
from "Pairings" pr
cross join lateral generate_series(
  greatest(pr.created_at, now() - interval '120 days')::date,
  (now() - interval '1 day')::date,
  interval '7 days'
) as d;

commit;

\echo ''
\echo '  Sign in at http://localhost:3000 with:'
\echo '    admin@local.test   / localdemo123     (Admin, sees the Data Portal)'
\echo '    tutor@local.test   / localdemo123'
\echo '    student@local.test / localdemo123'
\echo ''
