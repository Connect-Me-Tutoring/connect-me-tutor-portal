
-- Two populations, deliberately reported separately:
--   active -- a Pairings row still exists. Length = created_at -> today. This is
--             tenure to date, not a finished duration.
--   ended  -- no Pairings row survives. deletePairingServer hard-deletes the
--             Pairings and Enrollments rows on unpair, so the only remaining
--             evidence is completed Sessions, which keep tutor_id/student_id.
--             Length = first completed session -> last completed session.
--
-- a pair that met once and then cancelled for weeks before unpairing measures as 0 days. Roughly 1/3 of
-- ended pairs currently measure 0 for that reason.
--
-- Sessions whose profile was deleted have tutor_id/student_id SET NULL and
-- cannot be attributed to a pair, so they are excluded throughout.
--
-- Test and dummy accounts are excluded by name match (25 pairings today).
-- Deliberately a substring match, not word-boundary: several junk accounts are
-- concatenated, e.g. "testAman testAman".

create or replace function get_pairing_length_stats()
returns table (
  population text,
  pairs bigint,
  avg_days numeric,
  median_days numeric,
  max_days integer,
  single_session_pairs bigint
)
language sql
security definer
set search_path = public
as $$
  with active as (
    select (current_date - p.created_at::date) as days
    from "Pairings" p
    join "Profiles" pt on pt.id = p.tutor_id
    join "Profiles" ps on ps.id = p.student_id
    where coalesce(pt.first_name, '') !~* 'test|dummy'
      and coalesce(pt.last_name, '') !~* 'test|dummy'
      and coalesce(ps.first_name, '') !~* 'test|dummy'
      and coalesce(ps.last_name, '') !~* 'test|dummy'
  ),
  ended as (
    select (max(s.date)::date - min(s.date)::date) as days
    from "Sessions" s
    left join "Pairings" p
      on p.tutor_id = s.tutor_id and p.student_id = s.student_id
    join "Profiles" pt on pt.id = s.tutor_id
    join "Profiles" ps on ps.id = s.student_id
    where s.status = 'Complete'
      and p.id is null
      and s.tutor_id is not null
      and s.student_id is not null
      and coalesce(pt.first_name, '') !~* 'test|dummy'
      and coalesce(pt.last_name, '') !~* 'test|dummy'
      and coalesce(ps.first_name, '') !~* 'test|dummy'
      and coalesce(ps.last_name, '') !~* 'test|dummy'
    group by s.tutor_id, s.student_id
  ),
  combined as (
    select days, 'active' as population from active
    union all
    select days, 'ended' from ended
  )
  select
    population,
    count(*) as pairs,
    round(avg(days)) as avg_days,
    round(percentile_cont(0.5) within group (order by days)::numeric) as median_days,
    max(days)::integer as max_days,
    -- A zero-day span means every completed session fell on one date, i.e. the
    -- pair only ever met once.
    count(*) filter (where days = 0) as single_session_pairs
  from combined
  group by population
  union all
  select
    'all',
    count(*),
    round(avg(days)),
    round(percentile_cont(0.5) within group (order by days)::numeric),
    max(days)::integer,
    count(*) filter (where days = 0)
  from combined;
$$;

grant execute on function get_pairing_length_stats() to authenticated;

-- Individual pairings for the detail table. p_population is whitelisted rather
-- than interpolated; p_limit keeps the payload bounded.
create or replace function get_pairing_lengths(
  p_population text default 'all',
  p_limit integer default 100
)
returns table (
  tutor_name text,
  student_name text,
  days integer,
  status text,
  started_on date
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_population not in ('active', 'ended', 'all') then
    raise exception 'Invalid population: %. Expected active, ended, or all.', p_population;
  end if;

  return query
  with active as (
    select
      p.tutor_id,
      p.student_id,
      (current_date - p.created_at::date) as days,
      'active'::text as status,
      p.created_at::date as started_on
    from "Pairings" p
    join "Profiles" pt on pt.id = p.tutor_id
    join "Profiles" ps on ps.id = p.student_id
    where coalesce(pt.first_name, '') !~* 'test|dummy'
      and coalesce(pt.last_name, '') !~* 'test|dummy'
      and coalesce(ps.first_name, '') !~* 'test|dummy'
      and coalesce(ps.last_name, '') !~* 'test|dummy'
  ),
  ended as (
    select
      s.tutor_id,
      s.student_id,
      (max(s.date)::date - min(s.date)::date) as days,
      'ended'::text as status,
      min(s.date)::date as started_on
    from "Sessions" s
    left join "Pairings" p
      on p.tutor_id = s.tutor_id and p.student_id = s.student_id
    join "Profiles" pt on pt.id = s.tutor_id
    join "Profiles" ps on ps.id = s.student_id
    where s.status = 'Complete'
      and p.id is null
      and s.tutor_id is not null
      and s.student_id is not null
      and coalesce(pt.first_name, '') !~* 'test|dummy'
      and coalesce(pt.last_name, '') !~* 'test|dummy'
      and coalesce(ps.first_name, '') !~* 'test|dummy'
      and coalesce(ps.last_name, '') !~* 'test|dummy'
    group by s.tutor_id, s.student_id
  ),
  combined as (
    select * from active
    union all
    select * from ended
  )
  select
    trim(coalesce(t.first_name, '') || ' ' || coalesce(t.last_name, '')) as tutor_name,
    trim(coalesce(st.first_name, '') || ' ' || coalesce(st.last_name, '')) as student_name,
    c.days::integer,
    c.status,
    c.started_on
  from combined c
  left join "Profiles" t on t.id = c.tutor_id
  left join "Profiles" st on st.id = c.student_id
  where p_population = 'all' or c.status = p_population
  order by c.days desc
  limit p_limit;
end;
$$;

grant execute on function get_pairing_lengths(text, integer) to authenticated;
