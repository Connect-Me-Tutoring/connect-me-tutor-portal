-- ===========================================================================
-- Pairing length: "active" now means a completed session in the last 6 weeks
-- ===========================================================================
-- Before: every row in "Pairings" counted as active (~1,400), including pairs that
-- stopped meeting months ago and pairs that never met at all. Hard-delete on unpair
-- is the only thing that ever moved a pair out of "active".
--
-- After:
--   active = a "Pairings" row exists AND the pair has a Complete session dated in
--            the last 42 days (up to now). Tenure is still measured from
--            Pairings.created_at, unchanged.
--   ended  = every other tutor/student pair with at least one Complete session.
--            That is the old "ended" set (no Pairings row) PLUS still-paired pairs
--            that have gone quiet for 6+ weeks. Their span is still
--            last Complete session - first Complete session.
--   (none) = still-paired pairs with zero Complete sessions ever (never met). They
--            have no span to measure, so they are in no population, same as before
--            for unpaired never-met pairs.
--
-- Only Complete counts as "had a session". Cancelled never happened; Active is a
-- scheduled future (or never-closed) occurrence.
--
-- The window lives in one place, private.recently_active_pairs(), so the stats and
-- the detail table can't drift apart.
--
-- History caveat: pairing_length_snapshots rows captured before this migration
-- used the old definition. They are left as-is (not backfillable). Expect a step
-- down in the "active" series at the week this ships.
--
-- Signatures of the public functions are unchanged, so create or replace keeps
-- their grants; they are restated anyway to keep this file self-contained.

-- ---------------------------------------------------------------------------
-- The one definition of "recent"
-- ---------------------------------------------------------------------------
create or replace function private.recently_active_pairs()
returns table (tutor_id uuid, student_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select distinct s.tutor_id, s.student_id
  from "Sessions" s
  where s.status = 'Complete'
    and s.tutor_id is not null
    and s.student_id is not null
    and s.date >= now() - interval '42 days'
    and s.date <= now();
$$;

revoke execute on function private.recently_active_pairs() from public, anon, authenticated;
grant execute on function private.recently_active_pairs() to service_role;

-- ---------------------------------------------------------------------------
-- Stats (internal, used by the dashboard wrapper and both snapshot writers)
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
  with recent as (
    select * from private.recently_active_pairs()
  ),
  active_pairs as (
    select p.tutor_id, p.student_id, p.created_at
    from "Pairings" p
    where exists (
      select 1 from recent r
      where r.tutor_id = p.tutor_id and r.student_id = p.student_id
    )
  ),
  active as (
    select (current_date - ap.created_at::date) as days
    from active_pairs ap
    join "Profiles" pt on pt.id = ap.tutor_id
    join "Profiles" ps on ps.id = ap.student_id
    where coalesce(pt.first_name, '') !~* 'test|dummy'
      and coalesce(pt.last_name, '') !~* 'test|dummy'
      and coalesce(ps.first_name, '') !~* 'test|dummy'
      and coalesce(ps.last_name, '') !~* 'test|dummy'
  ),
  ended as (
    select (max(s.date)::date - min(s.date)::date) as days
    from "Sessions" s
    join "Profiles" pt on pt.id = s.tutor_id
    join "Profiles" ps on ps.id = s.student_id
    where s.status = 'Complete'
      and s.tutor_id is not null
      and s.student_id is not null
      and not exists (
        select 1 from active_pairs ap
        where ap.tutor_id = s.tutor_id and ap.student_id = s.student_id
      )
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

-- ---------------------------------------------------------------------------
-- Detail table: body from 20260929000000, active/ended CTEs swapped for the
-- definitions above
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
  with recent as (
    select * from private.recently_active_pairs()
  ),
  active_pairs as (
    select p.tutor_id, p.student_id, p.created_at
    from "Pairings" p
    where exists (
      select 1 from recent r
      where r.tutor_id = p.tutor_id and r.student_id = p.student_id
    )
  ),
  active as (
    select
      ap.tutor_id,
      ap.student_id,
      (current_date - ap.created_at::date) as days,
      'active'::text as status,
      ap.created_at::date as started_on
    from active_pairs ap
    join "Profiles" pt on pt.id = ap.tutor_id
    join "Profiles" ps on ps.id = ap.student_id
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
    join "Profiles" pt on pt.id = s.tutor_id
    join "Profiles" ps on ps.id = s.student_id
    where s.status = 'Complete'
      and s.tutor_id is not null
      and s.student_id is not null
      and not exists (
        select 1 from active_pairs ap
        where ap.tutor_id = s.tutor_id and ap.student_id = s.student_id
      )
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
