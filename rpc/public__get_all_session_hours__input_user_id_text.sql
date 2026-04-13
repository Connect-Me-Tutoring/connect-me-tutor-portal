CREATE OR REPLACE FUNCTION public.get_all_session_hours(input_user_id text)
 RETURNS real
 LANGUAGE plpgsql
AS $function$BEGIN
  RETURN (
    SELECT COALESCE(SUM(duration), 0)
    FROM "Sessions"
    WHERE tutor_id::text = input_user_id AND status = 'Complete'
  );
END;$function$
