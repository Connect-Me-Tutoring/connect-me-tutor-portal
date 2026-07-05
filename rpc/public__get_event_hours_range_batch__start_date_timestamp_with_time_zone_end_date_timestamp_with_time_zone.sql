CREATE OR REPLACE FUNCTION public.get_event_hours_range_batch(start_date timestamp with time zone, end_date timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$BEGIN
  RETURN (
    WITH all_combinations AS (
      SELECT 
        t.tutor_id,
        et.type
      FROM (SELECT DISTINCT tutor_id FROM "Events") t
      CROSS JOIN (SELECT unnest(enum_range(NULL::event_type)) as type) et
    ),
    actual_hours AS (
      SELECT tutor_id, type, SUM(hours) as total_hours
      FROM "Events"
      WHERE date >= start_date
        AND date <= end_date
      GROUP BY tutor_id, type
    ),
    tutor_type_hours AS (
      SELECT 
        ac.tutor_id,
        jsonb_object_agg(
          ac.type::text,
          COALESCE(ah.total_hours, 0)
        ) as type_hours
      FROM all_combinations ac
      LEFT JOIN actual_hours ah ON ac.tutor_id = ah.tutor_id 
                               AND ac.type = ah.type
      GROUP BY ac.tutor_id
    )
    SELECT COALESCE (
      jsonb_object_agg(
        tutor_id::text,
        type_hours
      ),
      '{}'::jsonb
    )
    FROM tutor_type_hours
  );
END;$function$
