CREATE OR REPLACE FUNCTION public.get_total_session_hours_range(start_date timestamp with time zone, end_date timestamp with time zone)
 RETURNS real
 LANGUAGE plpgsql
AS $function$BEGIN
RETURN (
  SELECT COALESCE(SUM(duration), 0) 
  FROM "Sessions"
  WHERE "date" >= start_date
    AND "date" <= end_date
    AND status = 'Complete'
);
END;$function$
