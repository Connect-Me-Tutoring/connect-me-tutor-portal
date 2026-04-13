CREATE OR REPLACE FUNCTION public.get_pairing_logs(start_time timestamp with time zone, end_time timestamp with time zone)
 RETURNS TABLE(id uuid, type text, profile jsonb, match_profile jsonb, message text, status text, created_at timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        pl.id,
        pl.type,
        -- profile JSON via pairing_request_id -> pairing_requests.user_id -> Profiles
        CASE
            WHEN pl.metadata ? 'pairing_request_id' THEN (
                SELECT jsonb_build_object(
                    'id', p.id,
                    'email', p.email,
                    'user_id', p.user_id,
                    'first_name', p.first_name,
                    'last_name', p.last_name,
                    'role', p.role
                )
                FROM pairing_requests pr
                JOIN "Profiles" p ON pr.user_id = p.id
                WHERE pr.id = (pl.metadata->>'pairing_request_id')::uuid
            )
            ELSE NULL
        END AS profile,
        -- match_profile JSON only if match_profile_id exists
        CASE
            WHEN pl.metadata ? 'match_profile_id' THEN (
                SELECT jsonb_build_object(
                    'id', mp.id,
                    'email', mp.email,
                    'user_id', mp.user_id,
                    'first_name', mp.first_name,
                    'last_name', mp.last_name,
                    'role', mp.role
                )
                FROM "Profiles" mp
                WHERE mp.id = (pl.metadata->>'match_profile_id')::uuid
            )
            ELSE NULL
        END AS match_profile,
        pl.message,
        CASE 
            WHEN pl.error = TRUE THEN 'error'
            ELSE 'ok'
        END AS status,
        pl.created_at
    FROM pairing_logs pl
    WHERE pl.created_at BETWEEN start_time AND end_time
    ORDER BY pl.created_at DESC;
END;
$function$
