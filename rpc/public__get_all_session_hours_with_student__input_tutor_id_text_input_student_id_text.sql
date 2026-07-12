CREATE OR REPLACE FUNCTION public.get_all_session_hours_with_student(input_tutor_id text, input_student_id text)
 RETURNS real
 LANGUAGE plpgsql
AS $function$BEGIN
  RETURN (
    SELECT COALESCE(SUM(duration), 0)
    FROM "Sessions"
    WHERE tutor_id::text = input_tutor_id 
      AND student_id::text = input_student_id 
      AND status = 'Complete'
  );
END;$function$
