CREATE OR REPLACE FUNCTION public.get_enrollments_with_student_profile()
 RETURNS TABLE(id uuid, created_at timestamp with time zone, student_id uuid, tutor_id uuid, summary text, start_date date, end_date date, availability jsonb, meetingid uuid, summer_paused boolean, duration integer, profile_id uuid, profile_user_id uuid, first_name text, last_name text, email text)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
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

    p.id AS profile_id,
    p.user_id AS profile_user_id,
    p.first_name,
    p.last_name,
    p.email
  FROM public."Enrollments" e
  LEFT JOIN public."Profiles" p ON p.id = e.student_id
  ORDER BY e.created_at DESC;
END;
$function$
