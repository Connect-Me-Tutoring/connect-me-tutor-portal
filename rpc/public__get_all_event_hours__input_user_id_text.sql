CREATE OR REPLACE FUNCTION public.get_all_event_hours(input_user_id text)
 RETURNS real
 LANGUAGE plpgsql
AS $function$BEGIN
RETURN (
  SELECT COALESCE(SUM(hours), 0)
  FROM "Events"
  WHERE tutor_id::text = input_user_id
);
END;$function$
