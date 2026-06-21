CREATE OR REPLACE FUNCTION public.get_user_pairings_with_profiles(requestor_auth_id uuid)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, student_id uuid, tutor_id uuid, student jsonb, tutor jsonb)
 LANGUAGE sql
AS $function$
  SELECT 
    e.id,
    e.created_at,
    e.student_id,
    e.tutor_id,
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
  FROM public."Pairings" e
  JOIN public."Profiles" req_profile 
    ON req_profile.user_id = requestor_auth_id
  LEFT JOIN public."Profiles" sp ON sp.id = e.student_id
  LEFT JOIN public."Profiles" tp ON tp.id = e.tutor_id
  WHERE e.student_id = req_profile.id 
     OR e.tutor_id = req_profile.id
  ORDER BY e.created_at DESC;
$function$
