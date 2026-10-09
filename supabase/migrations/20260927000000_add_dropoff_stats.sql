-- Monthly tutor/student drop-off for the analytics dashboard (DropoffChart).
--
-- A person drops off when they go 6 weeks (42 days) without a completed
-- session. The drop is counted in the month of their last completed session
-- before the gap. If they have another completed session after the gap, they
-- "returned" (it was a break); otherwise they permanently left, as of now.
--
-- One row per role per month that had at least one completed session:
--   active      people with >= 1 completed session that month
--   dropped     drop-offs counted in that month, INCLUDING people who returned
--   returned    the subset of dropped who later had another completed session
--   is_complete false until 6 weeks have passed since the month ended; dropped
--               and returned are NULL until then, because a 6-week gap can't
--               be confirmed yet
--
-- Months are UTC calendar months, same as get_period_session_completion_stats.
-- Test/dummy accounts are excluded with the same name rule as
-- get_pairing_length_stats. Sessions whose tutor/student profile was deleted
-- (NULL id) can't be attributed to anyone and are left out.
--
-- p_as_of exists so tests can pin "now"; the app never passes it.

create or replace function public.get_dropoff_stats(p_as_of timestamptz default null)
returns table (
  role        text,
  month       date,
  active      bigint,
  dropped     bigint,
  returned    bigint,
  is_complete boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_now timestamptz := coalesce(p_as_of, now());
begin
  if not (select private.is_admin()) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
  with completed as (
    select 'Tutor'::text as role, s.tutor_id as person_id, s.date
    from "Sessions" s
    join "Profiles" p on p.id = s.tutor_id
    where s.status = 'Complete'
      and s.date <= v_now
      and coalesce(p.first_name, '') !~* 'test|dummy'
      and coalesce(p.last_name, '') !~* 'test|dummy'
    union all
    select 'Student'::text, s.student_id, s.date
    from "Sessions" s
    join "Profiles" p on p.id = s.student_id
    where s.status = 'Complete'
      and s.date <= v_now
      and coalesce(p.first_name, '') !~* 'test|dummy'
      and coalesce(p.last_name, '') !~* 'test|dummy'
  ),
  ordered as (
    select
      c.role,
      c.person_id,
      c.date,
      date_trunc('month', c.date)::date as month,
      lead(c.date) over (partition by c.role, c.person_id order by c.date) as next_date
    from completed c
  ),
  -- A person counts at most once per month: judge the gap after their LAST
  -- completed session in that month.
  last_in_month as (
    select distinct on (o.role, o.person_id, o.month)
      o.role, o.month, o.date, o.next_date
    from ordered o
    order by o.role, o.person_id, o.month, o.date desc
  ),
  drops as (
    select
      l.role,
      l.month,
      count(*) filter (where coalesce(l.next_date, v_now) - l.date >= interval '42 days') as dropped,
      count(*) filter (where l.next_date is not null
                         and l.next_date - l.date >= interval '42 days') as returned
    from last_in_month l
    group by l.role, l.month
  ),
  months as (
    select o.role, o.month, count(distinct o.person_id) as active
    from ordered o
    group by o.role, o.month
  )
  select
    m.role,
    m.month,
    m.active,
    case when c.complete then coalesce(d.dropped, 0) end,
    case when c.complete then coalesce(d.returned, 0) end,
    c.complete
  from months m
  left join drops d on d.role = m.role and d.month = m.month
  cross join lateral (
    select (m.month + interval '1 month' + interval '42 days') <= v_now as complete
  ) c
  order by m.role, m.month;
end;
$$;

revoke execute on function public.get_dropoff_stats(timestamptz) from public, anon;
grant execute on function public.get_dropoff_stats(timestamptz) to authenticated;
