-- What the row-level security migrations must leave behind.
--
-- Run with scripts/check-rls.sh, which applies every migration to a throwaway
-- Postgres first. Any failed expectation raises, so a non-zero exit is a real
-- regression.

\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

begin;

-- ---------------------------------------------------------------------------
-- No table may be left with row-level security on and no policy at all
-- ---------------------------------------------------------------------------
-- This is the failure these tests exist for. The policy migrations drop the
-- old policies and then create the new ones; when a create fails, the drop has
-- already happened, so the table ends up locked to everyone but the service
-- role. Applied through the SQL editor, where statements are not rolled back
-- together, that takes the feature offline rather than failing loudly.

do $check$
declare
  v_orphans text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
  into v_orphans
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_policies p on p.schemaname = 'public' and p.tablename = c.relname
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relrowsecurity
    -- Sealed in the baseline snapshot rather than by these migrations, and no
    -- application code reads it. Listed here so the check stays meaningful for
    -- everything else instead of being switched off.
    and c.relname <> 'discord_chatbot_conversations'
  group by c.relname
  having count(p.policyname) = 0;

  if v_orphans is not null then
    raise exception
      'FAIL: row-level security is on with no policy at all, so nobody can read these: %',
      v_orphans;
  end if;
  raise notice 'ok   no table is left locked to everyone';
end;
$check$;

-- ---------------------------------------------------------------------------
-- The anon role reaches nothing
-- ---------------------------------------------------------------------------
-- The anon key ships in the browser bundle, so any policy offering it a read
-- publishes that table to the internet.

do $check$
declare
  v_offenders text;
begin
  select string_agg(tablename || ' (' || policyname || ')', ', ' order by tablename)
  into v_offenders
  from pg_policies
  where schemaname = 'public' and 'anon' = any (roles);

  if v_offenders is not null then
    raise exception 'FAIL: these tables still offer the anon role a policy: %', v_offenders;
  end if;
  raise notice 'ok   no table offers the anon role a policy';
end;
$check$;

-- ---------------------------------------------------------------------------
-- And behaves that way with real rows present
-- ---------------------------------------------------------------------------
-- A count of zero against an empty table would prove nothing, so seed first.

insert into auth.users (id, email)
values ('11111111-1111-1111-1111-111111111111', 'seed.admin@test.local'),
       ('22222222-2222-2222-2222-222222222222', 'seed.student@test.local');

insert into "Profiles"
  (id, user_id, role, status, first_name, last_name, email, phone_number, settings_id)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111',
   'Admin', 'Active', 'Seed', 'Admin', 'seed.admin@test.local', '555-0100', gen_random_uuid()),
  ('aaaaaaaa-0000-0000-0000-00000000000b', '22222222-2222-2222-2222-222222222222',
   'Student', 'Active', 'Seed', 'Student', 'seed.student@test.local', '555-0101', gen_random_uuid());

do $check$
declare
  v_seen bigint;
begin
  if (select count(*) from "Profiles") = 0 then
    raise exception 'FAIL fixtures: nothing seeded, so the count below would prove nothing';
  end if;

  -- Two shapes of denial both count. With the grant revoked the read is
  -- refused outright; with only the policy gone it succeeds and returns
  -- nothing. Either is fine, and insisting on one would make this test brittle
  -- about which mechanism did the work.
  begin
    set local role anon;
    select count(*) into v_seen from "Profiles";
    reset role;
  exception when insufficient_privilege then
    reset role;
    raise notice 'ok   an anonymous caller is refused Profiles outright';
    v_seen := 0;
  end;

  if v_seen <> 0 then
    raise exception 'FAIL: an anonymous caller read % Profiles row(s)', v_seen;
  end if;
  raise notice 'ok   an anonymous caller reads no Profiles rows';
end;
$check$;

-- ---------------------------------------------------------------------------
-- A signed-in user still gets their own row
-- ---------------------------------------------------------------------------
-- Closing the anonymous hole must not close the door on everyone. Without
-- this, a migration that simply dropped every policy would pass the checks
-- above.

do $check$
declare
  v_seen bigint;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  select count(*) into v_seen from "Profiles" where id = 'aaaaaaaa-0000-0000-0000-00000000000b';
  reset role;

  if v_seen <> 1 then
    raise exception
      'FAIL: a signed-in student cannot read their own profile; the policies went too far';
  end if;
  raise notice 'ok   a signed-in user still reads their own profile';
end;
$check$;

rollback;
