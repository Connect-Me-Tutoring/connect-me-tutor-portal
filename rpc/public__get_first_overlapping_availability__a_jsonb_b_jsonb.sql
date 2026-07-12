CREATE OR REPLACE FUNCTION public.get_first_overlapping_availability(a jsonb[], b jsonb[])
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    first_overlap JSONB;
    normalized JSONB;
BEGIN
    -- Get the first overlap
    SELECT elem
    INTO first_overlap
    FROM jsonb_array_elements(get_overlapping_availabilities(a, b)) elem
    ORDER BY (elem->>'day'), (elem->>'startTime')
    LIMIT 1;

    -- Normalize it to EST
    normalized := normalize_availability(ARRAY[first_overlap], 'America/New_York');

    RETURN normalized;
END;
$function$
