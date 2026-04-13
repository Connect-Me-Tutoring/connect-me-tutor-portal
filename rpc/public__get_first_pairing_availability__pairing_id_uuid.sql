CREATE OR REPLACE FUNCTION public.get_first_pairing_availability(pairing_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    student_slots JSONB[];
    tutor_slots   JSONB[];
    first_overlap JSONB;
    normalized    JSONB;
BEGIN
    -- Pull raw availability and timezone for both student and tutor
    SELECT 
        availability_to_slots(s.availability, COALESCE(NULLIF(s.timezone, ''), 'EST')),
        availability_to_slots(t.availability, COALESCE(NULLIF(t.timezone, ''), 'EST'))
    INTO student_slots, tutor_slots
    FROM "Pairings" p
    JOIN "Profiles" s ON p.student_id = s.id
    JOIN "Profiles" t ON p.tutor_id = t.id
    WHERE p.id = pairing_id;

    -- Null check: if either side has no slots, return null
    IF student_slots IS NULL OR tutor_slots IS NULL THEN
        RETURN NULL;
    END IF;

    -- Get first overlap from normalized slots
    SELECT elem
    INTO first_overlap
    FROM jsonb_array_elements(
             get_overlapping_availabilities_array(student_slots, tutor_slots)
         ) elem
    ORDER BY (elem->>'day'), (elem->>'startTime')
    LIMIT 1;

    -- If no overlap exists, return null
    IF first_overlap IS NULL THEN
        RETURN NULL;
    END IF;

    -- Normalize result to EST (optional: slots already in proper timezone)
    normalized := normalize_availability(ARRAY[first_overlap], 'EST');

    RETURN normalized;
END;
$function$
