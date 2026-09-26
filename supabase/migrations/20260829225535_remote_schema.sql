create extension if not exists "pg_cron" with schema "pg_catalog";

drop extension if exists "pg_net";

drop policy "Enable insert for authenticated users only" on "public"."user_notification_settings";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public."Automatic create settings for new profiles"()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$BEGIN
    INSERT INTO public.user_notification_settings DEFAULT VALUES
    RETURNING id INTO NEW.settings_id;
    RETURN NEW;
END;$function$
;

CREATE OR REPLACE FUNCTION public."Automatically_create_pairing_from_enrollments"()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$DECLARE
  pairing_uuid UUID;
BEGIN
  -- Try to find an existing pairing
  SELECT p.id
  INTO pairing_uuid
  FROM public."Pairings" p
  WHERE p.student_id = NEW.student_id
    AND p.tutor_id = NEW.tutor_id
  LIMIT 1;

  -- If not found, insert a new pairing
  IF pairing_uuid IS NULL THEN
    INSERT INTO public."Pairings"(student_id, tutor_id)
    VALUES (NEW.student_id, NEW.tutor_id)
    RETURNING id INTO pairing_uuid;
  END IF;

  -- Set the enrollment's pairing_id
  NEW.pairing_id := pairing_uuid;

  RETURN NEW;
END;$function$
;

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
;

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
;

CREATE OR REPLACE FUNCTION public.get_admin_conversations()
 RETURNS TABLE(conversation_id uuid, created_at timestamp with time zone, participants json)
 LANGUAGE sql
AS $function$
    SELECT 
        c.id,
        c.created_at,
        json_agg(
            json_build_object(
                'id', p.id,
                'first_name', p.first_name,
                'last_name', p.last_name
            )
        ) AS participants
    FROM conversations c
    JOIN conversation_participant cp 
        ON cp.conversation_id = c.id
    JOIN public."Profiles" p 
        ON p.id = cp.profile_id
    WHERE c.admin_conversation = true
    GROUP BY c.id, c.created_at
    ORDER BY c.created_at DESC;
$function$
;

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
;

CREATE OR REPLACE FUNCTION public.get_all_event_hours(input_user_id text)
 RETURNS real
 LANGUAGE plpgsql
AS $function$BEGIN
RETURN (
  SELECT COALESCE(SUM(hours), 0)
  FROM "Events"
  WHERE tutor_id::text = input_user_id
);
END;$function$
;

CREATE OR REPLACE FUNCTION public.get_all_event_hours_batch()
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
    SELECT jsonb_object_agg(
      tutor_id::text,
      type_hours
    )
    FROM tutor_type_hours
  );
END;$function$
;

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
;

CREATE OR REPLACE FUNCTION public.get_all_hours_batch()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$BEGIN
  RETURN (
    SELECT jsonb_object_agg(
      at.tutor_id::text,
      COALESCE(st.session_hours, 0) + COALESCE(et.event_hours, 0)
    )
    FROM (
      SELECT DISTINCT tutor_id FROM (
        SELECT tutor_id FROM "Sessions"
        WHERE status = 'Complete' AND tutor_id is not null
        UNION
        SELECT tutor_id FROM "Events"
      ) t
    ) at 
    LEFT JOIN (
      SELECT tutor_id, SUM(duration) as session_hours
      FROM "Sessions"
      WHERE status = 'Complete' AND tutor_id is not null
      GROUP BY tutor_id
    ) st ON at.tutor_id = st.tutor_id
    LEFT JOIN (
      SELECT tutor_id, SUM(hours) as event_hours
      FROM "Events"
      WHERE tutor_id is not null
      GROUP BY tutor_id
    ) et ON at.tutor_id = et.tutor_id
  );
END;$function$
;

CREATE OR REPLACE FUNCTION public.get_all_session_hours(input_user_id text)
 RETURNS real
 LANGUAGE plpgsql
AS $function$BEGIN
  RETURN (
    SELECT COALESCE(SUM(duration), 0)
    FROM "Sessions"
    WHERE tutor_id::text = input_user_id AND status = 'Complete'
  );
END;$function$
;

CREATE OR REPLACE FUNCTION public.get_all_session_hours_batch()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$BEGIN
RETURN (
  SELECT COALESCE(
    jsonb_object_agg(
      tutor_id::text,
      total_hours
    ),
    '{}'::jsonb
  )
  FROM (
    SELECT tutor_id, SUM(duration) as total_hours
    FROM "Sessions"
    WHERE status = 'Complete'
    GROUP BY tutor_id
  ) final
);
END;$function$
;

CREATE OR REPLACE FUNCTION public.get_all_session_hours_with_student(input_tutor_id text, input_student_id text)
 RETURNS real
 LANGUAGE plpgsql
AS $function$BEGIN
  RETURN (
    SELECT COALESCE(SUM(duration), 0)
    FROM "Sessions"
    WHERE tutor_id::text = input_tutor_id 
      AND student_id::text = input_student_id 
      AND status = 'Complete'
  );
END;$function$
;

CREATE OR REPLACE FUNCTION public.get_best_pairing_match(request_type text, request_id uuid, profile_id uuid, embedding public.vector, availability jsonb)
 RETURNS TABLE(pairing_request_id uuid, matched_profile_id uuid, similarity double precision)
 LANGUAGE plpgsql
AS $function$-- BEGIN
--     RETURN QUERY
--     SELECT
--         pr.id AS pairing_request_id,
--         p.id AS matched_profile_id,
--         1 - (p.subject_embed <#> embedding) AS similarity
--     FROM pairing_requests pr
--     JOIN "Profiles" p ON pr.profile_id = p.id
--     WHERE pr.type <> request_type                -- must be opposite type
--       AND pr.status = 'pending'                  -- only pending requests
--     --   AND p.subject_embed IS NOT NULL            -- must have  embeddings
--       AND availability_overlap(p.availability, availability)
--       AND EXISTS (                               -- ensure profile has a pending request
--           SELECT 1
--           FROM pairing_requests pr2
--           WHERE pr2.profile_id = p.id
--             AND pr2.type = pr.type
--             AND pr2.status = 'pending'
--       )
--     ORDER BY
--         pr.priority DESC,                        -- higher priority first
--         pr.created_at ASC,                       -- earlier requests first
--         p.subject_embed <#> embedding ASC        -- closest semantic match
--     LIMIT 1;
-- END;

DECLARE
    current_profile_id UUID;
    current_embedding vector(384);
BEGIN
    -- Lookup requestor's profile and embedding
    SELECT pr.user_id, p.subject_embed
    INTO current_profile_id, current_embedding
    FROM pairing_requests pr
    JOIN "Profiles" p ON pr.user_id = p.id
    WHERE pr.id = request_id
      AND pr.status = 'pending';

    -- Exit if no pending request
    IF current_profile_id IS NULL THEN
        RETURN;
    END IF;

    -- Find best match from opposite type
    RETURN QUERY
    WITH requestor_raw_slots AS (
        SELECT day, start_ts, end_ts
        FROM availability_to_slots(
            (SELECT availability FROM "Profiles" WHERE id = current_profile_id),
            COALESCE(NULLIF((SELECT timezone FROM "Profiles" WHERE id = current_profile_id), ''), 'EST')
        )
    ),
    requestor_slots AS (
        SELECT jsonb_agg(jsonb_build_object('start_ts', start_ts, 'end_ts', end_ts)) AS slots
        FROM requestor_raw_slots
    ),
    candidate_requests AS (
        SELECT 
            cr.id,
            cr.user_id,
            cr.type,
            cr.status,
            cr.priority,
            cr.created_at,
            p.availability AS availability,
            p.timezone AS timezone,
            p.id AS profile_id,
            p.email,
            p.first_name,
            p.last_name,
            p.role,
            p.subject_embed
        FROM pairing_requests cr
        JOIN "Profiles" p ON cr.user_id = p.id
        WHERE cr.type <> request_type
          AND cr.status = 'pending'
          -- NOTE: removed "AND p.subject_embed IS NOT NULL"
    ),
    candidate_raw_slots AS (
        SELECT cr.id AS cr_id, day, start_ts, end_ts
        FROM candidate_requests cr
        CROSS JOIN LATERAL availability_to_slots(cr.availability, COALESCE(NULLIF(cr.timezone, ''), 'EST'))
    ),
    candidate_slots AS (
        SELECT cr_id, jsonb_agg(jsonb_build_object('start_ts', start_ts, 'end_ts', end_ts)) AS slots
        FROM candidate_raw_slots
        GROUP BY cr_id
    ),
    scored_candidates AS (
        SELECT
            cr.*,
            cs.slots,
            CASE
                WHEN cr.subject_embed IS NULL OR current_embedding IS NULL
                    THEN NULL
                ELSE 1 - (cr.subject_embed <=> current_embedding)
            END AS similarity,
            CASE 
                WHEN cr.subject_embed IS NULL THEN 1
                ELSE 0
            END AS no_embedding_flag
        FROM candidate_requests cr
        JOIN candidate_slots cs ON cs.cr_id = cr.id
    )
    SELECT
        sc.id AS pairing_request_id,
        sc.similarity,
        jsonb_build_object(
            'id', sc.profile_id,
            'email', sc.email,
            'user_id', sc.user_id,
            'first_name', sc.first_name,
            'last_name', sc.last_name,
            'role', sc.role
        ) AS match_profile,
        jsonb_build_object(
            'id', rp.id,
            'email', rp.email,
            'user_id', rp.user_id,
            'first_name', rp.first_name,
            'last_name', rp.last_name,
            'role', rp.role
        ) AS requestor_profile
    FROM scored_candidates sc
    CROSS JOIN "Profiles" rp
    CROSS JOIN requestor_slots rs
    WHERE rp.id = current_profile_id
      AND availability_overlap(sc.slots, rs.slots)
    ORDER BY
        sc.no_embedding_flag ASC,         -- candidates WITH embeddings first
        sc.priority DESC,
        sc.created_at ASC,
        sc.similarity DESC NULLS LAST     -- best embedding matches first
    LIMIT 1;
END;$function$
;

CREATE OR REPLACE FUNCTION public.get_client_admin_conversations(profile_id uuid)
 RETURNS TABLE(conversation_id uuid, participants json)
 LANGUAGE sql
AS $function$
    SELECT 
        c.id AS conversation_id,
        json_agg(
            json_build_object(
                'id', p.id,
                'first_name', p.first_name,
                'last_name', p.last_name
            )
        ) FILTER (WHERE p.id <> get_client_admin_conversations.profile_id) AS participants
    FROM conversations c
    JOIN conversation_participant cp_self 
        ON cp_self.conversation_id = c.id
       AND cp_self.profile_id = get_client_admin_conversations.profile_id
    JOIN conversation_participant cp 
        ON cp.conversation_id = c.id
    JOIN public."Profiles" p 
        ON p.id = cp.profile_id
    WHERE c.admin_conversation = true
    GROUP BY c.id
    ORDER BY c.id DESC;
$function$
;

CREATE OR REPLACE FUNCTION public.get_enrollment_with_profiles(enrollment_uuid uuid)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, student_id uuid, tutor_id uuid, summary text, start_date date, end_date date, availability jsonb, meetingid uuid, summer_paused boolean, duration integer, student jsonb, tutor jsonb)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.created_at,
    e.student_id,
    e.tutor_id,
    e.summary,
    e.start_date::date,
    e.end_date::date,
    e.availability,
    e."meetingId",
    e.summer_paused,
    e.duration::integer,

    jsonb_build_object(
      'id', sp.id,
      'user_id', sp.user_id,
      'first_name', sp.first_name,
      'last_name', sp.last_name,
      'email', sp.email
    ) AS student,

    jsonb_build_object(
      'id', tp.id,
      'user_id', tp.user_id,
      'first_name', tp.first_name,
      'last_name', tp.last_name,
      'email', tp.email
    ) AS tutor

  FROM public."Enrollments" e
  LEFT JOIN public."Profiles" sp ON sp.id = e.student_id
  LEFT JOIN public."Profiles" tp ON tp.id = e.tutor_id
  WHERE e.id = enrollment_uuid;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_enrollments_with_student_profile()
 RETURNS TABLE(id uuid, created_at timestamp with time zone, student_id uuid, tutor_id uuid, summary text, start_date date, end_date date, availability jsonb, meetingid uuid, summer_paused boolean, duration integer, profile_id uuid, profile_user_id uuid, first_name text, last_name text, email text)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.created_at,
    e.student_id,
    e.tutor_id,
    e.summary,
    e.start_date,
    e.end_date,
    e.availability,
    e."meetingId",
    e.summer_paused,
    e.duration,

    p.id AS profile_id,
    p.user_id AS profile_user_id,
    p.first_name,
    p.last_name,
    p.email
  FROM public."Enrollments" e
  LEFT JOIN public."Profiles" p ON p.id = e.student_id
  ORDER BY e.created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_event_hours_range(input_user_id text, input_start_date timestamp with time zone, input_end_date timestamp with time zone)
 RETURNS real
 LANGUAGE plpgsql
AS $function$BEGIN
RETURN (
  SELECT COALESCE(SUM(hours), 0)
  FROM "Events"
  WHERE tutor_id::text = input_user_id
    AND date > input_start_date
    AND date < input_end_date
);
END$function$
;

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
;

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
;

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
;

CREATE OR REPLACE FUNCTION public.get_hours_range_batch(start_date timestamp with time zone, end_date timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$BEGIN
RETURN (
  SELECT COALESCE(
    jsonb_object_agg(
      tutor_id::text,
      total_hours
    ),
    '{}'::jsonb
  ) 
  FROM (
    SELECT 
      tutor_id,
      SUM(hours) as total_hours
    FROM (
      SELECT tutor_id, duration as hours
      FROM "Sessions"
      WHERE status = 'Complete'
        AND start_date <= date
        AND end_date >= date
      
      UNION ALL
      
      SELECT tutor_id, hours
      FROM "Events"
      WHERE date >= start_date
        AND date <= end_date
    ) combined
    GROUP BY tutor_id
  ) final
);
END;$function$
;

CREATE OR REPLACE FUNCTION public.get_monthly_session_completion_stats()
 RETURNS TABLE(month date, total_completed bigint, total_resolved bigint, pct_completed numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select period, total_completed, total_resolved, pct_completed
  from get_period_session_completion_stats('month');
$function$
;

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
;

CREATE OR REPLACE FUNCTION public.get_pairing_logs(start_time timestamp with time zone, end_time timestamp with time zone)
 RETURNS TABLE(id uuid, type text, profile jsonb, match_profile jsonb, message text, status text, created_at timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        pl.id,
        pl.type,
        -- profile JSON via pairing_request_id -> pairing_requests.user_id -> Profiles
        CASE
            WHEN pl.metadata ? 'pairing_request_id' THEN (
                SELECT jsonb_build_object(
                    'id', p.id,
                    'email', p.email,
                    'user_id', p.user_id,
                    'first_name', p.first_name,
                    'last_name', p.last_name,
                    'role', p.role
                )
                FROM pairing_requests pr
                JOIN "Profiles" p ON pr.user_id = p.id
                WHERE pr.id = (pl.metadata->>'pairing_request_id')::uuid
            )
            ELSE NULL
        END AS profile,
        -- match_profile JSON only if match_profile_id exists
        CASE
            WHEN pl.metadata ? 'match_profile_id' THEN (
                SELECT jsonb_build_object(
                    'id', mp.id,
                    'email', mp.email,
                    'user_id', mp.user_id,
                    'first_name', mp.first_name,
                    'last_name', mp.last_name,
                    'role', mp.role
                )
                FROM "Profiles" mp
                WHERE mp.id = (pl.metadata->>'match_profile_id')::uuid
            )
            ELSE NULL
        END AS match_profile,
        pl.message,
        CASE 
            WHEN pl.error = TRUE THEN 'error'
            ELSE 'ok'
        END AS status,
        pl.created_at
    FROM pairing_logs pl
    WHERE pl.created_at BETWEEN start_time AND end_time
    ORDER BY pl.created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_pairing_match(match_id uuid)
 RETURNS TABLE(pairing_match_id uuid, student_id uuid, tutor_id uuid, created_at timestamp with time zone, student jsonb, tutor jsonb)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        pm.id AS pairing_match_id,
        pm.student_id,
        pm.tutor_id,
        pm.created_at,

        -- Student JSON
        jsonb_build_object(
            'id', sp.id,
            'first_name', sp.first_name,
            'last_name', sp.last_name,
            'gender', sp.gender,
            'role', 'student',
            'availability', sp.availability,
            'subjectsOfInterest', sp.subjects_of_interest,
            'languagesSpoken', sp.languages_spoken
        ) AS student,

        -- Tutor JSON
        jsonb_build_object(
            'id', tp.id,
            'first_name', tp.first_name,
            'last_name', tp.last_name,
            'gender', tp.gender,
            'role', 'tutor',
            'availability', tp.availability,
            'subjectsOfInterest', tp.subjects_of_interest,
            'languagesSpoken', tp.languages_spoken
        ) AS tutor

    FROM pairing_matches pm
    LEFT JOIN "Profiles" sp ON sp.id = pm.student_id
    LEFT JOIN "Profiles" tp ON tp.id = pm.tutor_id
    WHERE pm.id = match_id
    LIMIT 1;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_pairing_requests_with_profiles(requestor uuid)
 RETURNS TABLE(pairing_request_id uuid, status text, student_id uuid, tutor_id uuid, created_at timestamp without time zone, updated_at timestamp without time zone, student jsonb, tutor jsonb)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        pr.id,
        pr.status,
        pr.student_id,
        pr.tutor_id,
        pr.created_at,
        pr.updated_at,
        jsonb_build_object(
            'firstName', sp.first_name,
            'lastName', sp.last_name,
            'role', 'student'
        ) AS student,
        jsonb_build_object(
            'firstName', tp.first_name,
            'lastName', tp.last_name,
            'role', 'tutor'
        ) AS tutor
    FROM pairing_requests pr
    LEFT JOIN profiles sp ON sp.id = pr.student_id
    LEFT JOIN profiles tp ON tp.id = pr.tutor_id
    WHERE pr.student_id = requestor OR pr.tutor_id = requestor
    ORDER BY pr.created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_pairing_with_profiles(pairing_uuid uuid)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, student_id uuid, tutor_id uuid, student jsonb, tutor jsonb)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.created_at,
    e.student_id,
    e.tutor_id,

    jsonb_build_object(
      'id', sp.id,
      'user_id', sp.user_id,
      'first_name', sp.first_name,
      'last_name', sp.last_name,
      'email', sp.email
    ) AS student,

    jsonb_build_object(
      'id', tp.id,
      'user_id', tp.user_id,
      'first_name', tp.first_name,
      'last_name', tp.last_name,
      'email', tp.email
    ) AS tutor

  FROM public."Pairings" e
  LEFT JOIN public."Profiles" sp ON sp.id = e.student_id
  LEFT JOIN public."Profiles" tp ON tp.id = e.tutor_id
  WHERE e.id = pairing_uuid;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_session_hours_by_student(p_tutor_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$BEGIN
  RETURN (
    SELECT COALESCE(json_agg(
      json_build_object(
        'studentId', t.student_id,
        'firstName', COALESCE(t.first_name, 'Previous Students'),
        'lastName', COALESCE(t.last_name, ''),
        'hours', t.total_duration
      )
    )::jsonb, '{}'::jsonb)
    FROM (
      SELECT s.student_id, sp.first_name, sp.last_name, SUM(s.duration) as total_duration
      FROM "Sessions" s
      LEFT JOIN "Profiles" sp ON s.student_id = sp.id
      WHERE s.tutor_id::text = p_tutor_id
        AND s.status = 'Complete'
      GROUP BY s.student_id, sp.first_name, sp.last_name
    ) t
  );
END;$function$
;

CREATE OR REPLACE FUNCTION public.get_session_hours_range(input_tutor_id text, input_start_date timestamp with time zone, input_end_date timestamp with time zone)
 RETURNS real
 LANGUAGE plpgsql
AS $function$BEGIN
RETURN (
  SELECT COALESCE(SUM(duration), 0)
  FROM "Sessions"
  WHERE tutor_id::text = input_tutor_id
    AND status = 'Complete'
    AND date >= input_start_date
    AND date <= input_end_date
);
END;$function$
;

CREATE OR REPLACE FUNCTION public.get_session_hours_range_batch(start_date timestamp with time zone, end_date timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$BEGIN
RETURN (
  SELECT COALESCE( 
    jsonb_object_agg(
      t.tutor_id::text,
      hours
    ),
    '{}'::jsonb
  )
  FROM (
    SELECT tutor_id, SUM(duration) as hours
    FROM "Sessions"
    WHERE status = 'Complete'
      AND start_date <= date
      AND end_date >= date
    GROUP BY tutor_id
  ) t
);
END;$function$
;

CREATE OR REPLACE FUNCTION public.get_session_hours_range_with_student(input_tutor_id text, input_student_id text, input_start_date timestamp with time zone, input_end_date timestamp with time zone)
 RETURNS real
 LANGUAGE plpgsql
AS $function$BEGIN
RETURN (
  SELECT COALESCE(SUM(duration), 0)
  FROM "Sessions"
  WHERE tutor_id::text = input_tutor_id
    AND student_id::text = input_student_id
    AND status = 'Complete'
    AND date >= input_start_date
    AND date <= input_end_date
);

END;$function$
;

CREATE OR REPLACE FUNCTION public.get_top_pairing_request(request_type text)
 RETURNS TABLE(pairing_request_id uuid, profile_id uuid, embedding public.vector)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT pr.id AS pairing_request_id,
           pr.user_id,
           p.subject_embed
    FROM pairing_requests pr
    JOIN "Profiles" p ON pr.user_id = p.id
    WHERE pr.type = request_type
    ORDER BY pr.priority DESC, pr.created_at ASC;
END;
$function$
;

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
;

CREATE OR REPLACE FUNCTION public.get_total_hours()
 RETURNS real
 LANGUAGE plpgsql
AS $function$BEGIN
RETURN (
  SELECT session_hours + event_hours
  FROM (
    SELECT SUM(duration) as session_hours
    FROM "Sessions"
      WHERE status = 'Complete'
  ) as session_data
  CROSS JOIN (
    SELECT SUM(hours) as event_hours
    FROM "Events"
  ) as event_data
);
END;$function$
;

CREATE OR REPLACE FUNCTION public.get_total_hours_range(start_date timestamp with time zone, end_date timestamp with time zone)
 RETURNS real
 LANGUAGE plpgsql
AS $function$BEGIN
RETURN (
  SELECT COALESCE(session_hours, 0) + COALESCE(event_hours, 0)
  FROM (
    SELECT SUM(duration) as session_hours
    FROM "Sessions"
    WHERE date >= start_date
      AND date <= end_date
      AND status = 'Complete'
  ) as session_data
  CROSS JOIN (
    SELECT SUM(hours) as event_hours
    FROM "Events"
    WHERE date >= start_date
      AND date <= end_date
  ) as event_data
);
END;$function$
;

CREATE OR REPLACE FUNCTION public.get_total_session_hours_range(start_date timestamp with time zone, end_date timestamp with time zone)
 RETURNS real
 LANGUAGE plpgsql
AS $function$BEGIN
RETURN (
  SELECT COALESCE(SUM(duration), 0) 
  FROM "Sessions"
  WHERE "date" >= start_date
    AND "date" <= end_date
    AND status = 'Complete'
);
END;$function$
;

CREATE OR REPLACE FUNCTION public.get_tutor_sessions(p_start_date text, p_end_date text)
 RETURNS TABLE(tutor_id uuid, first_name text, last_name text, total_sessions bigint, session_dates jsonb)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    b.id as tutor_id,
    b.first_name,
    b.last_name,
    COUNT(a.id) AS total_sessions,
    jsonb_agg(a.date ORDER BY a.date) AS session_dates
  FROM "Sessions" a
  LEFT JOIN "Profiles" b ON a.tutor_id = b.id
  WHERE
    a.status = 'Complete' AND
    a.date >= p_start_date::TIMESTAMPTZ AND
    a.date < p_end_date::TIMESTAMPTZ
  GROUP BY b.id, b.first_name, b.last_name
  ORDER BY b.first_name;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_tutor_sessions_with_date(p_start_date text, p_end_date text)
 RETURNS TABLE(tutor_id uuid, first_name text, last_name text, total_sessions bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    b.id as tutor_id,
    b.first_name,
    b.last_name,
    COUNT(a.id) AS total_sessions,
    jsonb_agg(a.date ORDER BY a.date) AS session_dates
  FROM "Sessions" a
  LEFT JOIN "Profiles" b ON a.tutor_id = b.id
  WHERE
    a.status = 'Complete' AND
    a.date >= p_start_date AND
    a.date < p_end_date
  GROUP BY b.id, b.first_name, b.last_name
  ORDER BY b.first_name;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_enrollments(input_user_id uuid)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, student_id uuid, tutor_id uuid, summary text, start_date timestamp with time zone, end_date timestamp with time zone, availability jsonb, "meetingId" uuid, summer_paused boolean, duration real, profile_id uuid, profile_user_id uuid, profile_name text, profile_email text)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$SELECT 
    e.id,
    e.created_at,
    e.student_id,
    e.tutor_id,
    e.summary,
    e.start_date,
    e.end_date,
    e.availability,
    e."meetingId",
    e.summer_paused,
    e.duration,
    
    p.id as profile_id,
    p.user_id as profile_user_id,
    p.first_name as profile_name,
    p.email as profile_email
    -- Add other profile columns you need
  FROM public."Enrollments" e
  LEFT JOIN public."Profiles" p ON p.user_id = input_user_id
  WHERE e.tutor_id = p.id OR e.student_id = p.id
  ORDER BY e.created_at DESC;$function$
;

CREATE OR REPLACE FUNCTION public.get_user_enrollments_with_profiles(requestor_auth_id uuid)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, summary text, start_date date, end_date date, availability jsonb, meetingid uuid, summer_paused boolean, duration integer, student jsonb, tutor jsonb)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.created_at,
    e.summary,
    e.start_date::date,
    e.end_date::date,
    e.availability,
    e."meetingId",
    e.summer_paused,
    e.duration::integer,

    -- Student JSON object
    jsonb_build_object(
      'id', sp.id,
      'user_id', sp.user_id,
      'first_name', sp.first_name,
      'last_name', sp.last_name,
      'email', sp.email
    ) AS student,

    -- Tutor JSON object
    jsonb_build_object(
      'id', tp.id,
      'user_id', tp.user_id,
      'first_name', tp.first_name,
      'last_name', tp.last_name,
      'email', tp.email
    ) AS tutor

  FROM public."Enrollments" e
  JOIN public."Profiles" req_profile ON req_profile.user_id = requestor_auth_id
  LEFT JOIN public."Profiles" sp ON sp.id = e.student_id
  LEFT JOIN public."Profiles" tp ON tp.id = e.tutor_id
  WHERE e.student_id = req_profile.id OR e.tutor_id = req_profile.id
  ORDER BY e.created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_enrollments_with_student_profile(requestor_auth_id uuid)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, student_id uuid, tutor_id uuid, summary text, start_date date, end_date date, availability jsonb, meetingid uuid, summer_paused boolean, duration integer, student_profile_id uuid, student_user_id uuid, student_first_name text, student_last_name text, student_email text)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.created_at,
    e.student_id,
    e.tutor_id,
    e.summary,
    e.start_date::date,
    e.end_date::date,
    e.availability,
    e."meetingId",
    e.summer_paused,
    e.duration::integer,

    sp.id AS student_profile_id,
    sp.user_id AS student_user_id,
    sp.first_name AS student_first_name,
    sp.last_name AS student_last_name,
    sp.email AS student_email

  FROM public."Enrollments" e
  JOIN public."Profiles" req_profile ON req_profile.user_id = requestor_auth_id
  LEFT JOIN public."Profiles" sp ON sp.id = e.student_id
  WHERE e.student_id = req_profile.id OR e.tutor_id = req_profile.id
  ORDER BY e.created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_pairings_with_profiles(requestor_auth_id uuid)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, student_id uuid, tutor_id uuid, student jsonb, tutor jsonb)
 LANGUAGE sql
AS $function$
  SELECT 
    e.id,
    e.created_at,
    e.student_id,
    e.tutor_id,
    jsonb_build_object(
      'id', sp.id,
      'user_id', sp.user_id,
      'first_name', sp.first_name,
      'last_name', sp.last_name,
      'email', sp.email
    ) AS student,
    jsonb_build_object(
      'id', tp.id,
      'user_id', tp.user_id,
      'first_name', tp.first_name,
      'last_name', tp.last_name,
      'email', tp.email
    ) AS tutor
  FROM public."Pairings" e
  JOIN public."Profiles" req_profile 
    ON req_profile.user_id = requestor_auth_id
  LEFT JOIN public."Profiles" sp ON sp.id = e.student_id
  LEFT JOIN public."Profiles" tp ON tp.id = e.tutor_id
  WHERE e.student_id = req_profile.id 
     OR e.tutor_id = req_profile.id
  ORDER BY e.created_at DESC;
$function$
;

CREATE OR REPLACE FUNCTION public.insert_pairing_from_matches()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.tutor_status = 'accepted' THEN
    INSERT INTO public."Pairings"(student_id, tutor_id)
    VALUES (NEW.student_id, NEW.tutor_id);
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.insert_pairing_from_pairing_matches_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
IF OLD.status != NEW.status AND NEW.status = 'accepted' THEN
  INSERT INTO public."Pairings"(student_id, tutor_id)
  VALUES (NEW.student_id, NEW.tutor_id);
END IF;
RETURN NEW;
END;
$function$
;

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
;

CREATE OR REPLACE FUNCTION public.normalize_availability(avail jsonb[], tz text)
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
        FROM unnest(avail) AS j(jsonb_val)
        CROSS JOIN LATERAL jsonb_to_record(j.jsonb_val)
            AS a(day TEXT, startTime TEXT, endTime TEXT)
    );

    RETURN normalized;
END;
$function$
;


  create policy "Enable insert for authenticated users only"
  on "public"."user_notification_settings"
  as permissive
  for insert
  to authenticated, anon, service_role, postgres
with check (true);



  create policy "Authenticated Upload  r2ougb_0"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check ((bucket_id = 'enrollment-chat-files'::text));



  create policy "Give anon users access to JPG images in folder 4mtz9_0"
  on "storage"."objects"
  as permissive
  for select
  to public
using (((bucket_id = 'worksheets'::text) AND (storage.extension(name) = 'jpg'::text) AND (lower((storage.foldername(name))[1]) = 'public'::text) AND (auth.role() = 'anon'::text)));



  create policy "Give anon users access to JPG images in folder r2ougb_0"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'enrollment-chat-files'::text) AND (storage.extension(name) = 'jpg'::text) AND (lower((storage.foldername(name))[1]) = 'public'::text) AND (auth.role() = 'anon'::text)));



  create policy "Give users authenticated access to folder 13291w5_0"
  on "storage"."objects"
  as permissive
  for select
  to authenticated, service_role
using (((bucket_id = 'connect-me-data-analytics'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder 4mtz9_0"
  on "storage"."objects"
  as permissive
  for select
  to public
using (((bucket_id = 'worksheets'::text) AND ((storage.foldername(name))[1] = 'private'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder 4mtz9_1"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'worksheets'::text) AND ((storage.foldername(name))[1] = 'private'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder 4mtz9_2"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'worksheets'::text) AND ((storage.foldername(name))[1] = 'private'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder 4mtz9_3"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'worksheets'::text) AND ((storage.foldername(name))[1] = 'private'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "authenticated can list worksheets"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using ((bucket_id = 'worksheets'::text));



