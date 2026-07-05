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
  LEFT JOIN LATERAL (
    SELECT
      prof.email,
      prof.first_name,
      prof.last_name,
      prof.availability,
      prof.subjects_of_interest,
      prof.languages_spoken
    FROM public."Profiles" prof
    WHERE prof.id = pr.user_id
       OR prof.user_id = pr.user_id
    ORDER BY CASE WHEN prof.id = pr.user_id THEN 0 ELSE 1 END
    LIMIT 1
  ) p ON TRUE
  WHERE pr.type = p_type
  ORDER BY pr.created_at DESC;
END;
$function$;
