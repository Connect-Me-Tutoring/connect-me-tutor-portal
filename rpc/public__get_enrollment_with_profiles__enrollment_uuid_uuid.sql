CREATE OR REPLACE FUNCTION public.get_enrollment_with_profiles(enrollment_uuid uuid)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, student_id uuid, tutor_id uuid, summary text, start_date date, end_date date, availability jsonb, meetingid uuid, summer_paused boolean, duration integer, student jsonb, tutor jsonb)
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

    jsonb_build_object(
      'id', sp.id,
      'user_id', sp.user_id,
      'first_name', sp.first_name,
      'last_name', sp.last_name,
      'email', sp.email
    ) AS student,

    jsonb_build_object(
      'id', tp.id,
      'user_id', tp.user_id,
      'first_name', tp.first_name,
      'last_name', tp.last_name,
      'email', tp.email
    ) AS tutor

  FROM public."Enrollments" e
  LEFT JOIN public."Profiles" sp ON sp.id = e.student_id
  LEFT JOIN public."Profiles" tp ON tp.id = e.tutor_id
  WHERE e.id = enrollment_uuid;
END;
$function$
