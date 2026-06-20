CREATE OR REPLACE FUNCTION public.availability_to_slots(availabilities jsonb[], tz text)
 RETURNS TABLE(day text, start_ts timestamp with time zone, end_ts timestamp with time zone)
 LANGUAGE sql
AS $function$
WITH unnested AS (
  SELECT unnest(availabilities) AS elem
),
expanded AS (
  SELECT
    elem->>'day' AS day,
    elem->>'startTime' AS start_time_txt,
    elem->>'endTime'   AS end_time_txt
  FROM unnested
),
with_dates AS (
  SELECT
    day,
    start_time_txt,
    end_time_txt,
    (
      CURRENT_DATE
      + (
          CASE
            WHEN day ILIKE 'Sunday'    THEN 0
            WHEN day ILIKE 'Monday'    THEN 1
            WHEN day ILIKE 'Tuesday'   THEN 2
            WHEN day ILIKE 'Wednesday' THEN 3
            WHEN day ILIKE 'Thursday'  THEN 4
            WHEN day ILIKE 'Friday'    THEN 5
            WHEN day ILIKE 'Saturday'  THEN 6
          END
          - extract(dow from CURRENT_DATE)::int
          + 7
        ) % 7
        + CASE
            WHEN (
              (CASE
                WHEN day ILIKE 'Sunday'    THEN 0
                WHEN day ILIKE 'Monday'    THEN 1
                WHEN day ILIKE 'Tuesday'   THEN 2
                WHEN day ILIKE 'Wednesday' THEN 3
                WHEN day ILIKE 'Thursday'  THEN 4
                WHEN day ILIKE 'Friday'    THEN 5
                WHEN day ILIKE 'Saturday'  THEN 6
              END) = extract(dow from CURRENT_DATE)::int
            )
            THEN 7 ELSE 0
          END
    ) AS next_date
  FROM expanded
)
SELECT
  day,
  ((next_date::text || ' ' || start_time_txt)::timestamp AT TIME ZONE tz)::timestamptz AS start_ts,
  ((next_date::text || ' ' || end_time_txt)::timestamp AT TIME ZONE tz)::timestamptz AS end_ts
FROM with_dates;
$function$
