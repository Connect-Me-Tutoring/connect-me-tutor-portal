CREATE OR REPLACE FUNCTION public.get_tutor_sessions(p_start_date text, p_end_date text)
 RETURNS TABLE(tutor_id uuid, first_name text, last_name text, total_sessions bigint, session_dates jsonb)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    b.id as tutor_id,
    b.first_name,
    b.last_name,
    COUNT(a.id) AS total_sessions,
    jsonb_agg(a.date ORDER BY a.date) AS session_dates
  FROM "Sessions" a
  LEFT JOIN "Profiles" b ON a.tutor_id = b.id
  WHERE
    a.status = 'Complete' AND
    a.date >= p_start_date::TIMESTAMPTZ AND
    a.date < p_end_date::TIMESTAMPTZ
  GROUP BY b.id, b.first_name, b.last_name
  ORDER BY b.first_name;
END;
$function$
