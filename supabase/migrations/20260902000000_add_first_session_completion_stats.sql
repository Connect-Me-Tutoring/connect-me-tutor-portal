-- Adds a first-session filter to the completion stats
--
-- "First session" is DERIVED (earliest dated session per enrollment), not read
-- from Sessions.is_first_session. That flag is only ever written on completion
-- paths (enrollment creation and the Session Exit Form)

create or replace function get_period_session_completion_stats(
  p_granularity text default 'month',
  p_first_sessions_only boolean default false
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
  with ranked as (
    select
      s.date,
      s.status,
      s.enrollment_id,
      -- Rank across every status, so a cancelled first session still ranks 1
      -- and stays in the denominator.
      row_number() over (
        partition by s.enrollment_id
        order by s.date asc, s.id asc
      ) as seq
    from "Sessions" s
  )
  select
    date_trunc(p_granularity, r.date)::date as period,
    count(*) filter (where r.status = 'Complete') as total_completed,
    count(*) as total_resolved,
    round(100.0 * count(*) filter (where r.status = 'Complete') / nullif(count(*), 0), 1) as pct_completed
  from ranked r
  where r.status in ('Complete', 'Cancelled')
    and r.date < date_trunc(p_granularity, now()) -- exclude the current, still-incomplete period
    -- Standalone sessions have no enrollment, so they have no "first" to rank.
    and (
      not p_first_sessions_only
      or (r.seq = 1 and r.enrollment_id is not null)
    )
  group by date_trunc(p_granularity, r.date)
  order by 1;
end;
$$;

grant execute on function get_period_session_completion_stats(text, boolean) to authenticated;

-- Recreated so it binds to the new two-argument signature.
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
  from get_period_session_completion_stats('month', false);
$$;

grant execute on function get_monthly_session_completion_stats() to authenticated;
