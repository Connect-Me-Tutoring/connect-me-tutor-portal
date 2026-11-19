-- Refresh public.handle_new_user():
--   * profiles created at signup are never given the Admin role (admins are
--     created through the service role)
--   * status is cast to the profile_status enum
--   * search_path includes public so the Profiles insert trigger can resolve
--     user_settings

begin;

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    -- public, not empty: the Profiles insert below fires
    -- insert_user_settings_from_profiles, which names user_settings
    -- unqualified and cannot resolve it under an empty search path.
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  -- Admin profiles are created through the service role, not at signup.
  if new.raw_user_meta_data ->> 'role' = 'Admin' then
    raise exception 'Admin profiles cannot be created at signup';
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
