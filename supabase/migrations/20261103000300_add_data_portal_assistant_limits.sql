-- Data Portal assistant: a hard ceiling on how many questions it can be asked.
--
-- Every question an admin asks the Data Portal assistant is a paid call to
-- Anthropic's Claude API. The route already bounds what one question can cost
-- (how much history goes up, how many tokens come back, how many tool steps
-- it may take). This bounds how many questions there can be, so the bill has
-- a ceiling whatever goes wrong: a stuck retry loop, a leaked admin session, a
-- script hammering the endpoint.
--
-- The counts live here rather than in server memory because Vercel runs many
-- instances and each would keep a count of its own. One row per question that
-- was let through, holding who asked and when. Nothing about the question
-- itself is stored.
--
-- public.data_portal_assistant_claim() is the only way in. It decides who is
-- asking from auth.uid() on the caller's own session, refuses anyone whose
-- active profile is not an Active Admin (the same gate as
-- data_portal_overview), and then either records the question or says which
-- limit it hit. To change a limit, change the numbers in the function.

begin;

create schema if not exists analysis;

create table if not exists analysis.assistant_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  requested_at timestamptz not null default now()
);

create index if not exists assistant_requests_user_time_idx
  on analysis.assistant_requests (user_id, requested_at);
create index if not exists assistant_requests_time_idx
  on analysis.assistant_requests (requested_at);

-- The analysis schema is not exposed through the API, and nothing but the
-- function below holds a privilege on this table either way.
alter table analysis.assistant_requests enable row level security;
revoke all on analysis.assistant_requests from public, anon, authenticated;

create or replace function public.data_portal_assistant_claim()
returns jsonb
language plpgsql
security definer
set search_path = public, analysis, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_limit record;
  v_count bigint;
  v_oldest timestamptz;
begin
  if v_uid is null or not exists (
    select 1
    from public.user_settings us
    join public."Profiles" p
      on p.id = us.last_active_profile_id
     and p.user_id = us.user_id
    where us.user_id = v_uid
      and p.role = 'Admin'
      and p.status = 'Active'
  ) then
    raise exception 'Admin access required';
  end if;

  -- One claim at a time, so two questions arriving together cannot both take
  -- the last free slot. They are rare enough that this never queues.
  perform pg_advisory_xact_lock(hashtextextended('data_portal_assistant_claim', 0));

  -- Nothing older than the longest window counts towards anything.
  delete from analysis.assistant_requests
  where requested_at < v_now - interval '30 days';

  -- Checked in order, so the first one hit is the one reported. A question
  -- costs at most about 50 cents at the route's per-question caps, and usually
  -- a few cents, which puts the worst case near $50 a day and $250 a month
  -- across every admin.
  for v_limit in
    select *
    from (values
      ('admin_burst',    true,  interval '5 minutes', 15),
      ('admin_daily',    true,  interval '24 hours',  50),
      ('global_daily',   false, interval '24 hours',  100),
      ('global_monthly', false, interval '30 days',   500)
    ) as limits(name, per_admin, span, max_requests)
  loop
    select count(*), min(r.requested_at)
    into v_count, v_oldest
    from analysis.assistant_requests r
    where r.requested_at > v_now - v_limit.span
      and (not v_limit.per_admin or r.user_id = v_uid);

    if v_count >= v_limit.max_requests then
      return jsonb_build_object(
        'allowed', false,
        'limit', v_limit.name,
        -- The oldest question in the window is the next to age out of it.
        'retryAfterSeconds',
          greatest(1, ceil(extract(epoch from (v_oldest + v_limit.span - v_now))))::int
      );
    end if;
  end loop;

  insert into analysis.assistant_requests (user_id, requested_at) values (v_uid, v_now);

  return jsonb_build_object('allowed', true, 'limit', null, 'retryAfterSeconds', 0);
end;
$$;

-- Signed-in users only; the function itself then requires the Admin profile.
revoke all on function public.data_portal_assistant_claim() from public;
revoke all on function public.data_portal_assistant_claim() from anon;
grant execute on function public.data_portal_assistant_claim() to authenticated;

commit;
