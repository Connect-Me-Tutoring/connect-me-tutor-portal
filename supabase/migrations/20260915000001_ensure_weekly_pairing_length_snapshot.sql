-- Daily schedule, weekly write.
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
  from public.get_pairing_length_stats() s
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
