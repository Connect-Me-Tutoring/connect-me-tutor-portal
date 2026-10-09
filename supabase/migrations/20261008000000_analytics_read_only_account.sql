-- Read-only analytics account for future data tools
-- SELECT only --> can't change any data/tables

create table if not exists private.analytics_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

revoke all on private.analytics_accounts from anon, authenticated;
alter table private.analytics_accounts enable row level security;

create or replace function private.is_analytics()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from private.analytics_accounts a where a.user_id = auth.uid());
$$;

insert into private.analytics_accounts (user_id, note)
values ('e22ac292-d4ca-41e5-86a8-9ce7963d8798', 'SEF refresh script + connectme-insights + data tooling')
on conflict (user_id) do nothing;

do $$
declare t text;
begin
  foreach t in array array[
    'Profiles', 'Enrollments', 'Sessions', 'User_Availabilities',
    'Pairings', 'Events', 'weekly_meeting_schedules',
    'pairing_requests', 'pairing_matches', 'pairing_logs',
    'Requests', 'Forms', 'zoom_participant_events'
  ]
  loop
    execute format('drop policy if exists "analytics_select" on public.%I', t);
    execute format(
      'create policy "analytics_select" on public.%I for select to authenticated using ((select private.is_analytics()))', t
    );
  end loop;
end $$;
