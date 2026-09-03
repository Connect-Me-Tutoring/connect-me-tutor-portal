-- Metric: Total sessions completed + period breakdown (month or week)
-- Owner: Arnav
-- Denominator = Complete + Cancelled only (excludes Active/not-yet-happened sessions).

create or replace function get_session_completion_stats()
returns table (
  total_completed bigint,
  total_resolved bigint,
  pct_completed numeric
)
language sql
security definer
set search_path = public
as $$
  select
    count(*) filter (where status = 'Complete') as total_completed,
    count(*) filter (where status in ('Complete', 'Cancelled')) as total_resolved,
    round(
      100.0 * count(*) filter (where status = 'Complete')
      / nullif(count(*) filter (where status in ('Complete', 'Cancelled')), 0),
      1
    ) as pct_completed
  from "Sessions";
$$;

grant execute on function get_session_completion_stats() to authenticated;

-- Period breakdown. p_granularity is passed to date_trunc, so it is
-- whitelisted below rather than accepted freely -- do not loosen this check.
create or replace function get_period_session_completion_stats(
  p_granularity text default 'month'
)
returns table (
  period date,
  total_completed bigint,
  total_resolved bigint,
  pct_completed numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_granularity not in ('month', 'week') then
    raise exception 'Invalid granularity: %. Expected month or week.', p_granularity;
  end if;

  return query
  select
    date_trunc(p_granularity, s.date)::date as period,
    count(*) filter (where s.status = 'Complete') as total_completed,
    count(*) as total_resolved,
    round(100.0 * count(*) filter (where s.status = 'Complete') / nullif(count(*), 0), 1) as pct_completed
  from "Sessions" s
  where s.status in ('Complete', 'Cancelled')
    and s.date < date_trunc(p_granularity, now()) -- exclude the current, still-incomplete period
  group by date_trunc(p_granularity, s.date)
  order by 1;
end;
$$;

grant execute on function get_period_session_completion_stats(text) to authenticated;

-- Kept so anything already calling the monthly function does not break.
create or replace function get_monthly_session_completion_stats()
returns table (
  month date,
  total_completed bigint,
  total_resolved bigint,
  pct_completed numeric
)
language sql
security definer
set search_path = public
as $$
  select period, total_completed, total_resolved, pct_completed
  from get_period_session_completion_stats('month');
$$;

grant execute on function get_monthly_session_completion_stats() to authenticated;
