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
      s.tutor_id,
      s.student_id,
      -- If a pairing has any completed session, rank completed sessions first
      -- so the first successful meeting represents the pairing. Pairings with
      -- zero completions fall back to their earliest cancelled session.
      row_number() over (
        partition by s.tutor_id, s.student_id
        order by
          case when s.status = 'Complete' then 0 else 1 end asc,
          s.date asc,
          s.id asc
      ) as seq
    from "Sessions" s
    where s.status in ('Complete', 'Cancelled')
  )
  select
    date_trunc(p_granularity, r.date)::date as period,
    count(*) filter (where r.status = 'Complete') as total_completed,
    count(*) as total_resolved,
    round(100.0 * count(*) filter (where r.status = 'Complete') / nullif(count(*), 0), 1) as pct_completed
  from ranked r
  where r.date < date_trunc(p_granularity, now()) -- exclude the current, still-incomplete period
    -- Orphaned sessions (profile deleted, ids SET NULL) can't be attributed
    -- to a pair, so they have no "first" to rank.
    and (
      not p_first_sessions_only
      or (r.seq = 1 and r.tutor_id is not null and r.student_id is not null)
    )
  group by date_trunc(p_granularity, r.date)
  order by 1;
end;
$$;

grant execute on function get_period_session_completion_stats(text, boolean) to authenticated;
