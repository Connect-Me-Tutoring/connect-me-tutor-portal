-- Pairing length, round 2:
--   1. name search + pagination on the detail table
--   2. a weekly snapshot series so average/median length can be watched over time
--
-- Why a snapshot table instead of deriving history on the fly: deletePairingServer
-- hard-deletes the Pairings row on unpair, so "average active tenure as of some past
-- date" is not reconstructable. The pairs that ended before today are gone, and the
-- ones that survive are exactly the long-lived ones, so any backfill would be biased
-- upward. The series starts empty and fills one point per capture. Nothing here
-- invents history.

create table if not exists public.pairing_length_snapshots (
  captured_on date not null default current_date,
  population text not null,
  pairs bigint not null default 0,
  avg_days numeric,
  median_days numeric,
  max_days integer,
  single_session_pairs bigint not null default 0,
  created_at timestamptz not null default now(),
  constraint pairing_length_snapshots_pkey primary key (captured_on, population),
  constraint pairing_length_snapshots_population_check
    check (population in ('active', 'ended', 'all'))
);

comment on table public.pairing_length_snapshots is
  'One row per (capture date, population). Written only by capture_pairing_length_snapshot(), read only by get_pairing_length_history(). Not backfillable -- see migration header.';

-- No policies on purpose: every access path is a security definer function below,
-- which bypasses RLS. RLS on + zero policies means direct PostgREST reads return
-- nothing rather than leaking the table.
alter table public.pairing_length_snapshots enable row level security;

-- Idempotent by (captured_on, population): a retry, a manual run, or a duplicate
-- cron fire on the same day overwrites that day's point instead of duplicating it.
create or replace function public.capture_pairing_length_snapshot(
  p_captured_on date default current_date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  if p_captured_on is null then
    raise exception 'p_captured_on cannot be null';
  end if;

  insert into public.pairing_length_snapshots (
    captured_on,
    population,
    pairs,
    avg_days,
    median_days,
    max_days,
    single_session_pairs
  )
  select
    p_captured_on,
    s.population,
    s.pairs,
    s.avg_days,
    s.median_days,
    s.max_days,
    s.single_session_pairs
  from public.get_pairing_length_stats() s
  on conflict (captured_on, population) do update
    set pairs = excluded.pairs,
        avg_days = excluded.avg_days,
        median_days = excluded.median_days,
        max_days = excluded.max_days,
        single_session_pairs = excluded.single_session_pairs,
        created_at = now();

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

create or replace function public.get_pairing_length_history(
  p_population text default 'all'
)
returns table (
  captured_on date,
  pairs bigint,
  avg_days numeric,
  median_days numeric,
  single_session_pairs bigint
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
  select
    s.captured_on,
    s.pairs,
    s.avg_days,
    s.median_days,
    s.single_session_pairs
  from public.pairing_length_snapshots s
  where s.population = p_population
  order by s.captured_on asc;
end;
$$;

-- Adding parameters to the existing function would create an overload, and a call
-- passing only (p_population, p_limit) would then match both signatures and fail as
-- ambiguous. Drop the old one first.
drop function if exists public.get_pairing_lengths(text, integer);

create or replace function public.get_pairing_lengths(
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

-- The detail rows carry tutor and student names, so keep them off anon. The capture
-- function writes, so it is service_role only (the cron route uses the admin client).
revoke execute on function public.get_pairing_lengths(text, text, integer, integer)
  from public, anon;
grant execute on function public.get_pairing_lengths(text, text, integer, integer)
  to authenticated;

revoke execute on function public.get_pairing_length_history(text) from public, anon;
grant execute on function public.get_pairing_length_history(text) to authenticated;

revoke execute on function public.capture_pairing_length_snapshot(date)
  from public, anon, authenticated;
grant execute on function public.capture_pairing_length_snapshot(date) to service_role;
