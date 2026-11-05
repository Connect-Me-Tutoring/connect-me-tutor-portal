-- ===========================================================================
-- Lock down SECURITY DEFINER RPCs that bypass RLS
-- ===========================================================================

-- get_user_by_email: only called from createUser() via the admin client
-- (lib/actions/auth/server.actions.ts), so it never needs to be reachable by
-- anon/authenticated. Exposed, it lets anyone with the publishable key
-- enumerate accounts and read auth.users ids.
alter function public.get_user_by_email(text) set search_path = '';

revoke execute on function public.get_user_by_email(text) from public, anon, authenticated;
grant execute on function public.get_user_by_email(text) to service_role;


-- get_pairing_matches_with_profiles: called from the browser client
-- (getIncomingPairingMatches in lib/actions/pairing/client.actions.ts) with
-- the caller's own profile id. It runs as SECURITY DEFINER, so without an
-- ownership check any caller could pass another user's profile id and read
-- their pending matches plus both parties' profile details.
create or replace function public.get_pairing_matches_with_profiles(requestor uuid)
returns table(
  pairing_match_id uuid,
  student_id       uuid,
  tutor_id         uuid,
  created_at       timestamp with time zone,
  student          jsonb,
  tutor            jsonb,
  tutor_status     text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_requestor_auth_id uuid;
begin
  if not (
    (select private.is_admin())
    or requestor = any ((select private.profile_ids())::uuid[])
  ) then
    return;
  end if;

  -- Resolve the requestor's auth UUID so we can match rows stored with either ID.
  select p.user_id into v_requestor_auth_id
  from public."Profiles" p
  where p.id = requestor
  limit 1;

  return query
  select
    pm.id                                                        as pairing_match_id,
    pm.student_id,
    pm.tutor_id,
    pm.created_at,
    jsonb_build_object(
      'id',                coalesce(sp.id,  sp2.id),
      'first_name',        coalesce(sp.first_name,  sp2.first_name),
      'last_name',         coalesce(sp.last_name,   sp2.last_name),
      'role',              'student',
      'availability',      coalesce(sp.availability,         sp2.availability),
      'subjectsOfInterest', coalesce(sp.subjects_of_interest, sp2.subjects_of_interest),
      'languagesSpoken',   coalesce(sp.languages_spoken,     sp2.languages_spoken)
    )                                                            as student,
    jsonb_build_object(
      'id',                coalesce(tp.id,  tp2.id),
      'first_name',        coalesce(tp.first_name,  tp2.first_name),
      'last_name',         coalesce(tp.last_name,   tp2.last_name),
      'role',              'tutor',
      'availability',      coalesce(tp.availability,         tp2.availability),
      'subjectsOfInterest', coalesce(tp.subjects_of_interest, tp2.subjects_of_interest),
      'languagesSpoken',   coalesce(tp.languages_spoken,     tp2.languages_spoken)
    )                                                            as tutor,
    pm.tutor_status
  from pairing_matches pm

  -- Student: primary path via user_settings (stored id = auth UUID)
  left join public.user_settings us_s
    on us_s.user_id = pm.student_id
  left join public."Profiles" sp
    on sp.id = us_s.last_active_profile_id

  -- Student: fallback direct join (stored id = Profiles.id)
  left join public."Profiles" sp2
    on sp2.id = pm.student_id
   and sp.id is null

  -- Tutor: primary path via user_settings
  left join public.user_settings us_t
    on us_t.user_id = pm.tutor_id
  left join public."Profiles" tp
    on tp.id = us_t.last_active_profile_id

  -- Tutor: fallback direct join
  left join public."Profiles" tp2
    on tp2.id = pm.tutor_id
   and tp.id is null

  where (
    -- stored as auth UUID
    pm.student_id = v_requestor_auth_id
    or pm.tutor_id = v_requestor_auth_id
    -- stored as Profiles.id
    or pm.student_id = requestor
    or pm.tutor_id   = requestor
  )
    and (pm.tutor_status = 'pending' or pm.tutor_status is null)
  order by pm.created_at desc;
end;
$function$;

revoke execute on function public.get_pairing_matches_with_profiles(uuid) from public, anon;
grant execute on function public.get_pairing_matches_with_profiles(uuid) to authenticated, service_role;
