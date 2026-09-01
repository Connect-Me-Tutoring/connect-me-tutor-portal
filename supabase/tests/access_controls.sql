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
create or replace function pg_temp.expect_no_rows_changed(p_label text, p_sql text)
returns void language plpgsql as $$
declare
  v_count bigint;
begin
  execute p_sql;
  get diagnostics v_count = ROW_COUNT;
  if v_count <> 0 then
    raise exception 'FAIL % : changed % row(s), expected none', p_label, v_count;
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
   now() - interval '45 days');

insert into "Sessions" (id, tutor_id, student_id, date, status, duration) values
  ('cccccccc-0000-0000-0000-00000000000a',
   'aaaaaaaa-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-00000000000c',
   now() - interval '10 days', 'Complete', 60),
  ('cccccccc-0000-0000-0000-00000000000b',
   'aaaaaaaa-0000-0000-0000-00000000000e', 'aaaaaaaa-0000-0000-0000-00000000000c',
   now() - interval '5 days', 'Complete', 60);

insert into pairing_requests (id, type, user_id, created_at, priority) values
  ('dddddddd-0000-0000-0000-00000000000a', 'student',
   'aaaaaaaa-0000-0000-0000-00000000000c', now() - interval '50 days', 1);

-- These three carry no fixture rows of their own elsewhere in the file, and a
-- table nobody populated would satisfy "anon sees nothing" without RLS doing
-- any work at all.
insert into pairing_matches (id, tutor_id, student_id, similarity) values
  ('eeeeeeee-0000-0000-0000-00000000000a',
   'aaaaaaaa-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-00000000000c', 0.9);

insert into pairing_logs (id, message, type) values
  ('ffffffff-0000-0000-0000-00000000000a', 'paired a student', 'pairing-match');

insert into "User_Availabilities" (day_of_the_week, start_time, end_time, profile_id) values
  (1, '15:00', '16:00', 'aaaaaaaa-0000-0000-0000-00000000000b');

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

select pg_temp.expect_rows('anon reads no Profiles',         'select 1 from "Profiles"',      0);
select pg_temp.expect_rows('anon reads no Sessions',         'select 1 from "Sessions"',      0);
select pg_temp.expect_rows('anon reads no Pairings',         'select 1 from "Pairings"',      0);
select pg_temp.expect_rows('anon reads no pairing_requests', 'select 1 from pairing_requests',0);
select pg_temp.expect_rows('anon reads no pairing_matches',  'select 1 from pairing_matches', 0);
select pg_temp.expect_rows('anon reads no pairing_logs',     'select 1 from pairing_logs',    0);
select pg_temp.expect_rows('anon reads no User_Availabilities',
                           'select 1 from "User_Availabilities"', 0);

select pg_temp.expect_error('anon cannot call the overview',
  $q$select public.data_portal_overview('last-90-days')$q$, 'permission denied');

select pg_temp.expect_no_rows_changed('anon cannot promote anyone',
  $q$update "Profiles" set role = 'Admin' where id = 'aaaaaaaa-0000-0000-0000-00000000000b'$q$);

reset role;

-- ---------------------------------------------------------------------------
-- tutor: a signed-in non-admin
-- ---------------------------------------------------------------------------

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');

select pg_temp.expect_error('tutor cannot call the overview',
  $q$select public.data_portal_overview('last-90-days')$q$, 'Admin access required');

select pg_temp.expect_error('tutor cannot promote self to Admin',
  $q$update "Profiles" set role = 'Admin' where id = 'aaaaaaaa-0000-0000-0000-00000000000b'$q$,
  'Only an admin can change a profile role');

select pg_temp.expect_error('tutor cannot create an Admin profile',
  $q$insert into "Profiles" (user_id, role, status, first_name, last_name, settings_id)
     values ('22222222-2222-2222-2222-222222222222', 'Admin', 'Active', 'E', 'V', gen_random_uuid())$q$,
  'Only an admin can create an Admin profile');

select pg_temp.expect_error('tutor cannot change own status',
  $q$update "Profiles" set status = 'Inactive' where id = 'aaaaaaaa-0000-0000-0000-00000000000b'$q$,
  'Only an admin can change a profile status');

select pg_temp.expect_rows_changed('tutor may edit own name',
  $q$update "Profiles" set first_name = 'Tommy' where id = 'aaaaaaaa-0000-0000-0000-00000000000b'$q$, 1);

select pg_temp.expect_no_rows_changed('tutor cannot edit another profile',
  $q$update "Profiles" set first_name = 'Hacked' where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$q$);

select pg_temp.expect_error('tutor cannot activate someone elses admin profile',
  $q$update user_settings set last_active_profile_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
     where user_id = '22222222-2222-2222-2222-222222222222'$q$,
  'row-level security');

reset role;

-- ---------------------------------------------------------------------------
-- student
-- ---------------------------------------------------------------------------

select pg_temp.as_user('33333333-3333-3333-3333-333333333333');

select pg_temp.expect_error('student cannot call the overview',
  $q$select public.data_portal_overview('last-90-days')$q$, 'Admin access required');

select pg_temp.expect_error('student cannot promote self',
  $q$update "Profiles" set role = 'Admin' where id = 'aaaaaaaa-0000-0000-0000-00000000000c'$q$,
  'Only an admin can change a profile role');

-- Students set their own account status from the Settings page, so this one
-- is deliberately allowed where the tutor case above is not.
select pg_temp.expect_rows_changed('student may set own status',
  $q$update "Profiles" set status = 'Inactive' where id = 'aaaaaaaa-0000-0000-0000-00000000000c'$q$, 1);
update "Profiles" set status = 'Active' where id = 'aaaaaaaa-0000-0000-0000-00000000000c';

reset role;

-- ---------------------------------------------------------------------------
-- inactive admin: deactivation must actually remove access
-- ---------------------------------------------------------------------------

select pg_temp.as_user('44444444-4444-4444-4444-444444444444');

select pg_temp.expect_error('inactive admin cannot call the overview',
  $q$select public.data_portal_overview('last-90-days')$q$, 'Admin access required');

select pg_temp.expect_error('inactive admin cannot reactivate self',
  $q$update "Profiles" set status = 'Active' where id = 'aaaaaaaa-0000-0000-0000-00000000000d'$q$,
  'Only an admin can change a profile status');

select pg_temp.expect_no_rows_changed('inactive admin cannot edit another profile',
  $q$update "Profiles" set first_name = 'Hacked' where id = 'aaaaaaaa-0000-0000-0000-00000000000b'$q$);

reset role;

-- ---------------------------------------------------------------------------
-- active admin: the legitimate path still works
-- ---------------------------------------------------------------------------

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select pg_temp.expect_rows('active admin gets an overview payload',
  $q$select public.data_portal_overview('last-90-days', 'America/New_York')$q$, 1);

select pg_temp.expect_rows_changed('active admin may deactivate a tutor',
  $q$update "Profiles" set status = 'Inactive' where id = 'aaaaaaaa-0000-0000-0000-00000000000b'$q$, 1);

select pg_temp.expect_rows_changed('active admin may change a role',
  $q$update "Profiles" set role = 'Student' where id = 'aaaaaaaa-0000-0000-0000-00000000000b'$q$, 1);

reset role;

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
-- service_role: trusted server code is deliberately unrestricted
-- ---------------------------------------------------------------------------

select pg_temp.as_role('service_role');

select pg_temp.expect_rows_changed('service role may set a role',
  $q$update "Profiles" set role = 'Tutor' where id = 'aaaaaaaa-0000-0000-0000-00000000000b'$q$, 1);

reset role;

rollback;
