-- Access-control tests: what each class of caller can and cannot do.
--
-- Run with scripts/db-access-tests.sh, which loads every migration into a
-- throwaway Postgres and executes this file. Any failed expectation raises,
-- so a non-zero exit means a real regression.
--
-- The caller classes are the ones that actually reach the database:
--   anon           - the public anon key, e.g. a logged-out browser or a
--                    script holding NEXT_PUBLIC_SUPABASE_ANON_KEY
--   student/tutor  - a signed-in non-admin
--   inactive admin - an Admin profile whose status is Inactive
--   active admin   - the real thing
--   service_role   - trusted server code; bypasses RLS by design
--
-- PostgREST authenticates by switching to the anon/authenticated role and
-- setting request.jwt.claim.sub, which is what pg_temp.as_user does here.

\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
begin;

-- ---------------------------------------------------------------------------
-- Harness
-- ---------------------------------------------------------------------------

create or replace function pg_temp.as_user(p_uid uuid) returns void
language plpgsql as $$
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
end;
$$;

create or replace function pg_temp.as_role(p_role text) returns void
language plpgsql as $$
begin
  execute format('set local role %I', p_role);
  perform set_config('request.jwt.claim.sub', '', true);
end;
$$;

-- Counts rows a caller can actually see. Anything RLS hides simply is not
-- counted, which is the point.
create or replace function pg_temp.expect_rows(p_label text, p_sql text, p_expected bigint)
returns void language plpgsql as $$
declare
  v_actual bigint;
begin
  execute 'select count(*) from (' || p_sql || ') _q' into v_actual;
  if v_actual is distinct from p_expected then
    raise exception 'FAIL % : expected % row(s), got %', p_label, p_expected, v_actual;
  end if;
  raise notice 'ok   %', p_label;
end;
$$;

-- The statement must be refused. A statement that succeeds is the failure.
create or replace function pg_temp.expect_error(p_label text, p_sql text, p_contains text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(lower(p_contains) in lower(SQLERRM)) = 0 then
      raise exception 'FAIL % : refused, but with the wrong error: %', p_label, SQLERRM;
    end if;
    raise notice 'ok   % (refused: %)', p_label, SQLERRM;
    return;
  end;
  raise exception 'FAIL % : the statement was allowed but must be refused', p_label;
end;
$$;

-- An UPDATE that RLS filters out affects 0 rows rather than raising.
-- As with reads, a write that changes nothing may also be refused outright
-- for want of a privilege; both pass.
create or replace function pg_temp.expect_no_rows_changed(p_label text, p_sql text)
returns void language plpgsql as $$
declare
  v_count bigint;
begin
  begin
    execute p_sql;
  exception when insufficient_privilege then
    raise notice 'ok   % (refused: %)', p_label, SQLERRM;
    return;
  end;
  get diagnostics v_count = ROW_COUNT;
  if v_count <> 0 then
    raise exception 'FAIL % : changed % row(s), expected none', p_label, v_count;
  end if;
  raise notice 'ok   %', p_label;
end;
$$;

-- Reaching nothing can look two ways: row level security returns no rows,
-- or the role holds no privilege on the table at all and the read is refused.
-- Either one passes; a single returned row does not.
create or replace function pg_temp.expect_nothing(p_label text, p_sql text)
returns void language plpgsql as $$
declare
  v_actual bigint;
begin
  begin
    execute 'select count(*) from (' || p_sql || ') _q' into v_actual;
  exception when insufficient_privilege then
    raise notice 'ok   % (refused: %)', p_label, SQLERRM;
    return;
  end;
  if v_actual <> 0 then
    raise exception 'FAIL % : expected nothing, got % row(s)', p_label, v_actual;
  end if;
  raise notice 'ok   %', p_label;
end;
$$;
create or replace function pg_temp.expect_rows_changed(p_label text, p_sql text, p_expected bigint)
returns void language plpgsql as $$
declare
  v_count bigint;
begin
  execute p_sql;
  get diagnostics v_count = ROW_COUNT;
  if v_count is distinct from p_expected then
    raise exception 'FAIL % : changed % row(s), expected %', p_label, v_count, p_expected;
  end if;
  raise notice 'ok   %', p_label;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'active.admin@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'tutor@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'student@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'inactive.admin@test.local'),
  ('55555555-5555-5555-5555-555555555555', 'other.tutor@test.local');

insert into "Profiles"
  (id, user_id, role, status, first_name, last_name, created_at, subjects_of_interest, settings_id)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111',
   'Admin', 'Active', 'Ada', 'Admin', now() - interval '300 days', null, gen_random_uuid()),
  ('aaaaaaaa-0000-0000-0000-00000000000b', '22222222-2222-2222-2222-222222222222',
   'Tutor', 'Active', 'Tom', 'Tutor', now() - interval '120 days', array['Math'], gen_random_uuid()),
  ('aaaaaaaa-0000-0000-0000-00000000000c', '33333333-3333-3333-3333-333333333333',
   'Student', 'Active', 'Sue', 'Student', now() - interval '50 days', array['Math'], gen_random_uuid()),
  ('aaaaaaaa-0000-0000-0000-00000000000d', '44444444-4444-4444-4444-444444444444',
   'Admin', 'Inactive', 'Old', 'Admin', now() - interval '300 days', null, gen_random_uuid()),
  ('aaaaaaaa-0000-0000-0000-00000000000e', '55555555-5555-5555-5555-555555555555',
   'Tutor', 'Active', 'Uma', 'Unrelated', now() - interval '120 days', array['Reading'], gen_random_uuid());

insert into "Pairings" (id, tutor_id, student_id, created_at) values
  ('bbbbbbbb-0000-0000-0000-00000000000a',
   'aaaaaaaa-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-00000000000c',
   now() - interval '45 days'),
  -- the same student with a different tutor, so the first tutor must not see it
  ('bbbbbbbb-0000-0000-0000-00000000000b',
   'aaaaaaaa-0000-0000-0000-00000000000e', 'aaaaaaaa-0000-0000-0000-00000000000c',
   now() - interval '20 days');

insert into "Sessions" (id, tutor_id, student_id, date, status, duration) values
  ('cccccccc-0000-0000-0000-00000000000a',
   'aaaaaaaa-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-00000000000c',
   now() - interval '10 days', 'Complete', 60),
  ('cccccccc-0000-0000-0000-00000000000b',
   'aaaaaaaa-0000-0000-0000-00000000000e', 'aaaaaaaa-0000-0000-0000-00000000000c',
   now() - interval '5 days', 'Complete', 60);

insert into pairing_requests (id, type, user_id, created_at, priority) values
  ('dddddddd-0000-0000-0000-00000000000a', 'student',
   'aaaaaaaa-0000-0000-0000-00000000000c', now() - interval '50 days', 1),
  ('dddddddd-0000-0000-0000-00000000000b', 'tutor',
   'aaaaaaaa-0000-0000-0000-00000000000b', now() - interval '40 days', 1);

-- These three carry no fixture rows of their own elsewhere in the file, and a
-- table nobody populated would satisfy "anon sees nothing" without RLS doing
-- any work at all.
insert into pairing_matches (id, tutor_id, student_id, similarity) values
  ('eeeeeeee-0000-0000-0000-00000000000a',
   'aaaaaaaa-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-00000000000c', 0.9),
  ('eeeeeeee-0000-0000-0000-00000000000b',
   'aaaaaaaa-0000-0000-0000-00000000000e', 'aaaaaaaa-0000-0000-0000-00000000000c', 0.7);

insert into pairing_logs (id, message, type) values
  ('ffffffff-0000-0000-0000-00000000000a', 'paired a student', 'pairing-match');

-- Tom's own hours, and Uma's, whom nobody but an admin is related to.
insert into "User_Availabilities" (day_of_the_week, start_time, end_time, profile_id) values
  (1, '15:00', '16:00', 'aaaaaaaa-0000-0000-0000-00000000000b'),
  (2, '15:00', '16:00', 'aaaaaaaa-0000-0000-0000-00000000000e');

-- Guard against the fixtures themselves silently vanishing: every table these
-- tests claim to hide must actually hold something to hide.
do $fixtures$
begin
  if (select count(*) from pairing_matches) = 0
     or (select count(*) from pairing_logs) = 0
     or (select count(*) from "User_Availabilities") = 0
     or (select count(*) from "Profiles") = 0
     or (select count(*) from "Sessions") = 0
     or (select count(*) from "Pairings") = 0
     or (select count(*) from pairing_requests) = 0 then
    raise exception 'FAIL fixtures: a table these tests read is empty, so its expectations prove nothing';
  end if;
end;
$fixtures$;


-- ---------------------------------------------------------------------------
-- anon: the public key must reach nothing
-- ---------------------------------------------------------------------------

select pg_temp.as_role('anon');

select pg_temp.expect_nothing('anon reads no Profiles',         'select 1 from "Profiles"');
select pg_temp.expect_nothing('anon reads no Sessions',         'select 1 from "Sessions"');
select pg_temp.expect_nothing('anon reads no Pairings',         'select 1 from "Pairings"');
select pg_temp.expect_nothing('anon reads no pairing_requests', 'select 1 from pairing_requests');
select pg_temp.expect_nothing('anon reads no pairing_matches',  'select 1 from pairing_matches');
select pg_temp.expect_nothing('anon reads no pairing_logs',     'select 1 from pairing_logs');
select pg_temp.expect_nothing('anon reads no User_Availabilities',
                              'select 1 from "User_Availabilities"');

select pg_temp.expect_error('anon cannot call the overview',
  $q$select public.data_portal_overview('last-90-days')$q$, 'permission denied');

select pg_temp.expect_error('anon cannot ask the assistant',
  $q$select public.data_portal_assistant_claim()$q$, 'permission denied');

select pg_temp.expect_no_rows_changed('anon cannot promote anyone',
  $q$update "Profiles" set role = 'Admin' where id = 'aaaaaaaa-0000-0000-0000-00000000000b'$q$);

reset role;

-- ---------------------------------------------------------------------------
-- Row-scoped reads: a signed-in non-admin sees their own rows and no others
-- ---------------------------------------------------------------------------
-- The fixtures hold two pairings, two matches and two requests, split between
-- two different tutors, so each of these counts distinguishes "scoped" from
-- "happened to be the only row".

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');

select pg_temp.expect_rows('tutor sees only their own pairing',
  'select 1 from "Pairings"', 1);
select pg_temp.expect_rows('tutor sees only their own pairing match',
  'select 1 from pairing_matches', 1);
select pg_temp.expect_rows('tutor sees only their own pairing request',
  'select 1 from pairing_requests', 1);
select pg_temp.expect_rows('tutor sees no pairing logs',
  'select 1 from pairing_logs', 0);
select pg_temp.expect_rows('tutor sees only their own availability',
  $q$select 1 from "User_Availabilities"
     where profile_id = 'aaaaaaaa-0000-0000-0000-00000000000b'$q$, 1);
select pg_temp.expect_rows('tutor sees no unrelated tutor''s availability',
  $q$select 1 from "User_Availabilities"
     where profile_id = 'aaaaaaaa-0000-0000-0000-00000000000e'$q$, 0);

-- Students and tutors write to the log when they enter the queue or answer a
-- match, so losing the read must not cost them the write.
select pg_temp.expect_rows_changed('tutor may still write a pairing log',
  $q$insert into pairing_logs (message, type) values ('entered the queue', 'pairing-match')$q$, 1);

reset role;

select pg_temp.as_user('33333333-3333-3333-3333-333333333333');

-- This student is in both pairings, so a scoped policy is not simply hiding
-- the second row from everyone.
select pg_temp.expect_rows('student sees both pairings they are in',
  'select 1 from "Pairings"', 2);
select pg_temp.expect_rows('student sees only their own pairing request',
  'select 1 from pairing_requests', 1);

reset role;

select pg_temp.as_user('44444444-4444-4444-4444-444444444444');

select pg_temp.expect_rows('inactive admin gets no admin-wide read of pairings',
  'select 1 from "Pairings"', 0);
select pg_temp.expect_rows('inactive admin sees no pairing logs',
  'select 1 from pairing_logs', 0);

reset role;

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select pg_temp.expect_rows('active admin still sees every pairing',
  'select 1 from "Pairings"', 2);
select pg_temp.expect_rows('active admin still sees every pairing match',
  'select 1 from pairing_matches', 2);
select pg_temp.expect_rows('active admin still sees every pairing request',
  'select 1 from pairing_requests', 2);
-- Two: the fixture row, plus the one the tutor wrote a moment ago.
select pg_temp.expect_rows('active admin still sees the pairing logs',
  'select 1 from pairing_logs', 2);
select pg_temp.expect_rows('active admin still sees availability rows',
  'select 1 from "User_Availabilities"', 2);

reset role;

-- ---------------------------------------------------------------------------
-- tutor: a signed-in non-admin
-- ---------------------------------------------------------------------------

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');

select pg_temp.expect_error('tutor cannot call the overview',
  $q$select public.data_portal_overview('last-90-days')$q$, 'Admin access required');

select pg_temp.expect_error('tutor cannot ask the assistant',
  $q$select public.data_portal_assistant_claim()$q$, 'Admin access required');

select pg_temp.expect_error('tutor cannot touch the assistant counts',
  $q$delete from analysis.assistant_requests$q$, 'permission denied');

select pg_temp.expect_error('tutor cannot promote self to Admin',
  $q$update "Profiles" set role = 'Admin' where id = 'aaaaaaaa-0000-0000-0000-00000000000b'$q$,
  'Not allowed to modify privileged Profiles columns');

select pg_temp.expect_error('tutor cannot create an Admin profile',
  $q$insert into "Profiles" (user_id, role, status, first_name, last_name, settings_id)
     values ('22222222-2222-2222-2222-222222222222', 'Admin', 'Active', 'E', 'V', gen_random_uuid())$q$,
  'violates row-level security policy');

-- Pausing yourself (Active to Inactive) is the one status change dev allows
-- a tutor or student, so it is not tested as refused. Changing anyone else's
-- status is refused.
select pg_temp.expect_no_rows_changed('tutor cannot change another profile''s status',
  $q$update "Profiles" set status = 'Inactive' where id = 'aaaaaaaa-0000-0000-0000-00000000000e'$q$);

select pg_temp.expect_rows_changed('tutor may edit own name',
  $q$update "Profiles" set first_name = 'Tommy' where id = 'aaaaaaaa-0000-0000-0000-00000000000b'$q$, 1);

select pg_temp.expect_no_rows_changed('tutor cannot edit another profile',
  $q$update "Profiles" set first_name = 'Hacked' where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$q$);

select pg_temp.expect_error('tutor cannot activate someone elses admin profile',
  $q$update user_settings set last_active_profile_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
     where user_id = '22222222-2222-2222-2222-222222222222'$q$,
  'row-level security');

-- The case above is also stopped by the unique constraint on
-- last_active_profile_id, because Ada's profile is already her active one.
-- An Admin profile that is nobody's active profile has only the policy in
-- front of it. Ada gets a second one for this check and loses it after.
reset role;
insert into "Profiles" (id, user_id, role, status, first_name, last_name, created_at, settings_id)
values ('aaaaaaaa-0000-0000-0000-0000000000ff', '11111111-1111-1111-1111-111111111111',
        'Admin', 'Active', 'Ada', 'Spare', now(), gen_random_uuid());
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');

select pg_temp.expect_error('tutor cannot activate an admin profile nobody is using',
  $q$update user_settings set last_active_profile_id = 'aaaaaaaa-0000-0000-0000-0000000000ff'
     where user_id = '22222222-2222-2222-2222-222222222222'$q$,
  'row-level security');

reset role;
delete from "Profiles" where id = 'aaaaaaaa-0000-0000-0000-0000000000ff';

-- ---------------------------------------------------------------------------
-- student
-- ---------------------------------------------------------------------------

select pg_temp.as_user('33333333-3333-3333-3333-333333333333');

select pg_temp.expect_error('student cannot call the overview',
  $q$select public.data_portal_overview('last-90-days')$q$, 'Admin access required');

select pg_temp.expect_error('student cannot ask the assistant',
  $q$select public.data_portal_assistant_claim()$q$, 'Admin access required');

select pg_temp.expect_error('student cannot promote self',
  $q$update "Profiles" set role = 'Admin' where id = 'aaaaaaaa-0000-0000-0000-00000000000c'$q$,
  'Not allowed to modify privileged Profiles columns');

-- Students set their own account status from the Settings page, so this one
-- is deliberately allowed where the tutor case above is not.
select pg_temp.expect_rows_changed('student may set own status',
  $q$update "Profiles" set status = 'Inactive' where id = 'aaaaaaaa-0000-0000-0000-00000000000c'$q$, 1);

-- Pausing is one way: reactivating takes an admin, so Ada puts Sue back.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
update "Profiles" set status = 'Active' where id = 'aaaaaaaa-0000-0000-0000-00000000000c';

reset role;

-- ---------------------------------------------------------------------------
-- inactive admin: deactivation must actually remove access
-- ---------------------------------------------------------------------------

select pg_temp.as_user('44444444-4444-4444-4444-444444444444');

select pg_temp.expect_error('inactive admin cannot call the overview',
  $q$select public.data_portal_overview('last-90-days')$q$, 'Admin access required');

select pg_temp.expect_error('inactive admin cannot ask the assistant',
  $q$select public.data_portal_assistant_claim()$q$, 'Admin access required');

select pg_temp.expect_error('inactive admin cannot reactivate self',
  $q$update "Profiles" set status = 'Active' where id = 'aaaaaaaa-0000-0000-0000-00000000000d'$q$,
  'Not allowed to modify privileged Profiles columns');

select pg_temp.expect_no_rows_changed('inactive admin cannot edit another profile',
  $q$update "Profiles" set first_name = 'Hacked' where id = 'aaaaaaaa-0000-0000-0000-00000000000b'$q$);

reset role;

-- ---------------------------------------------------------------------------
-- active admin: the legitimate path still works
-- ---------------------------------------------------------------------------

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select pg_temp.expect_rows('active admin gets an overview payload',
  $q$select public.data_portal_overview('last-90-days', 'America/New_York')$q$, 1);

-- Subject demand.
--
-- Case: Uma lists her subject as "math " where Tom has "Math". Before the fix
-- that was two rows, "Math" and "math".
--
-- Join: a login whose Student profile has the same id as the login itself,
-- and which also holds a Tutor profile. The old join matched the request's
-- user_id against Profiles.user_id too, which counted the Tutor profile's
-- "Art" as a second student asking for Art.
reset role;
update "Profiles" set subjects_of_interest = array['math ']
  where id = 'aaaaaaaa-0000-0000-0000-00000000000e';
insert into auth.users (id, email) values
  ('88888888-8888-8888-8888-888888888888', 'family@test.local');
insert into "Profiles"
  (id, user_id, role, status, first_name, last_name, created_at, subjects_of_interest, settings_id)
values
  ('88888888-8888-8888-8888-888888888888', '88888888-8888-8888-8888-888888888888',
   'Student', 'Active', 'Kim', 'Kid', now() - interval '30 days', array['Art'], gen_random_uuid()),
  ('aaaaaaaa-0000-0000-0000-000000000088', '88888888-8888-8888-8888-888888888888',
   'Tutor', 'Active', 'Kim', 'Parent', now() - interval '30 days', array['Art'], gen_random_uuid());
insert into pairing_requests (id, type, user_id, created_at, priority) values
  ('dddddddd-0000-0000-0000-00000000000c', 'student',
   '88888888-8888-8888-8888-888888888888', now() - interval '20 days', 1);
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select pg_temp.expect_rows('subject demand has one row for math, whatever the case',
  $q$select 1
     from jsonb_array_elements(public.data_portal_overview('last-90-days', 'America/New_York')
                               -> 'subjectDemand' -> 'rows') r
     where lower(trim(r ->> 'subject')) = 'math'
       and (r ->> 'studentsRequesting')::int = 1
       and (r ->> 'tutorsAvailable')::int = 2$q$, 1);
select pg_temp.expect_rows('subject demand counts the requesting student, not the tutor on that login',
  $q$select 1
     from jsonb_array_elements(public.data_portal_overview('last-90-days', 'America/New_York')
                               -> 'subjectDemand' -> 'rows') r
     where r ->> 'subject' = 'Art'
       and (r ->> 'studentsRequesting')::int = 1
       and (r ->> 'tutorsAvailable')::int = 1$q$, 1);

select pg_temp.expect_rows('active admin may ask the assistant',
  $q$select 1 where (public.data_portal_assistant_claim()->>'allowed')::boolean$q$, 1);

select pg_temp.expect_error('active admin cannot edit the assistant counts directly',
  $q$delete from analysis.assistant_requests$q$, 'permission denied');

do $$
begin
  for i in 2..15 loop
    perform public.data_portal_assistant_claim();
  end loop;
end
$$;

select pg_temp.expect_rows('the 16th question in five minutes is refused',
  $q$select 1 where public.data_portal_assistant_claim()
       @> '{"allowed": false, "limit": "admin_burst"}'$q$, 1);

reset role;

-- The other limits count every admin together. Age this admin's questions
-- past the burst window and fill the rest with someone else's.
update analysis.assistant_requests set requested_at = now() - interval '1 hour';
insert into analysis.assistant_requests (user_id, requested_at)
select gen_random_uuid(), now() - interval '2 hours' from generate_series(1, 85);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select pg_temp.expect_rows('the 101st question in a day across all admins is refused',
  $q$select 1 where public.data_portal_assistant_claim()
       @> '{"allowed": false, "limit": "global_daily"}'$q$, 1);
reset role;

delete from analysis.assistant_requests where user_id <> '11111111-1111-1111-1111-111111111111';
insert into analysis.assistant_requests (user_id, requested_at)
select gen_random_uuid(), now() - (interval '1 day' * (2 + g % 27))
from generate_series(1, 485) as g;
insert into analysis.assistant_requests (user_id, requested_at)
values (gen_random_uuid(), now() - interval '31 days');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select pg_temp.expect_rows('the 501st question in thirty days is refused',
  $q$select 1 where public.data_portal_assistant_claim()
       @> '{"allowed": false, "limit": "global_monthly"}'$q$, 1);
reset role;

select pg_temp.expect_rows('questions older than thirty days are cleared away',
  $q$select 1 from analysis.assistant_requests where requested_at < now() - interval '30 days'$q$, 0);

delete from analysis.assistant_requests;

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select pg_temp.expect_rows_changed('active admin may deactivate a tutor',
  $q$update "Profiles" set status = 'Inactive' where id = 'aaaaaaaa-0000-0000-0000-00000000000b'$q$, 1);

select pg_temp.expect_rows_changed('active admin may change a role',
  $q$update "Profiles" set role = 'Student' where id = 'aaaaaaaa-0000-0000-0000-00000000000b'$q$, 1);

reset role;

-- ---------------------------------------------------------------------------
-- uploaded data: Active Admins only, and only through the functions
-- ---------------------------------------------------------------------------
-- The storage schema is absent from this image, so the bucket policies are
-- not exercised here and data_portal_begin_upload skips its file check.

-- A dataset already in place, so every refused read below has rows to hide,
-- and a second Active Admin, to show an upload belongs to whoever started it.
create table uploads.fixture_dataset (name text, grade text);
insert into uploads.fixture_dataset values ('Ana', '9'), ('Lee', '10');
insert into analysis.uploaded_datasets
  (name, title, columns, row_count, storage_path, original_filename, uploaded_by_profile)
values
  ('fixture_dataset', 'Fixture', array['name', 'grade'], 2,
   'datasets/fixture_dataset/v1.csv', 'v1.csv', 'aaaaaaaa-0000-0000-0000-00000000000a');

insert into auth.users (id, email) values
  ('99999999-9999-9999-9999-999999999999', 'second.admin@test.local');
insert into "Profiles" (id, user_id, role, status, first_name, last_name, settings_id) values
  ('aaaaaaaa-0000-0000-0000-000000000099', '99999999-9999-9999-9999-999999999999',
   'Admin', 'Active', 'Bea', 'Admin', gen_random_uuid());

select pg_temp.as_role('anon');

select pg_temp.expect_error('anon cannot list uploaded data',
  $q$select public.data_portal_list_datasets()$q$, 'permission denied');
select pg_temp.expect_error('anon cannot start an upload',
  $q$select public.data_portal_begin_upload('x', 'X', array['a'], 'datasets/x/f.csv', 'f.csv')$q$,
  'permission denied');
select pg_temp.expect_error('anon cannot read an uploaded table',
  $q$select * from uploads.fixture_dataset$q$, 'permission denied');

reset role;

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');

select pg_temp.expect_error('tutor cannot list uploaded data',
  $q$select public.data_portal_list_datasets()$q$, 'Admin access required');
select pg_temp.expect_error('tutor cannot preview uploaded data',
  $q$select public.data_portal_dataset_preview('fixture_dataset')$q$, 'Admin access required');
select pg_temp.expect_error('tutor cannot start an upload',
  $q$select public.data_portal_begin_upload('x', 'X', array['a'], 'datasets/x/f.csv', 'f.csv')$q$,
  'Admin access required');
select pg_temp.expect_error('tutor cannot read an uploaded table',
  $q$select * from uploads.fixture_dataset$q$, 'permission denied');
select pg_temp.expect_error('tutor cannot read the upload catalog',
  $q$select * from analysis.uploaded_datasets$q$, 'permission denied');
select pg_temp.expect_error('tutor cannot create a table among the uploads',
  $q$create table uploads.planted (x text)$q$, 'permission denied');

reset role;

select pg_temp.as_user('33333333-3333-3333-3333-333333333333');

select pg_temp.expect_error('student cannot list uploaded data',
  $q$select public.data_portal_list_datasets()$q$, 'Admin access required');
select pg_temp.expect_error('student cannot preview uploaded data',
  $q$select public.data_portal_dataset_preview('fixture_dataset')$q$, 'Admin access required');
select pg_temp.expect_error('student cannot read an uploaded table',
  $q$select * from uploads.fixture_dataset$q$, 'permission denied');

reset role;

select pg_temp.as_user('44444444-4444-4444-4444-444444444444');

select pg_temp.expect_error('inactive admin cannot list uploaded data',
  $q$select public.data_portal_list_datasets()$q$, 'Admin access required');
select pg_temp.expect_error('inactive admin cannot start an upload',
  $q$select public.data_portal_begin_upload('x', 'X', array['a'], 'datasets/x/f.csv', 'f.csv')$q$,
  'Admin access required');

reset role;

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select pg_temp.expect_rows('active admin sees the uploaded datasets',
  $q$select jsonb_array_elements(public.data_portal_list_datasets())$q$, 1);
select pg_temp.expect_rows('active admin previews an uploaded dataset',
  $q$select 1 where public.data_portal_dataset_preview('fixture_dataset')
       @> '{"rowCount": 2, "rows": [["Ana", "9"], ["Lee", "10"]]}'$q$, 1);
select pg_temp.expect_error('even an admin reads uploads only through the functions',
  $q$select * from uploads.fixture_dataset$q$, 'permission denied');

select pg_temp.expect_error('a dataset name must be an identifier',
  $q$select public.data_portal_begin_upload('Bad Name', 'X', array['a'], 'datasets/bad/f.csv', 'f.csv')$q$,
  'Invalid dataset name');
select pg_temp.expect_error('a column name cannot carry SQL',
  $q$select public.data_portal_begin_upload('ok_name', 'X', array['a"; drop table x; --'],
       'datasets/ok_name/f.csv', 'f.csv')$q$, 'Invalid column names');
select pg_temp.expect_error('column names must be unique',
  $q$select public.data_portal_begin_upload('ok_name', 'X', array['a', 'a'],
       'datasets/ok_name/f.csv', 'f.csv')$q$, 'Invalid column names');
select pg_temp.expect_error('the file must be in the dataset''s own folder',
  $q$select public.data_portal_begin_upload('ok_name', 'X', array['a'],
       'datasets/other/f.csv', 'f.csv')$q$, 'Invalid storage path');

-- Replace the fixture dataset with a three-column version.
do $$
declare
  v_id uuid;
begin
  v_id := public.data_portal_begin_upload('fixture_dataset', 'Fixture v2',
    array['name', 'grade', 'school'], 'datasets/fixture_dataset/v2.csv', 'v2.csv');
  perform public.data_portal_append_upload_rows(v_id,
    '[["Ana", "9", "North"], ["Lee", "10", null], ["Kim", "11", "South"]]');
  perform set_config('test.upload_id', v_id::text, true);
end
$$;

select pg_temp.expect_rows('the old table stays in place until the upload finishes',
  $q$select 1 where public.data_portal_dataset_preview('fixture_dataset') @> '{"rowCount": 2}'$q$, 1);
select pg_temp.expect_error('a row with the wrong number of values is refused',
  $q$select public.data_portal_append_upload_rows(current_setting('test.upload_id')::uuid,
       '[["only", "two"]]')$q$, 'Every row must hold 3 text values');
select pg_temp.expect_error('a value that is not text is refused',
  $q$select public.data_portal_append_upload_rows(current_setting('test.upload_id')::uuid,
       '[["Ana", 9, "North"]]')$q$, 'Every row must hold 3 text values');

reset role;

select pg_temp.as_user('99999999-9999-9999-9999-999999999999');
select pg_temp.expect_error('another admin cannot add to someone else''s upload',
  $q$select public.data_portal_append_upload_rows(current_setting('test.upload_id')::uuid,
       '[["X", "1", "Y"]]')$q$, 'Unknown upload');
select pg_temp.expect_error('another admin cannot finish someone else''s upload',
  $q$select public.data_portal_finish_upload(current_setting('test.upload_id')::uuid)$q$,
  'Unknown upload');
reset role;

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select pg_temp.expect_rows('finishing the upload swaps the new table in',
  $q$select 1 where public.data_portal_finish_upload(current_setting('test.upload_id')::uuid)
       @> '{"name": "fixture_dataset", "rowCount": 3}'$q$, 1);
select pg_temp.expect_rows('the replaced dataset holds the new rows and columns',
  $q$select 1 where public.data_portal_dataset_preview('fixture_dataset')
       @> '{"columns": ["name", "grade", "school"], "rowCount": 3,
            "rows": [["Lee", "10", null]]}'$q$, 1);
select pg_temp.expect_error('a finished upload cannot be added to',
  $q$select public.data_portal_append_upload_rows(current_setting('test.upload_id')::uuid,
       '[["X", "1", "Y"]]')$q$, 'already ready');

-- A cancelled upload leaves the dataset as it was.
do $$
declare
  v_id uuid;
begin
  v_id := public.data_portal_begin_upload('fixture_dataset', 'Fixture v3',
    array['name'], 'datasets/fixture_dataset/v3.csv', 'v3.csv');
  perform public.data_portal_append_upload_rows(v_id, '[["Zed"]]');
  perform public.data_portal_cancel_upload(v_id);
end
$$;

select pg_temp.expect_rows('a cancelled upload changes nothing',
  $q$select 1 where public.data_portal_dataset_preview('fixture_dataset') @> '{"rowCount": 3}'$q$, 1);

reset role;

select pg_temp.expect_rows('the finished upload is recorded in the history',
  $q$select 1 from analysis.dataset_uploads
     where dataset_name = 'fixture_dataset' and status = 'ready'$q$, 1);
select pg_temp.expect_rows('no staging table is left behind',
  $q$select 1 from pg_tables where schemaname = 'uploads' and tablename like '\_import\_%'$q$, 0);

-- ---------------------------------------------------------------------------
-- signup: metadata is attacker-controlled and must not mint an admin
-- ---------------------------------------------------------------------------

create trigger test_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

select pg_temp.expect_error('signup metadata cannot assign Admin',
  $q$insert into auth.users (id, email, raw_user_meta_data)
     values ('66666666-6666-6666-6666-666666666666', 'evil@test.local',
             '{"role":"Admin","first_name":"E","last_name":"V"}')$q$,
  'cannot assign the Admin role');

select pg_temp.expect_rows_changed('an ordinary signup still works',
  $q$insert into auth.users (id, email, raw_user_meta_data)
     values ('77777777-7777-7777-7777-777777777777', 'new.student@test.local',
             '{"role":"Student","first_name":"N","last_name":"S"}')$q$, 1);

select pg_temp.expect_rows('the signup created exactly one Active profile',
  $q$select 1 from "Profiles"
     where user_id = '77777777-7777-7777-7777-777777777777' and status = 'Active'$q$, 1);

drop trigger test_on_auth_user_created on auth.users;

-- ---------------------------------------------------------------------------
-- service_role: trusted server code bypasses row level security
-- ---------------------------------------------------------------------------
-- It is not exempt from guard_profile_columns, though. On dev, role and
-- status changes go through an admin's own session (see
-- lib/actions/profile/profile-status.test.ts), so only an unguarded column is
-- written here.

select pg_temp.as_role('service_role');

select pg_temp.expect_rows_changed('service role may edit any profile',
  $q$update "Profiles" set last_name = 'Edited' where id = 'aaaaaaaa-0000-0000-0000-00000000000e'$q$, 1);

reset role;

rollback;
