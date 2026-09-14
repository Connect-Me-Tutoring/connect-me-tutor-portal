

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

create or replace function get_pairing_lengths(
  p_population text default 'all',
  p_search text default null,
  p_limit integer default 100,
  p_offset integer default 0
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
declare
  v_search text;
  v_pattern text;
begin
  if p_population not in ('active', 'ended', 'all') then
    raise exception 'Invalid population: %. Expected active, ended, or all.', p_population;
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'Invalid limit: %. Expected 1-500.', p_limit;
  end if;

  if p_offset is null or p_offset < 0 then
    raise exception 'Invalid offset: %. Expected 0 or greater.', p_offset;
  end if;

  v_search := nullif(trim(p_search), '');

  -- Treat the search term as a literal: escape the LIKE metacharacters so a stray
  -- % or _ in a name (or a pasted wildcard) matches itself instead of everything.
  if v_search is not null then
    v_pattern := '%' ||
      replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
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
    c.days::integer as days,
    c.status as status,
    c.started_on as started_on
  from combined c
  left join "Profiles" t on t.id = c.tutor_id
  left join "Profiles" st on st.id = c.student_id
  where (p_population = 'all' or c.status = p_population)
    and (
      v_pattern is null
      or trim(coalesce(t.first_name, '') || ' ' || coalesce(t.last_name, ''))
           ilike v_pattern escape '\'
      or trim(coalesce(st.first_name, '') || ' ' || coalesce(st.last_name, ''))
           ilike v_pattern escape '\'
    )
  -- days alone is not a stable sort: ~1/3 of ended pairs measure exactly 0, so
  -- paging on a ties-only ORDER BY would duplicate and drop rows between pages.
  -- The trailing id columns make the order total.
  order by
    c.days desc,
    t.first_name asc,
    t.last_name asc,
    st.first_name asc,
    st.last_name asc,
    c.tutor_id asc,
    c.student_id asc
  limit p_limit
  offset p_offset;
end;
$$;

grant execute on function get_pairing_lengths(text, text, integer, integer) to authenticated;
