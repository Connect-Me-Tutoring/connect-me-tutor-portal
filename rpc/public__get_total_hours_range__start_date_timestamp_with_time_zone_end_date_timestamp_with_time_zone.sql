CREATE OR REPLACE FUNCTION public.get_total_hours_range(start_date timestamp with time zone, end_date timestamp with time zone)
 RETURNS real
 LANGUAGE plpgsql
AS $function$BEGIN
RETURN (
  SELECT COALESCE(session_hours, 0) + COALESCE(event_hours, 0)
  FROM (
    SELECT SUM(duration) as session_hours
    FROM "Sessions"
    WHERE date >= start_date
      AND date <= end_date
      AND status = 'Complete'
  ) as session_data
  CROSS JOIN (
    SELECT SUM(hours) as event_hours
    FROM "Events"
    WHERE date >= start_date
      AND date <= end_date
  ) as event_data
);
END;$function$
