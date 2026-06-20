CREATE OR REPLACE FUNCTION public.get_overlapping_availabilities_array(a jsonb[], b jsonb[])
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
BEGIN
RETURN (
  SELECT jsonb_agg(
    jsonb_build_object(
      'day', a1.day,
      'startTime', GREATEST(a1.startTime, b1.startTime),
      'endTime', LEAST(a1.endTime, b1.endTime)
    )
  )
  FROM (
    SELECT (elem->>'day')::Text as day,
          (elem ->> 'startTime')::TIME as startTime,
          (elem->>'endTime')::TIME as endTime
        FROM unnest(a) AS elem
  ) as a1,
  (
    SELECT (elem->>'day')::TEXT as day,
            (elem->>'startTime')::TIME as startTime,
            (elem->>'endTime')::TIME as endTime
    FROM unnest(b) AS elem
  ) as b1
  WHERE a1.day = b1.day
    AND a1.startTime < b1.endTime
    AND a1.endTime > b1.startTime
);
END;
$function$
