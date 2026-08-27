-- The completion-stats RPCs were granted to `authenticated` (any signed-in
-- user), but they're admin-only analytics. Gate them on an actual Admin
-- profile instead of relying on the client to only call them from the
-- admin dashboard.

create or replace function get_session_completion_stats()
returns table (
  total_completed bigint,
  total_resolved bigint,
  pct_completed numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public."Profiles" p
    where p.user_id = auth.uid() and p.role = 'Admin'
  ) then
    raise exception 'Admin access required';
  end if;

  return query
  select
    count(*) filter (where status = 'Complete') as total_completed,
    count(*) filter (where status in ('Complete', 'Cancelled')) as total_resolved,
    round(
      100.0 * count(*) filter (where status = 'Complete')
      / nullif(count(*) filter (where status in ('Complete', 'Cancelled')), 0),
      1
    ) as pct_completed
  from "Sessions";
end;
$$;

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
  if not exists (
    select 1 from public."Profiles" p
    where p.user_id = auth.uid() and p.role = 'Admin'
  ) then
    raise exception 'Admin access required';
  end if;

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

-- get_monthly_session_completion_stats delegates to
-- get_period_session_completion_stats, which now enforces the admin check
-- itself (auth.uid() reflects the calling user regardless of the definer
-- chain), so it needs no changes.
