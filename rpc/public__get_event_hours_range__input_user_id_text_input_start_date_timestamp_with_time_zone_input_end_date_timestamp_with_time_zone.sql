CREATE OR REPLACE FUNCTION public.get_event_hours_range(input_user_id text, input_start_date timestamp with time zone, input_end_date timestamp with time zone)
 RETURNS real
 LANGUAGE plpgsql
AS $function$BEGIN
RETURN (
  SELECT COALESCE(SUM(hours), 0)
  FROM "Events"
  WHERE tutor_id::text = input_user_id
    AND date > input_start_date
    AND date < input_end_date
);
END$function$
