CREATE OR REPLACE FUNCTION public.get_user_enrollments(input_user_id uuid)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, student_id uuid, tutor_id uuid, summary text, start_date timestamp with time zone, end_date timestamp with time zone, availability jsonb, "meetingId" uuid, summer_paused boolean, duration real, profile_id uuid, profile_user_id uuid, profile_name text, profile_email text)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$SELECT 
    e.id,
    e.created_at,
    e.student_id,
    e.tutor_id,
    e.summary,
    e.start_date,
    e.end_date,
    e.availability,
    e."meetingId",
    e.summer_paused,
    e.duration,
    
    p.id as profile_id,
    p.user_id as profile_user_id,
    p.first_name as profile_name,
    p.email as profile_email
    -- Add other profile columns you need
  FROM public."Enrollments" e
  LEFT JOIN public."Profiles" p ON p.user_id = input_user_id
  WHERE e.tutor_id = p.id OR e.student_id = p.id
  ORDER BY e.created_at DESC;$function$
