CREATE OR REPLACE FUNCTION public.normalize_availability(avail jsonb, tz text)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
    normalized JSONB;
BEGIN
    normalized := (
        SELECT jsonb_agg(
            jsonb_build_object(
                'day', a.day,
                'startTime', (
                    (a.startTime::time at time zone tz)::time
                )::text,
                'endTime', (
                    (a.endTime::time at time zone tz)::time
                )::text
            )
        )
        FROM jsonb_to_recordset(avail)
        AS a(day TEXT, startTime TEXT, endTime TEXT)
    );

    RETURN normalized;
END;
$function$
