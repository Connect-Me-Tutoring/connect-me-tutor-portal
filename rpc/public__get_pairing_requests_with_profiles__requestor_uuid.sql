CREATE OR REPLACE FUNCTION public.get_pairing_requests_with_profiles(requestor uuid)
 RETURNS TABLE(pairing_request_id uuid, status text, student_id uuid, tutor_id uuid, created_at timestamp without time zone, updated_at timestamp without time zone, student jsonb, tutor jsonb)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        pr.id,
        pr.status,
        pr.student_id,
        pr.tutor_id,
        pr.created_at,
        pr.updated_at,
        jsonb_build_object(
            'firstName', sp.first_name,
            'lastName', sp.last_name,
            'role', 'student'
        ) AS student,
        jsonb_build_object(
            'firstName', tp.first_name,
            'lastName', tp.last_name,
            'role', 'tutor'
        ) AS tutor
    FROM pairing_requests pr
    LEFT JOIN profiles sp ON sp.id = pr.student_id
    LEFT JOIN profiles tp ON tp.id = pr.tutor_id
    WHERE pr.student_id = requestor OR pr.tutor_id = requestor
    ORDER BY pr.created_at DESC;
END;
$function$
