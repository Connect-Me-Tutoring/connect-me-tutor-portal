CREATE OR REPLACE FUNCTION public.get_pairing_match(match_id uuid)
 RETURNS TABLE(pairing_match_id uuid, student_id uuid, tutor_id uuid, created_at timestamp with time zone, student jsonb, tutor jsonb)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        pm.id AS pairing_match_id,
        pm.student_id,
        pm.tutor_id,
        pm.created_at,

        -- Student JSON
        jsonb_build_object(
            'id', sp.id,
            'first_name', sp.first_name,
            'last_name', sp.last_name,
            'gender', sp.gender,
            'role', 'student',
            'availability', sp.availability,
            'subjectsOfInterest', sp.subjects_of_interest,
            'languagesSpoken', sp.languages_spoken
        ) AS student,

        -- Tutor JSON
        jsonb_build_object(
            'id', tp.id,
            'first_name', tp.first_name,
            'last_name', tp.last_name,
            'gender', tp.gender,
            'role', 'tutor',
            'availability', tp.availability,
            'subjectsOfInterest', tp.subjects_of_interest,
            'languagesSpoken', tp.languages_spoken
        ) AS tutor

    FROM pairing_matches pm
    LEFT JOIN "Profiles" sp ON sp.id = pm.student_id
    LEFT JOIN "Profiles" tp ON tp.id = pm.tutor_id
    WHERE pm.id = match_id
    LIMIT 1;
END;
$function$
