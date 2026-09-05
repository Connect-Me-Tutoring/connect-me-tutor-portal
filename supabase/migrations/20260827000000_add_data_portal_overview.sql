-- Data Portal overview: everything the admin side panel shows, in one call.
--
-- public.data_portal_overview(p_date_range) is the only thing the portal
-- calls, with the signed-in user's own session. It refuses unless the
-- caller's ACTIVE profile (user_settings.last_active_profile_id) is an
-- Admin — the same definition the app's authz helpers use — computes four
-- read-only aggregates, writes one audit row, and returns a single jsonb
-- payload. One round trip per panel open.
--
-- The aggregate functions live in the `analysis` schema, are aggregate-only
-- by construction (no name, email, free text beyond subject labels, or
-- per-person row can come back), and are NOT exposed through PostgREST —
-- only the gated wrapper is. Their definitions are identical to the ones in
-- the dataPortalWebsite repo's analysis-backend migration; `create or
-- replace` makes applying both repos' migrations in either order safe.
--
-- Measurement definitions encoded here (review with someone who knows the
-- operational data before treating the numbers as fact):
--   - "a session" means status = 'Complete' — the same predicate the
--     portal's completion stats use.
--   - The funnel is AND-chained (signed up ⊇ matched ⊇ first session), and
--     a student is counted in the window where their 30-day observation
--     period CLOSED, so short ranges stay honest.
--   - Retention is measured at day 90, as at least one completed session in
--     the 45 days ending there; a cohort appears in the window where it
--     REACHED day 90, and younger cohorts are omitted, never shown as zero.
--   - Subject demand joins pairing_requests through both id conventions the
--     app tolerates (profile id and auth user id).
--   - There is deliberately no regional section: the records carry no
--     region or need data, and a proxy would read like the real thing.

begin;

create schema if not exists analysis;

-- ---------------------------------------------------------------------------
-- Aggregate accessors (shared definitions with the analysis-backend migration)
-- ---------------------------------------------------------------------------

create or replace function analysis.sessions_over_time(
  p_start timestamptz,
  p_end timestamptz,
  p_bucket text,
  p_tz text
)
returns table (period_start date, session_count bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_bucket not in ('week', 'month') then
    raise exception 'Invalid bucket: %. Expected week or month.', p_bucket;
  end if;

  return query
  select
    date_trunc(p_bucket, s.date at time zone p_tz)::date as period_start,
    count(*)::bigint as session_count
  from "Sessions" s
  where s.status = 'Complete'
    and s.date >= p_start
    and s.date < p_end
  group by 1
  order by 1;
end;
$$;

create or replace function analysis.signup_funnel(
  p_start timestamptz,
  p_end timestamptz,
  p_window_days int
)
returns table (signed_up bigint, matched bigint, completed_first_session bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with cohort as (
    select p.id, p.created_at
    from "Profiles" p
    where p.role = 'Student'
      and p.created_at + make_interval(days => p_window_days) >= p_start
      and p.created_at + make_interval(days => p_window_days) < p_end
  ),
  matched as (
    select c.id, c.created_at
    from cohort c
    where exists (
      select 1 from "Pairings" pr
      where pr.student_id = c.id
        and pr.created_at <= c.created_at + make_interval(days => p_window_days)
    )
  ),
  completed as (
    select m.id
    from matched m
    where exists (
      select 1 from "Sessions" s
      where s.student_id = m.id
        and s.status = 'Complete'
        and s.date <= m.created_at + make_interval(days => p_window_days)
    )
  )
  select
    (select count(*) from cohort)    as signed_up,
    (select count(*) from matched)   as matched,
    (select count(*) from completed) as completed_first_session;
$$;

create or replace function analysis.subject_demand(
  p_start timestamptz,
  p_end timestamptz
)
returns table (
  subject text,
  students_requesting bigint,
  tutors_available bigint,
  requests_read bigint,
  tutors_read bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with requests as (
    select distinct pr.id as request_id, p.id as profile_id, p.subjects_of_interest
    from pairing_requests pr
    join "Profiles" p
      on p.id = pr.user_id or p.user_id = pr.user_id
    where pr.type = 'student'
      and pr.created_at >= p_start
      and pr.created_at < p_end
  ),
  demand as (
    select trim(subject_entry) as subject, count(distinct r.profile_id) as students_requesting
    from requests r
    cross join lateral unnest(coalesce(r.subjects_of_interest, '{}')) as subject_entry
    where trim(coalesce(subject_entry, '')) <> ''
    group by 1
  ),
  tutors as (
    select p.id, p.subjects_of_interest
    from "Profiles" p
    where p.role = 'Tutor' and p.status = 'Active'
  ),
  supply as (
    select trim(subject_entry) as subject, count(distinct t.id) as tutors_available
    from tutors t
    cross join lateral unnest(coalesce(t.subjects_of_interest, '{}')) as subject_entry
    where trim(coalesce(subject_entry, '')) <> ''
    group by 1
  )
  select
    coalesce(d.subject, s.subject) as subject,
    coalesce(d.students_requesting, 0)::bigint as students_requesting,
    coalesce(s.tutors_available, 0)::bigint as tutors_available,
    (select count(distinct request_id) from requests)::bigint as requests_read,
    (select count(*) from tutors)::bigint as tutors_read
  from demand d
  full outer join supply s on s.subject = d.subject
  order by students_requesting desc, subject
  limit 100;
$$;

create or replace function analysis.tutor_retention(
  p_horizon_days int,
  p_activity_days int,
  p_tz text
)
returns table (cohort_month date, cohort_size bigint, retained bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with tutors as (
    select
      p.id,
      p.created_at,
      date_trunc('month', p.created_at at time zone p_tz)::date as cohort_month
    from "Profiles" p
    where p.role = 'Tutor'
  )
  select
    t.cohort_month,
    count(*)::bigint as cohort_size,
    count(*) filter (
      where exists (
        select 1 from "Sessions" s
        where s.tutor_id = t.id
          and s.status = 'Complete'
          and s.date >= t.created_at + make_interval(days => p_horizon_days - p_activity_days)
          and s.date <= t.created_at + make_interval(days => p_horizon_days)
      )
    )::bigint as retained
  from tutors t
  group by 1
  order by 1;
$$;

-- Not callable by anyone but their owner; the wrapper below reaches them by
-- ownership, and PostgREST never sees this schema.
revoke all on function analysis.sessions_over_time(timestamptz, timestamptz, text, text) from public;
revoke all on function analysis.signup_funnel(timestamptz, timestamptz, int) from public;
revoke all on function analysis.subject_demand(timestamptz, timestamptz) from public;
revoke all on function analysis.tutor_retention(int, int, text) from public;

-- ---------------------------------------------------------------------------
-- Audit storage (shared definition with the analysis-backend migration)
-- ---------------------------------------------------------------------------

create table if not exists analysis.audit_log (
  id bigint generated always as identity primary key,
  recorded_at timestamptz not null default now(),
  event jsonb not null,
  constraint audit_event_is_object check (jsonb_typeof(event) = 'object')
);

revoke all on analysis.audit_log from public;

-- ---------------------------------------------------------------------------
-- The wrapper the portal calls
-- ---------------------------------------------------------------------------

create or replace function public.data_portal_overview(
  p_date_range text,
  p_tz text default 'UTC'
)
returns jsonb
language plpgsql
security definer
set search_path = public, analysis, pg_temp
as $$
declare
  v_today date;
  v_range_start date;
  v_bucket text;
  v_first_period date;
  v_current_period date;
  v_start_ts timestamptz;
  v_window_ts timestamptz;
  v_sessions jsonb;
  v_funnel record;
  v_demand jsonb;
  v_demand_reads jsonb;
  v_retention jsonb;
  v_retention_rows bigint;
begin
  -- The gate. auth.uid() comes from the caller's verified JWT, so this
  -- decides for the calling user only, from the same place the app's own
  -- requireAdmin() looks. A Deleted profile is never an admin here.
  if not exists (
    select 1
    from public.user_settings us
    join public."Profiles" p on p.id = us.last_active_profile_id
    where us.user_id = auth.uid()
      and p.role = 'Admin'
      and coalesce(p.status, 'Active') <> 'Deleted'
  ) then
    raise exception 'Admin access required';
  end if;

  if p_date_range not in ('last-30-days', 'last-90-days', 'this-year') then
    raise exception 'Invalid date range: %', p_date_range;
  end if;

  v_today := (now() at time zone p_tz)::date;

  if p_date_range = 'last-30-days' then
    v_range_start := v_today - 30;
    v_bucket := 'week';
  elsif p_date_range = 'last-90-days' then
    v_range_start := v_today - 90;
    v_bucket := 'week';
  else
    v_range_start := make_date(extract(year from v_today)::int, 1, 1);
    v_bucket := 'month';
  end if;

  -- Sessions open at the start of the period containing the range start, so
  -- the first bucket is a whole period rather than a clipped one that would
  -- read as a dip. Instants are local midnights in p_tz.
  v_first_period := date_trunc(v_bucket, v_range_start::timestamp)::date;
  v_current_period := date_trunc(v_bucket, v_today::timestamp)::date;
  v_start_ts := (v_first_period::timestamp) at time zone p_tz;
  v_window_ts := (v_range_start::timestamp) at time zone p_tz;

  -- Session volume, zero-filled: a silent week is a fact, not a gap. The
  -- period containing today is flagged partial and rendered as such.
  select coalesce(jsonb_agg(jsonb_build_object(
           'label', case when v_bucket = 'week'
                         then to_char(periods.period, 'Mon FMDD')
                         else to_char(periods.period, 'Mon') end,
           'value', coalesce(counted.session_count, 0),
           'partial', (periods.period + ('1 ' || v_bucket)::interval)::date > v_today
         ) order by periods.period), '[]'::jsonb)
  into v_sessions
  from generate_series(
         v_first_period::timestamp, v_current_period::timestamp, ('1 ' || v_bucket)::interval
       ) as periods(period)
  left join analysis.sessions_over_time(v_start_ts, now(), v_bucket, p_tz) as counted
    on counted.period_start = periods.period::date;

  select * into v_funnel from analysis.signup_funnel(v_window_ts, now(), 30);

  select coalesce(jsonb_agg(jsonb_build_object(
           'subject', d.subject,
           'studentsRequesting', d.students_requesting,
           'tutorsAvailable', d.tutors_available
         ) order by d.students_requesting desc, d.subject), '[]'::jsonb),
         jsonb_build_object(
           'requestsRead', coalesce(max(d.requests_read), 0),
           'tutorsRead', coalesce(max(d.tutors_read), 0)
         )
  into v_demand, v_demand_reads
  from analysis.subject_demand(v_window_ts, now()) as d;

  -- A cohort belongs to the window in which its youngest member reached day
  -- 90; cohorts that have not reached it are omitted, never shown as zero.
  select coalesce(jsonb_agg(jsonb_build_object(
           'label', to_char(r.cohort_month, 'Mon YYYY'),
           'cohortSize', r.cohort_size,
           'retained', r.retained
         ) order by r.cohort_month), '[]'::jsonb),
         coalesce(sum(r.cohort_size), 0)
  into v_retention, v_retention_rows
  from analysis.tutor_retention(90, 45, p_tz) as r
  where (r.cohort_month + interval '1 month' - interval '1 day')::date + 90
        between v_range_start and v_today;

  -- One audit row per overview read: who, which window, when. Never a value
  -- from the results — the log must not become a copy of the data.
  insert into analysis.audit_log (event) values (jsonb_build_object(
    'event', 'data_portal_overview',
    'userId', auth.uid(),
    'dateRange', p_date_range,
    'timezone', p_tz
  ));

  return jsonb_build_object(
    'dateRange', p_date_range,
    'generatedAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'sessionsOverTime', jsonb_build_object(
      'bucket', v_bucket,
      'points', v_sessions
    ),
    'signupFunnel', jsonb_build_object(
      'windowDays', 30,
      'signedUp', v_funnel.signed_up,
      'matched', v_funnel.matched,
      'completedFirstSession', v_funnel.completed_first_session
    ),
    'subjectDemand', jsonb_build_object(
      'rows', v_demand,
      'reads', v_demand_reads
    ),
    'tutorRetention', jsonb_build_object(
      'horizonDays', 90,
      'activityDays', 45,
      'cohorts', v_retention,
      'tutorsRead', v_retention_rows
    )
  );
end;
$$;

-- Signed-in users only; the function itself then requires the Admin profile.
revoke all on function public.data_portal_overview(text, text) from public;
revoke all on function public.data_portal_overview(text, text) from anon;
grant execute on function public.data_portal_overview(text, text) to authenticated;

commit;
