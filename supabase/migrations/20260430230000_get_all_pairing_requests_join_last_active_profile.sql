CREATE OR REPLACE FUNCTION public.get_all_pairing_requests(p_type text)
RETURNS TABLE(
  request_id uuid,
  type text,
  user_id uuid,
  status text,
  priority integer,
  created_at timestamp with time zone,
  profile jsonb
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    pr.id AS request_id,
    pr.type,
    pr.user_id,
    pr.status,
    pr.priority,
    pr.created_at,
    to_jsonb(json_build_object(
      'email', p.email,
      'firstName', p.first_name,
      'lastName', p.last_name,
      'availability', p.availability,
      'subjects_of_interest', p.subjects_of_interest,
      'languages_spoken', p.languages_spoken
    )) AS profile
  FROM pairing_requests pr
  LEFT JOIN public.user_settings us
    ON us.user_id = pr.user_id
  LEFT JOIN public."Profiles" p
    ON p.id = us.last_active_profile_id
  WHERE pr.type = p_type
  ORDER BY pr.created_at DESC;
END;
$function$;
