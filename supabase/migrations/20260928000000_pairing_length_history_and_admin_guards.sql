-- ===========================================================================
-- Pairing length: weekly history + admin-only access
-- ===========================================================================
-- Replaces the three migrations originally on this branch (20260913000000,
-- 20260915000000, 20260915000001). Those were dated before
-- 20260925000000_lock_down_definer_rpcs.sql, so `supabase db push` would refuse
-- them, and their get_pairing_lengths redefinition duplicated what dev's
-- 20260903000000 already has. Everything below is idempotent, so it is safe on
-- the remote DB, where these objects were already applied by hand.
--
-- Access model:
--   * get_pairing_lengths / get_pairing_length_history / get_pairing_length_stats
--     are the only paths the dashboard uses. They are SECURITY DEFINER (bypass
--     RLS) and granted to authenticated, so each one checks private.is_admin().
--     Without that, any tutor or student could page through every
--     tutor/student name pair from the browser console.
--   * The cron runs as service_role, where auth.uid() is null and is_admin() is
--     false. So the stats query itself lives in private.pairing_length_stats(),
--     which the snapshot functions call directly and nobody else can execute.
--     Guarding the public wrapper therefore does not break the cron.

-- ---------------------------------------------------------------------------
-- Stats: unguarded internal query + admin-guarded public wrapper
-- ---------------------------------------------------------------------------
create or replace function private.pairing_length_stats()
returns table (
  population text,
  pairs bigint,
  avg_days numeric,
  median_days numeric,
  max_days integer,
  single_session_pairs bigint
)
language sql
stable
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

revoke execute on function private.pairing_length_stats() from public, anon, authenticated;
grant execute on function private.pairing_length_stats() to service_role;

create or replace function public.get_pairing_length_stats()
returns table (
  population text,
  pairs bigint,
  avg_days numeric,
  median_days numeric,
  max_days integer,
  single_session_pairs bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query select * from private.pairing_length_stats();
end;
$$;

revoke execute on function public.get_pairing_length_stats() from public, anon;
grant execute on function public.get_pairing_length_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- Detail table: same body as dev's 20260903000000, plus the admin guard
-- ---------------------------------------------------------------------------
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
  if not (select private.is_admin()) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

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
      replace(replace(replace(v_search, '\', '\'), '%', '\%'), '_', '\_') || '%';
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

revoke execute on function public.get_pairing_lengths(text, text, integer, integer)
  from public, anon;
grant execute on function public.get_pairing_lengths(text, text, integer, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Snapshot table
-- ---------------------------------------------------------------------------
-- Why a snapshot table instead of deriving history on the fly: deletePairingServer
-- hard-deletes the Pairings row on unpair, so "average active tenure as of some past
-- date" is not reconstructable. The pairs that ended before today are gone, and the
-- ones that survive are exactly the long-lived ones, so any backfill would be biased
-- upward. The series starts empty and fills one point per capture.
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

-- ---------------------------------------------------------------------------
-- Manual capture (service_role only). Overwrites the given day's point, so a
-- deliberate re-capture replaces bad data. Its row is keyed to the day it is
-- run; the history query below still shows the week-start point for that week.
-- ---------------------------------------------------------------------------
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
  from private.pairing_length_stats() s
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

revoke execute on function public.capture_pairing_length_snapshot(date)
  from public, anon, authenticated;
grant execute on function public.capture_pairing_length_snapshot(date) to service_role;

-- ---------------------------------------------------------------------------
-- Cron: daily schedule, weekly write.
--
-- Vercel does not retry a failed cron, so a Monday-only job means one bad morning
-- costs a week of history permanently. This runs every day instead and writes only
-- if the current week has no point yet, so Tuesday silently covers for a failed
-- Monday and the gap never appears. Seven consecutive failures are still a real
-- gap, which is what the gap-fill rendering is for.
--
-- ON CONFLICT DO NOTHING, not DO UPDATE: active tenure climbs one day per day, so
-- overwriting the week's value every morning would store Sunday's number under
-- Monday's label and drift the series by up to six days. First run of the week wins.
--
-- capture_pairing_length_snapshot(p_captured_on) is unchanged and still overwrites,
-- which is the right behaviour for a deliberate manual re-capture.

create or replace function public.ensure_weekly_pairing_length_snapshot()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_start date := date_trunc('week', current_date)::date;
  v_rows integer;
begin
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
    v_week_start,
    s.population,
    s.pairs,
    s.avg_days,
    s.median_days,
    s.max_days,
    s.single_session_pairs
  from private.pairing_length_stats() s
  on conflict (captured_on, population) do nothing;

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

comment on function public.ensure_weekly_pairing_length_snapshot() is
  'Writes this week''s pairing-length point if it does not exist yet. Returns rows written: 0 means the week was already recorded. Safe to call daily.';

revoke execute on function public.ensure_weekly_pairing_length_snapshot()
  from public, anon, authenticated;
grant execute on function public.ensure_weekly_pairing_length_snapshot() to service_role;

-- ---------------------------------------------------------------------------
-- History: one point per week, gap-filled, admin only
-- ---------------------------------------------------------------------------
-- Returns every week from the first snapshot to the current week, with a NULL row
-- for any week with no capture; the chart draws those as breaks in the line.
--
-- If a week has more than one capture (the cron's week-start row plus a manual
-- capture_pairing_length_snapshot() later in the week), the EARLIEST one wins.
-- That matches ensure_weekly_pairing_length_snapshot ("first run of the week
-- wins") and keeps every point measured at the start of its week. Letting a
-- Thursday manual run win would bump active tenure by ~3 days for that one point.
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
  if not (select private.is_admin()) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if p_population not in ('active', 'ended', 'all') then
    raise exception 'Invalid population: %. Expected active, ended, or all.', p_population;
  end if;

  return query
  with weekly as (
    -- distinct on keeps the earliest capture within each week
    select distinct on (date_trunc('week', s.captured_on)::date)
      date_trunc('week', s.captured_on)::date as week_start,
      s.pairs as w_pairs,
      s.avg_days as w_avg_days,
      s.median_days as w_median_days,
      s.single_session_pairs as w_single_session_pairs
    from public.pairing_length_snapshots s
    where s.population = p_population
    order by date_trunc('week', s.captured_on)::date, s.captured_on asc
  ),
  bounds as (
    select min(w.week_start) as first_week from weekly w
  ),
  all_weeks as (
    select generate_series(
      b.first_week,
      date_trunc('week', current_date)::date,
      interval '7 days'
    )::date as week_start
    from bounds b
    where b.first_week is not null
  )
  select
    aw.week_start,
    wk.w_pairs,
    wk.w_avg_days,
    wk.w_median_days,
    wk.w_single_session_pairs
  from all_weeks aw
  left join weekly wk on wk.week_start = aw.week_start
  order by aw.week_start asc;
end;
$$;

revoke execute on function public.get_pairing_length_history(text) from public, anon;
grant execute on function public.get_pairing_length_history(text) to authenticated;