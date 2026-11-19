-- ===========================================================================
-- Pairing length: null guards, and a history function that never returns NULLs
-- ===========================================================================
-- 1. p_population null guard (both RPCs). `NULL not in (...)` is NULL, not true,
--    so an explicit null slipped past the whitelist and silently matched nothing.
--    The parameter default only applies when the argument is omitted.
--
-- 2. get_pairing_lengths: restore the backslash escape. 20260928000000 wrote
--    replace(v_search, '\', '\'), a no-op, so a backslash in the search term acted
--    as the LIKE escape character instead of matching itself.
--
-- 3. get_pairing_length_history no longer gap-fills. The generated types mark every
--    RETURNS TABLE column non-null (Postgres exposes no nullability for function
--    outputs), so the NULL rows the gap-fill produced made those types lie. Now the
--    function returns only weeks that have a snapshot with pairings in it, every
--    column is non-null, and the generated types are accurate. Missing weeks are
--    filled in by the chart, which is the only consumer that cares about them.
--
-- Signatures are unchanged, so create or replace keeps the existing grants.

-- ---------------------------------------------------------------------------
-- Detail table: body unchanged from 20260928000000 apart from fixes 1 and 2
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

  if p_population is null or p_population not in ('active', 'ended', 'all') then
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

revoke execute on function public.get_pairing_lengths(text, text, integer, integer)
  from public, anon;
grant execute on function public.get_pairing_lengths(text, text, integer, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- History: one point per captured week, admin only, no NULL columns
-- ---------------------------------------------------------------------------
-- Earliest capture in a week still wins (see 20260928000000). The avg/median
-- filter runs after that pick, so a zero-pairing week start is dropped rather
-- than replaced by a later capture from the same week.
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

  if p_population is null or p_population not in ('active', 'ended', 'all') then
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
  )
  -- avg/median are NULL only when the capture found zero pairings.
  select
    w.week_start,
    w.w_pairs,
    w.w_avg_days,
    w.w_median_days,
    w.w_single_session_pairs
  from weekly w
  where w.w_avg_days is not null
    and w.w_median_days is not null
  order by w.week_start asc;
end;
$$;

revoke execute on function public.get_pairing_length_history(text) from public, anon;
grant execute on function public.get_pairing_length_history(text) to authenticated;
