CREATE OR REPLACE FUNCTION public.get_session_hours_range_batch(start_date timestamp with time zone, end_date timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$BEGIN
RETURN (
  SELECT COALESCE( 
    jsonb_object_agg(
      t.tutor_id::text,
      hours
    ),
    '{}'::jsonb
  )
  FROM (
    SELECT tutor_id, SUM(duration) as hours
    FROM "Sessions"
    WHERE status = 'Complete'
      AND start_date <= date
      AND end_date >= date
    GROUP BY tutor_id
  ) t
);
END;$function$
