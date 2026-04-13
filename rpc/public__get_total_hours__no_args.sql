CREATE OR REPLACE FUNCTION public.get_total_hours()
 RETURNS real
 LANGUAGE plpgsql
AS $function$BEGIN
RETURN (
  SELECT session_hours + event_hours
  FROM (
    SELECT SUM(duration) as session_hours
    FROM "Sessions"
      WHERE status = 'Complete'
  ) as session_data
  CROSS JOIN (
    SELECT SUM(hours) as event_hours
    FROM "Events"
  ) as event_data
);
END;$function$
