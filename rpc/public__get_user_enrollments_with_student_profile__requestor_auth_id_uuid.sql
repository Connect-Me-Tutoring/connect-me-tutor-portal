CREATE OR REPLACE FUNCTION public.get_user_enrollments_with_student_profile(requestor_auth_id uuid)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, student_id uuid, tutor_id uuid, summary text, start_date date, end_date date, availability jsonb, meetingid uuid, summer_paused boolean, duration integer, student_profile_id uuid, student_user_id uuid, student_first_name text, student_last_name text, student_email text)
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
    e.start_date::date,
    e.end_date::date,
    e.availability,
    e."meetingId",
    e.summer_paused,
    e.duration::integer,

    sp.id AS student_profile_id,
    sp.user_id AS student_user_id,
    sp.first_name AS student_first_name,
    sp.last_name AS student_last_name,
    sp.email AS student_email

  FROM public."Enrollments" e
  JOIN public."Profiles" req_profile ON req_profile.user_id = requestor_auth_id
  LEFT JOIN public."Profiles" sp ON sp.id = e.student_id
  WHERE e.student_id = req_profile.id OR e.tutor_id = req_profile.id
  ORDER BY e.created_at DESC;
END;
$function$
