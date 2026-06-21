CREATE OR REPLACE FUNCTION public.get_all_session_hours_batch()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$BEGIN
RETURN (
  SELECT COALESCE(
    jsonb_object_agg(
      tutor_id::text,
      total_hours
    ),
    '{}'::jsonb
  )
  FROM (
    SELECT tutor_id, SUM(duration) as total_hours
    FROM "Sessions"
    WHERE status = 'Complete'
    GROUP BY tutor_id
  ) final
);
END;$function$
