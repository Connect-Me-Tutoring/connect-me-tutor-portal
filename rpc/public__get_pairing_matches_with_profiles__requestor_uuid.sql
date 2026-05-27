CREATE OR REPLACE FUNCTION public.get_pairing_matches_with_profiles(requestor uuid)
RETURNS TABLE(
  pairing_match_id uuid,
  student_id       uuid,
  tutor_id         uuid,
  created_at       timestamp with time zone,
  student          jsonb,
  tutor            jsonb,
  tutor_status     text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_requestor_auth_id uuid;
BEGIN
  -- Resolve the requestor's auth UUID so we can match rows stored with either ID.
  SELECT p.user_id INTO v_requestor_auth_id
  FROM public."Profiles" p
  WHERE p.id = requestor
  LIMIT 1;

  RETURN QUERY
  SELECT
    pm.id                                                        AS pairing_match_id,
    pm.student_id,
    pm.tutor_id,
    pm.created_at,
    jsonb_build_object(
      'id',                COALESCE(sp.id,  sp2.id),
      'first_name',        COALESCE(sp.first_name,  sp2.first_name),
      'last_name',         COALESCE(sp.last_name,   sp2.last_name),
      'role',              'student',
      'availability',      COALESCE(sp.availability,         sp2.availability),
      'subjectsOfInterest', COALESCE(sp.subjects_of_interest, sp2.subjects_of_interest),
      'languagesSpoken',   COALESCE(sp.languages_spoken,     sp2.languages_spoken)
    )                                                            AS student,
    jsonb_build_object(
      'id',                COALESCE(tp.id,  tp2.id),
      'first_name',        COALESCE(tp.first_name,  tp2.first_name),
      'last_name',         COALESCE(tp.last_name,   tp2.last_name),
      'role',              'tutor',
      'availability',      COALESCE(tp.availability,         tp2.availability),
      'subjectsOfInterest', COALESCE(tp.subjects_of_interest, tp2.subjects_of_interest),
      'languagesSpoken',   COALESCE(tp.languages_spoken,     tp2.languages_spoken)
    )                                                            AS tutor,
    pm.tutor_status
  FROM pairing_matches pm

  -- Student: primary path via user_settings (stored id = auth UUID)
  LEFT JOIN public.user_settings us_s
    ON us_s.user_id = pm.student_id
  LEFT JOIN public."Profiles" sp
    ON sp.id = us_s.last_active_profile_id

  -- Student: fallback direct join (stored id = Profiles.id)
  LEFT JOIN public."Profiles" sp2
    ON sp2.id = pm.student_id
   AND sp.id IS NULL

  -- Tutor: primary path via user_settings
  LEFT JOIN public.user_settings us_t
    ON us_t.user_id = pm.tutor_id
  LEFT JOIN public."Profiles" tp
    ON tp.id = us_t.last_active_profile_id

  -- Tutor: fallback direct join
  LEFT JOIN public."Profiles" tp2
    ON tp2.id = pm.tutor_id
   AND tp.id IS NULL

  WHERE (
    -- stored as auth UUID
    pm.student_id = v_requestor_auth_id
    OR pm.tutor_id = v_requestor_auth_id
    -- stored as Profiles.id
    OR pm.student_id = requestor
    OR pm.tutor_id   = requestor
  )
    AND (pm.tutor_status = 'pending' OR pm.tutor_status IS NULL)
  ORDER BY pm.created_at DESC;
END;
$function$;
