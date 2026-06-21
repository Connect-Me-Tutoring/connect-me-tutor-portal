CREATE OR REPLACE FUNCTION public.get_total_event_hours_range(start_date timestamp with time zone, end_date timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$BEGIN
RETURN (
    SELECT COALESCE(
      json_object_agg(
        enum_value::text,
        COALESCE(event_hours, 0)
      ),
      '{}'::json
    )
    FROM (
      SELECT 
        unnest(enum_range(NULL::event_type)) as enum_value
    ) all_types
    LEFT JOIN (
      SELECT 
        type,
        SUM(hours) as event_hours
      FROM "Events"
      WHERE "date" >= start_date 
        AND "date" <= end_date
      GROUP BY type
    ) actual_counts ON all_types.enum_value = actual_counts.type
  );
  END;$function$
