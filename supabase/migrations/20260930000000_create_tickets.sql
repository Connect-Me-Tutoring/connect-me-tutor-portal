-- Support tickets submitted from the in-app "Report an Issue" form
-- (components/dashboard/ReportIssueDialog.tsx). Serious incidents still go
-- through the external Google Form linked from that dialog.

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  profile_id uuid references public."Profiles" (id) on delete set null,
  category text not null check (
    category in ('technical', 'sessions', 'account', 'pairing', 'hours', 'feedback', 'other')
  ),
  urgency text not null default 'low' check (urgency in ('low', 'medium', 'high')),
  subject text not null check (char_length(subject) between 1 and 200),
  description text not null check (char_length(description) between 1 and 5000),
  page_url text,
  contact_email text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed'))
);

create index if not exists tickets_user_id_idx on public.tickets (user_id);
create index if not exists tickets_status_created_at_idx on public.tickets (status, created_at desc);

revoke all on public.tickets from anon;
alter table public.tickets enable row level security;

create policy "tickets_insert_own"
  on public.tickets for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (profile_id is null or profile_id = any ((select private.profile_ids())::uuid[]))
    and status = 'open'
  );

create policy "tickets_select_own"
  on public.tickets for select to authenticated
  using (
    (select private.is_admin())
    or user_id = (select auth.uid())
  );

create policy "tickets_admin_update"
  on public.tickets for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "tickets_admin_delete"
  on public.tickets for delete to authenticated
  using ((select private.is_admin()));
