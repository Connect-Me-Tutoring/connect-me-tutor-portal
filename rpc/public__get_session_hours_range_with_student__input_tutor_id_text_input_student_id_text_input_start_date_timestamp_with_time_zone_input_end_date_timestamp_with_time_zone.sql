CREATE OR REPLACE FUNCTION public.get_session_hours_range_with_student(input_tutor_id text, input_student_id text, input_start_date timestamp with time zone, input_end_date timestamp with time zone)
 RETURNS real
 LANGUAGE plpgsql
AS $function$BEGIN
RETURN (
  SELECT COALESCE(SUM(duration), 0)
  FROM "Sessions"
  WHERE tutor_id::text = input_tutor_id
    AND student_id::text = input_student_id
    AND status = 'Complete'
    AND date >= input_start_date
    AND date <= input_end_date
);

END;$function$
