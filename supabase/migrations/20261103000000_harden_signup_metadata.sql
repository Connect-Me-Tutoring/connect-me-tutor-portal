-- Signup metadata must not be able to mint an Admin profile.
--
-- public.handle_new_user() copies role straight out of
-- auth.users.raw_user_meta_data, which is set by whoever signs up. If that
-- function is attached to the auth.users trigger on the hosted project, a
-- direct signup asking for role "Admin" gets one. The portal never passes a
-- role there; admins are created by an admin, through the service role.
--
-- This is the baseline definition with one check added, plus two fixes it
-- needs either way: status is cast to the profile_status enum it became on
-- 2026-08-30, and search_path is public rather than empty so the Profiles
-- trigger it fires can resolve user_settings.
--
-- Everything else this file used to carry (dropping the anon policies,
-- owner-or-admin update policies, a role guard trigger) now lives in the
-- row level security migrations, so it is gone from here rather than
-- duplicated.

begin;

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    -- public, not empty: the Profiles insert below fires
    -- insert_user_settings_from_profiles, which names user_settings
    -- unqualified and cannot resolve it under an empty search path.
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  -- raw_user_meta_data is set by whoever signs up; an administrative role
  -- must never come from it. The portal creates admins through the service
  -- role, not through signup metadata.
  if new.raw_user_meta_data ->> 'role' = 'Admin' then
    raise exception 'Signup metadata cannot assign the Admin role';
  end if;

  insert into public."Profiles" (
    user_id, 
    email, 
    role,
    first_name, 
    last_name, 
    age,
    grade,
    gender,
    start_date,
    availability,
    parent_name,
    parent_email,
    phone_number,
    timezone,
    subjects_of_interest,
    status,
    student_number,
    languages_spoken
  )
  values (
    new.id, 
    new.email,
    new.raw_user_meta_data ->> 'role',
    new.raw_user_meta_data ->> 'first_name', 
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'age',
    new.raw_user_meta_data ->> 'grade',
    new.raw_user_meta_data ->> 'gender',
    (new.raw_user_meta_data ->> 'start_date')::DATE,
  (SELECT array_agg(value) FROM jsonb_array_elements(new.raw_user_meta_data -> 'availability')),
    new.raw_user_meta_data ->> 'parent_name',
    new.raw_user_meta_data ->> 'parent_email',
    new.raw_user_meta_data ->> 'phone_number',
    new.raw_user_meta_data ->> 'timezone',
    (SELECT array_agg(value) FROM jsonb_array_elements(new.raw_user_meta_data -> 'subjects_of_interest')),
    -- Profiles.status is an enum and not null since 20260830164809.
    coalesce(new.raw_user_meta_data ->> 'status', 'Active')::public.profile_status,
    new.raw_user_meta_data ->> 'student_number',
      (SELECT array_agg(value) FROM jsonb_array_elements(new.raw_user_meta_data -> 'languages_spoken'))
  );
  return new;
end;
$$;

commit;
