CREATE OR REPLACE FUNCTION public.get_hours_range_batch(start_date timestamp with time zone, end_date timestamp with time zone)
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
    SELECT 
      tutor_id,
      SUM(hours) as total_hours
    FROM (
      SELECT tutor_id, duration as hours
      FROM "Sessions"
      WHERE status = 'Complete'
        AND start_date <= date
        AND end_date >= date
      
      UNION ALL
      
      SELECT tutor_id, hours
      FROM "Events"
      WHERE date >= start_date
        AND date <= end_date
    ) combined
    GROUP BY tutor_id
  ) final
);
END;$function$
