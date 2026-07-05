CREATE OR REPLACE FUNCTION public.get_session_hours_by_student(p_tutor_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$BEGIN
  RETURN (
    SELECT COALESCE(json_agg(
      json_build_object(
        'studentId', t.student_id,
        'firstName', COALESCE(t.first_name, 'Previous Students'),
        'lastName', COALESCE(t.last_name, ''),
        'hours', t.total_duration
      )
    )::jsonb, '{}'::jsonb)
    FROM (
      SELECT s.student_id, sp.first_name, sp.last_name, SUM(s.duration) as total_duration
      FROM "Sessions" s
      LEFT JOIN "Profiles" sp ON s.student_id = sp.id
      WHERE s.tutor_id::text = p_tutor_id
        AND s.status = 'Complete'
      GROUP BY s.student_id, sp.first_name, sp.last_name
    ) t
  );
END;$function$
