CREATE OR REPLACE FUNCTION public.get_all_event_details_for_tutor(p_tutor_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$BEGIN
RETURN (
  SELECT COALESCE(json_object_agg(
    t.type,
    t.events
  )::jsonb, '{}'::jsonb)
  FROM (
    SELECT 
      e.type,
      json_agg(
        json_build_object(
          'eventId', e.id,
          'date', e.date,
          'hours', e.hours,
          'summary', e.summary
        )
      ) as events
    FROM "Events" e
    WHERE e.tutor_id::text = p_tutor_id
    GROUP BY e.type
  ) t
);
END;$function$
