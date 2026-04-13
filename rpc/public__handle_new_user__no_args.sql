CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
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
    new.raw_user_meta_data ->> 'status',
    new.raw_user_meta_data ->> 'student_number',
      (SELECT array_agg(value) FROM jsonb_array_elements(new.raw_user_meta_data -> 'languages_spoken'))
  );
  return new;
end;
$function$
