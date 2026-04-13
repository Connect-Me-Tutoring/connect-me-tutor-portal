CREATE OR REPLACE FUNCTION public.availability_overlap(slots1 jsonb, slots2 jsonb)
 RETURNS boolean
 LANGUAGE sql
AS $function$
SELECT EXISTS (
    SELECT 1
    FROM (
        SELECT 
            (slot1->>'start_ts')::timestamptz AS start1,
            (slot1->>'end_ts')::timestamptz AS end1
        FROM jsonb_array_elements(slots1) AS slot1
    ) s1
    CROSS JOIN (
        SELECT 
            (slot2->>'start_ts')::timestamptz AS start2,
            (slot2->>'end_ts')::timestamptz AS end2
        FROM jsonb_array_elements(slots2) AS slot2
    ) s2
    WHERE s1.start1 < s2.end2 AND s1.end1 > s2.start2
);
$function$
