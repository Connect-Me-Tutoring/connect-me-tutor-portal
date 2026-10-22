-- GoTrue remains responsible for deleting auth users. The guard runs INSIDE its
-- transaction: validation, approved onboarding cleanup and the success audit all
-- roll back if any auth/profile cascade fails. No split profile/auth deletion.
create table public.tutor_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  profile_id uuid not null,
  auth_user_id uuid,
  settings_id uuid,
  email text,
  reason text not null,
  recovery_attempted boolean not null,
  first_access_failure boolean not null,
  status text not null check (status in ('pending', 'blocked', 'failed', 'succeeded')),
  failure text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
-- Deliberately no foreign keys: this evidence must survive account deletion.
alter table public.tutor_deletion_audit enable row level security;
revoke all on public.tutor_deletion_audit from anon, authenticated;
grant select on public.tutor_deletion_audit to authenticated;
grant all on public.tutor_deletion_audit to service_role;
create policy tutor_deletion_audit_admin_read on public.tutor_deletion_audit
  for select to authenticated using ((select private.is_admin()));
create index tutor_deletion_audit_pending_user on public.tutor_deletion_audit (auth_user_id)
  where status = 'pending';

-- Conservative allowlist: everything referencing this profile/auth account is
-- history unless it is explicitly recognized as untouched onboarding data.
-- UUID columns, UUID arrays and JSON also cover legacy non-FK associations.
create function private.tutor_deletion_blocker(p_profile_id uuid, p_email text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  p public."Profiles"%rowtype;
  t record;
  c record;
  predicates text;
  found_history boolean;
begin
  select * into p from public."Profiles" where id = p_profile_id;
  if not found or p.role is distinct from 'Tutor' then
    return 'Select an existing Tutor profile.';
  end if;
  if p_email is null or p.email is null or lower(btrim(p.email)) is distinct from lower(btrim(p_email)) then
    return 'The confirmation email must match the tutor email.';
  end if;
  if p.user_id is null or not exists (
    select 1 from auth.users u where u.id = p.user_id
      and lower(u.email) = lower(p.email)
  ) then
    return 'The authentication account is missing or its email differs. Escalate account recovery.';
  end if;
  if exists (select 1 from public."Profiles" where user_id = p.user_id and id <> p.id)
    or exists (select 1 from public."Profiles" where id <> p.id and lower(email) = lower(p.email)) then
    return 'This authentication account or email is shared with another profile. Use Deactivate Tutor.';
  end if;
  if coalesce(p.tutoring_hours, 0) <> 0 or p.orientation_completed_at is not null
    or coalesce(cardinality(p.tutor_ids), 0) > 0 then
    return 'This tutor has credited hours or completed onboarding. Use Deactivate Tutor.';
  end if;
  if exists (select 1 from public."Profiles" where id <> p.id and settings_id = p.settings_id)
    or exists (select 1 from public.user_settings
      where (user_id = p.user_id and last_active_profile_id <> p.id)
         or (last_active_profile_id = p.id and user_id <> p.user_id)) then
    return 'This account shares settings with another profile. Escalate account recovery.';
  end if;
  if exists (select 1 from public.pairing_requests
    where user_id in (p.id, p.user_id) and not (
      user_id = p.id and type = 'tutor' and status = 'pending'
      and in_queue and priority = 1 and exclude_rejected_tutors
      and notes is not distinct from 'Auto-enqueued on account creation'
    )) then
    return 'This tutor has pairing queue activity. Use Deactivate Tutor.';
  end if;

  for t in
    select n.nspname, cl.relname, cl.oid from pg_catalog.pg_class cl
    join pg_catalog.pg_namespace n on n.oid = cl.relnamespace
    where cl.relkind in ('r', 'p') and (
      n.nspname in ('public', 'storage') or (n.nspname <> 'auth' and exists (
        select 1 from pg_catalog.pg_constraint fk where fk.conrelid = cl.oid
          and fk.contype = 'f' and fk.confrelid in (
            'auth.users'::regclass, 'public."Profiles"'::regclass,
            'public.user_notification_settings'::regclass
          )
      ))
    ) and not (n.nspname = 'public' and cl.relname in (
      'tutor_deletion_audit', 'user_settings', 'user_notification_settings',
      'User_Availabilities', 'pairing_requests'
    )) order by n.nspname, cl.relname
  loop
    predicates := '';
    for c in select a.attname, a.atttypid from pg_catalog.pg_attribute a
      where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
    loop
      if c.atttypid = 'uuid'::regtype then
        predicates := concat_ws(' OR ', nullif(predicates, ''),
          format('%I = ANY ($1)', c.attname));
      elsif c.atttypid = 'uuid[]'::regtype then
        predicates := concat_ws(' OR ', nullif(predicates, ''),
          format('%I && $1', c.attname));
      elsif t.relname = 'zoom_participant_events' and c.attname = 'email' then
        predicates := concat_ws(' OR ', nullif(predicates, ''),
          format('lower(%I) = lower($4)', c.attname));
      elsif c.atttypid in ('json'::regtype, 'jsonb'::regtype, 'jsonb[]'::regtype)
        or c.attname in ('owner_id', 'metadata', 'request_information')
        or c.attname ~ '(profile|tutor|student|user|owner).*id(s)?$' then
        predicates := concat_ws(' OR ', nullif(predicates, ''),
          format('(%I::text ILIKE ANY ($2))', c.attname));
      end if;
    end loop;
    if predicates <> '' then
      -- The target's own Profiles row is expected; any OTHER reference is not.
      execute format('select exists (select 1 from %I.%I where (%s) %s)',
        t.nspname, t.relname, predicates,
        case when t.nspname = 'public' and t.relname = 'Profiles'
          then 'and id <> $3' else '' end)
      into found_history using array[p.id, p.user_id, p.settings_id],
        array['%' || p.id::text || '%', '%' || p.user_id::text || '%',
          '%' || p.settings_id::text || '%'], p.id, p.email;
      if found_history then
        return 'Associated records in ' || t.relname || ' prevent deletion. Use Deactivate Tutor.';
      end if;
    end if;
  end loop;
  return null;
end;
$$;
revoke all on function private.tutor_deletion_blocker(uuid, text) from public, anon, authenticated;

create function public.prepare_tutor_onboarding_deletion(
  p_profile_id uuid, p_email text, p_reason text,
  p_recovery_attempted boolean, p_first_access_failure boolean
) returns public.tutor_deletion_audit
language plpgsql security definer set search_path = '' as $$
declare
  result public.tutor_deletion_audit;
  blocker text;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_recovery_attempted is distinct from true or p_first_access_failure is distinct from true
    or p_reason is null or length(btrim(p_reason)) < 20 or length(p_reason) > 2000 then
    raise exception 'Confirm first-access onboarding failure, attempted recovery, and provide a detailed reason.';
  end if;
  -- Serialize preparation for the same target and expire abandoned requests.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_profile_id::text, 0));
  update public.tutor_deletion_audit set status = 'failed', failure = 'Superseded by a new attempt',
    completed_at = now() where profile_id = p_profile_id and status = 'pending';
  blocker := private.tutor_deletion_blocker(p_profile_id, p_email);
  insert into public.tutor_deletion_audit (
    actor_id, profile_id, auth_user_id, settings_id, email, reason, recovery_attempted, first_access_failure,
    status, failure, completed_at
  ) select auth.uid(), p_profile_id, p.user_id, p.settings_id, p.email, btrim(p_reason),
      p_recovery_attempted, p_first_access_failure,
      case when blocker is null then 'pending' else 'blocked' end, blocker,
      case when blocker is null then null else now() end
    from (select 1) x left join public."Profiles" p on p.id = p_profile_id
    returning * into result;
  return result;
end;
$$;
revoke all on function public.prepare_tutor_onboarding_deletion(uuid, text, text, boolean, boolean)
  from public, anon;
grant execute on function public.prepare_tutor_onboarding_deletion(uuid, text, text, boolean, boolean)
  to authenticated;

create function private.guard_tutor_auth_deletion()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  request public.tutor_deletion_audit;
  blocker text;
  t record;
begin
  -- Other account types and rollback of a failed invite with no profile keep
  -- their existing behavior. A Tutor can only be deleted through this recovery.
  if not exists (select 1 from public."Profiles" where user_id = old.id and role = 'Tutor')
    and not exists (select 1 from public.tutor_deletion_audit where auth_user_id = old.id and status <> 'blocked') then
    return old;
  end if;
  select * into request from public.tutor_deletion_audit
    where auth_user_id = old.id and status = 'pending'
    order by created_at desc limit 1 for update;
  if not found or request.created_at < now() - interval '5 minutes' then
    raise exception 'A current admin onboarding recovery confirmation is required.';
  end if;
  -- Serialize writes to all inspected application tables, including legacy
  -- non-FK relationships. This is a rare, short recovery operation. Fail closed
  -- on contention. Row locks alone cannot protect non-FK associations.
  perform pg_catalog.set_config('lock_timeout', '3s', true);
  for t in select n.nspname, c.relname from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p') and (n.nspname in ('public', 'storage')
      or (n.nspname <> 'auth' and exists (
        select 1 from pg_catalog.pg_constraint fk where fk.conrelid = c.oid
          and fk.contype = 'f' and fk.confrelid in (
            'auth.users'::regclass, 'public."Profiles"'::regclass,
            'public.user_notification_settings'::regclass
          )
      ))) and not (n.nspname = 'public' and c.relname = 'tutor_deletion_audit') order by n.nspname, c.relname
  loop
    execute format('lock table %I.%I in share row exclusive mode', t.nspname, t.relname);
  end loop;
  if not exists (select 1 from public."Profiles" where user_id = request.actor_id and role = 'Admin') then
    raise exception 'The requesting administrator no longer has admin access.';
  end if;
  if not exists (select 1 from public."Profiles" where id = request.profile_id
    and user_id = old.id and role = 'Tutor') then
    raise exception 'The selected tutor account changed. Confirm onboarding recovery again.';
  end if;
  blocker := private.tutor_deletion_blocker(request.profile_id, request.email);
  if blocker is not null then raise exception '%', blocker; end if;
  -- Only these recognized onboarding artifacts may be removed. The profile,
  -- auth sessions and identities are deleted by GoTrue's existing FK cascades.
  delete from public.pairing_requests where user_id = request.profile_id;
  delete from public."User_Availabilities" where profile_id = request.profile_id;
  delete from public.user_settings where user_id = old.id;
  update public.tutor_deletion_audit set status = 'succeeded', completed_at = now()
    where id = request.id;
  return old;
end;
$$;
revoke all on function private.guard_tutor_auth_deletion() from public, anon, authenticated;
create trigger guard_tutor_onboarding_recovery before delete on auth.users
  for each row execute function private.guard_tutor_auth_deletion();

create function private.finish_tutor_auth_deletion()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  request public.tutor_deletion_audit;
begin
  select * into request from public.tutor_deletion_audit
    where auth_user_id = old.id and status = 'succeeded'
    order by completed_at desc limit 1;
  if found and exists (select 1 from public."Profiles" where id = request.profile_id or user_id = old.id) then
    raise exception 'Tutor profile removal did not complete; authentication deletion rolled back.';
  end if;
  if found then
    delete from public.user_notification_settings where id = request.settings_id;
  end if;
  return old;
end;
$$;
revoke all on function private.finish_tutor_auth_deletion() from public, anon, authenticated;
-- PostgreSQL runs same-kind triggers by name; RI_* cascade triggers run first.
create trigger zz_verify_tutor_onboarding_recovery after delete on auth.users
  for each row execute function private.finish_tutor_auth_deletion();
