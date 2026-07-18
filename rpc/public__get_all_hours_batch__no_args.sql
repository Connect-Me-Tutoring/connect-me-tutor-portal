CREATE OR REPLACE FUNCTION public.get_all_hours_batch()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$BEGIN
  RETURN (
    SELECT jsonb_object_agg(
      at.tutor_id::text,
      COALESCE(st.session_hours, 0) + COALESCE(et.event_hours, 0)
    )
    FROM (
      SELECT DISTINCT tutor_id FROM (
        SELECT tutor_id FROM "Sessions"
        WHERE status = 'Complete' AND tutor_id is not null
        UNION
        SELECT tutor_id FROM "Events"
      ) t
    ) at 
    LEFT JOIN (
      SELECT tutor_id, SUM(duration) as session_hours
      FROM "Sessions"
      WHERE status = 'Complete' AND tutor_id is not null
      GROUP BY tutor_id
    ) st ON at.tutor_id = st.tutor_id
    LEFT JOIN (
      SELECT tutor_id, SUM(hours) as event_hours
      FROM "Events"
      WHERE tutor_id is not null
      GROUP BY tutor_id
    ) et ON at.tutor_id = et.tutor_id
  );
END;$function$
