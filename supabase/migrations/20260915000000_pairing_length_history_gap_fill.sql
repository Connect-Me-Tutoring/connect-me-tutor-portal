-- Make missing weeks visible in the pairing-length history.
--
-- Before this, get_pairing_length_history returned only the rows that exist in
-- pairing_length_snapshots. The chart's X axis is categorical, so a week the cron
-- never ran simply vanished: the surrounding points slid together and the line
-- looked continuous. A gap could read as a trend, which is the exact thing this
-- chart is supposed to detect.
--
-- Now the function buckets every snapshot to the start of its week, then walks
-- week by week from the first snapshot to the current week, emitting a NULL row
-- for any week with no capture. The consumer draws those as breaks in the line.
--
-- Also collapses multiple captures in one week (cron plus a manual run) down to
-- the latest one, so a week is always exactly one point.

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
  with weekly as (
    -- distinct on keeps the latest capture within each week
    select distinct on (date_trunc('week', s.captured_on)::date)
      date_trunc('week', s.captured_on)::date as week_start,
      s.pairs as w_pairs,
      s.avg_days as w_avg_days,
      s.median_days as w_median_days,
      s.single_session_pairs as w_single_session_pairs
    from public.pairing_length_snapshots s
    where s.population = p_population
    order by date_trunc('week', s.captured_on)::date, s.captured_on desc
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
