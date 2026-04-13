CREATE OR REPLACE FUNCTION public.get_all_event_hours_batch_with_type(event_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$BEGIN
  RETURN (
    SELECT jsonb_object_agg(
      tutor_id::text,
      total_hours
    )
    FROM  (
      SELECT tutor_id, SUM(hours) as total_hours
      FROM "Events"
      WHERE type::text = event_type
      GROUP BY tutor_id
    ) t
  );
END;$function$
