

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";

CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."day_of_the_week" AS ENUM (
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday'
);


ALTER TYPE "public"."day_of_the_week" OWNER TO "postgres";


COMMENT ON TYPE "public"."day_of_the_week" IS 'days of the week in ints (0-6)';



CREATE TYPE "public"."day_of_week" AS ENUM (
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday'
);


ALTER TYPE "public"."day_of_week" OWNER TO "postgres";


CREATE TYPE "public"."event_type" AS ENUM (
    'Sub Hotline',
    'Tutor Referral',
    'Additional Tutoring Hours',
    'School Tutoring',
    'Biweekly Meeting',
    'Other'
);


ALTER TYPE "public"."event_type" OWNER TO "postgres";


CREATE TYPE "public"."pairing_status" AS ENUM (
    'pending',
    'accepted',
    'rejected'
);


ALTER TYPE "public"."pairing_status" OWNER TO "postgres";


CREATE TYPE "public"."session_frequency" AS ENUM (
    'weekly',
    'biweekly',
    'monthly'
);


ALTER TYPE "public"."session_frequency" OWNER TO "postgres";


COMMENT ON TYPE "public"."session_frequency" IS 'frequency of tutoring sessions';



CREATE TYPE "public"."session_status" AS ENUM (
    'Active',
    'Complete',
    'Cancelled',
    'Rescheduled',
    'Sub-Request',
    'Expired',
    'Standalone',
    'Unsubmitted',
    'Unconfirmed'
);


ALTER TYPE "public"."session_status" OWNER TO "postgres";


COMMENT ON TYPE "public"."session_status" IS 'Status of the session';



CREATE TYPE "public"."timezone" AS ENUM (
    'EST',
    'CST',
    'PST',
    'MST',
    'MT',
    'Other'
);


ALTER TYPE "public"."timezone" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."Automatic create settings for new profiles"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$BEGIN
    INSERT INTO public.user_notification_settings DEFAULT VALUES
    RETURNING id INTO NEW.settings_id;
    RETURN NEW;
END;$$;


ALTER FUNCTION "public"."Automatic create settings for new profiles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."Automatically_create_pairing_from_enrollments"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$DECLARE
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
END;$$;


ALTER FUNCTION "public"."Automatically_create_pairing_from_enrollments"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."availability_overlap"("slots1" "jsonb", "slots2" "jsonb") RETURNS boolean
    LANGUAGE "sql"
    AS $$
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
$$;


ALTER FUNCTION "public"."availability_overlap"("slots1" "jsonb", "slots2" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."availability_to_slots"("availabilities" "jsonb"[], "tz" "text") RETURNS TABLE("day" "text", "start_ts" timestamp with time zone, "end_ts" timestamp with time zone)
    LANGUAGE "sql"
    AS $$
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
$$;


ALTER FUNCTION "public"."availability_to_slots"("availabilities" "jsonb"[], "tz" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_conversations"() RETURNS TABLE("conversation_id" "uuid", "created_at" timestamp with time zone, "participants" "json")
    LANGUAGE "sql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_admin_conversations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_event_details_for_tutor"("p_tutor_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$BEGIN
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
END;$$;


ALTER FUNCTION "public"."get_all_event_details_for_tutor"("p_tutor_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_event_hours"("input_user_id" "text") RETURNS real
    LANGUAGE "plpgsql"
    AS $$BEGIN
RETURN (
  SELECT COALESCE(SUM(hours), 0)
  FROM "Events"
  WHERE tutor_id::text = input_user_id
);
END;$$;


ALTER FUNCTION "public"."get_all_event_hours"("input_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_event_hours_batch"() RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$BEGIN
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
END;$$;


ALTER FUNCTION "public"."get_all_event_hours_batch"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_event_hours_batch_with_type"("event_type" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$BEGIN
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
END;$$;


ALTER FUNCTION "public"."get_all_event_hours_batch_with_type"("event_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_hours_batch"() RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$BEGIN
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
END;$$;


ALTER FUNCTION "public"."get_all_hours_batch"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_pairing_requests"("p_type" "text") RETURNS TABLE("request_id" "uuid", "type" "text", "user_id" "uuid", "status" "text", "priority" integer, "created_at" timestamp with time zone, "profile" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        pr.id AS request_id,
        pr.type,
        pr.user_id,
        pr.status,
        pr.priority,
        pr.created_at,
        to_jsonb(json_build_object(
            'email', p.email,
            'firstName', p.first_name,
            'lastName', p.last_name,
            'availability', p.availability,
            'subjects_of_interest', p.subjects_of_interest,
            'languages_spoken', p.languages_spoken
        )) AS profile
    FROM pairing_requests pr
    LEFT JOIN LATERAL (
      SELECT
        prof.email,
        prof.first_name,
        prof.last_name,
        prof.availability,
        prof.subjects_of_interest,
        prof.languages_spoken
      FROM public."Profiles" prof
      WHERE prof.id = pr.user_id
      LIMIT 1
    ) p ON TRUE
    WHERE pr.type = p_type
    ORDER BY pr.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_all_pairing_requests"("p_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_session_hours"("input_user_id" "text") RETURNS real
    LANGUAGE "plpgsql"
    AS $$BEGIN
  RETURN (
    SELECT COALESCE(SUM(duration), 0)
    FROM "Sessions"
    WHERE tutor_id::text = input_user_id AND status = 'Complete'
  );
END;$$;


ALTER FUNCTION "public"."get_all_session_hours"("input_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_session_hours_batch"() RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$BEGIN
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
END;$$;


ALTER FUNCTION "public"."get_all_session_hours_batch"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_session_hours_with_student"("input_tutor_id" "text", "input_student_id" "text") RETURNS real
    LANGUAGE "plpgsql"
    AS $$BEGIN
  RETURN (
    SELECT COALESCE(SUM(duration), 0)
    FROM "Sessions"
    WHERE tutor_id::text = input_tutor_id 
      AND student_id::text = input_student_id 
      AND status = 'Complete'
  );
END;$$;


ALTER FUNCTION "public"."get_all_session_hours_with_student"("input_tutor_id" "text", "input_student_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_best_match"("request_type" "text", "request_id" "uuid", "p_exclude_tutor_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS TABLE("pairing_request_id" "uuid", "similarity" double precision, "match_profile" "jsonb", "requestor_profile" "jsonb")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_requestor_id uuid;
  v_requestor_subjects text[];
  v_target_type text;
BEGIN
  SELECT pr.user_id, COALESCE(p.subjects_of_interest, '{}'::text[])
  INTO v_requestor_id, v_requestor_subjects
  FROM pairing_requests pr
  JOIN public."Profiles" p ON p.id = pr.user_id
  WHERE pr.id = request_id
    AND pr.type = request_type
    AND pr.in_queue IS DISTINCT FROM false;

  IF v_requestor_id IS NULL THEN
    RETURN;
  END IF;

  IF request_type = 'student' THEN
    v_target_type := 'tutor';
  ELSIF request_type = 'tutor' THEN
    v_target_type := 'student';
  ELSE
    RETURN;
  END IF;

  RETURN QUERY
  WITH
  requestor_slots AS (
    SELECT jsonb_agg(jsonb_build_object('start_ts', r.start_ts, 'end_ts', r.end_ts)) AS slots
    FROM availability_to_slots(
      (SELECT availability FROM public."Profiles" WHERE id = v_requestor_id),
      COALESCE(NULLIF((SELECT timezone FROM public."Profiles" WHERE id = v_requestor_id), ''), 'EST')
    ) AS r
  ),
  candidate_base AS (
    SELECT
      pr2.id AS pr2_id,
      pr2.priority,
      pr2.created_at,
      pr2.user_id AS cand_user_id,
      p.id AS profile_id,
      p.email,
      p.first_name,
      p.last_name,
      p.role,
      p.availability,
      p.timezone,
      p.subjects_of_interest
    FROM pairing_requests pr2
    JOIN public."Profiles" p ON p.id = pr2.user_id
    WHERE pr2.type = v_target_type
      AND pr2.in_queue IS DISTINCT FROM false
      AND pr2.id <> request_id
      AND (
        (request_type = 'student' AND NOT EXISTS (
          SELECT 1
          FROM public."Pairings" pair
          WHERE pair.student_id = v_requestor_id
            AND pair.tutor_id = pr2.user_id
        ))
        OR (
          request_type = 'tutor'
          AND NOT EXISTS (
            SELECT 1
            FROM public."Pairings" pair
            WHERE pair.tutor_id = v_requestor_id
              AND pair.student_id = pr2.user_id
          )
        )
      )
      AND (
        request_type <> 'student'
        OR p_exclude_tutor_ids IS NULL
        OR CARDINALITY(p_exclude_tutor_ids) = 0
        OR NOT (pr2.user_id = ANY (p_exclude_tutor_ids))
      )
  ),
  candidate_raw_slots AS (
    SELECT
      cb.pr2_id,
      slot.day,
      slot.start_ts,
      slot.end_ts
    FROM candidate_base cb
    CROSS JOIN LATERAL availability_to_slots(
      cb.availability,
      COALESCE(NULLIF(cb.timezone, ''), 'EST')
    ) AS slot
  ),
  candidate_slots AS (
    SELECT
      pr2_id,
      jsonb_agg(jsonb_build_object('start_ts', start_ts, 'end_ts', end_ts)) AS slots
    FROM candidate_raw_slots
    GROUP BY pr2_id
  ),
  scored AS (
    SELECT
      cb.pr2_id,
      cb.priority,
      cb.created_at,
      cb.cand_user_id,
      cb.profile_id,
      cb.email,
      cb.first_name,
      cb.last_name,
      cb.role,
      public.pairing_subject_priority_alignment(
        COALESCE(v_requestor_subjects, '{}'::text[]),
        COALESCE(cb.subjects_of_interest, '{}'::text[])
      ) AS sim,
      cs.slots
    FROM candidate_base cb
    INNER JOIN candidate_slots cs ON cs.pr2_id = cb.pr2_id
  )
  SELECT
    s.pr2_id AS pairing_request_id,
    s.sim::double precision AS similarity,
    jsonb_build_object(
      'id', s.profile_id,
      'email', s.email,
      'user_id', s.cand_user_id,
      'first_name', s.first_name,
      'last_name', s.last_name,
      'role', s.role
    ) AS match_profile,
    jsonb_build_object(
      'id', rp.id,
      'email', rp.email,
      'user_id', rp.user_id,
      'first_name', rp.first_name,
      'last_name', rp.last_name,
      'role', rp.role
    ) AS requestor_profile
  FROM scored s
  CROSS JOIN requestor_slots rs
  JOIN public."Profiles" rp ON rp.id = v_requestor_id
  WHERE public.availability_overlap(s.slots, rs.slots)
  ORDER BY
    ((4 - LEAST(s.priority, 3))::numeric * 10.0) + (s.sim * 100.0) DESC,
    s.priority ASC,
    s.created_at ASC,
    s.last_name,
    s.first_name
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_best_match"("request_type" "text", "request_id" "uuid", "p_exclude_tutor_ids" "uuid"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_best_match"("request_type" "text", "request_id" "uuid", "p_exclude_tutor_ids" "uuid"[]) IS 'Single best pairing-queue match: requires schedule overlap (availability_to_slots + availability_overlap); subject fit = pairing_subject_priority_alignment; rank = same priority band + similarity as lookup_proposed_matches; respects in_queue, existing Pairings, and optional p_exclude_tutor_ids for student requests.';



CREATE OR REPLACE FUNCTION "public"."get_best_pairing_match"("request_type" "text", "request_id" "uuid", "profile_id" "uuid", "embedding" "public"."vector", "availability" "jsonb") RETURNS TABLE("pairing_request_id" "uuid", "matched_profile_id" "uuid", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$-- BEGIN

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
END;$$;


ALTER FUNCTION "public"."get_best_pairing_match"("request_type" "text", "request_id" "uuid", "profile_id" "uuid", "embedding" "public"."vector", "availability" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_client_admin_conversations"("profile_id" "uuid") RETURNS TABLE("conversation_id" "uuid", "participants" "json")
    LANGUAGE "sql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_client_admin_conversations"("profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_enrollment_with_profiles"("enrollment_uuid" "uuid") RETURNS TABLE("id" "uuid", "created_at" timestamp with time zone, "student_id" "uuid", "tutor_id" "uuid", "summary" "text", "start_date" "date", "end_date" "date", "availability" "jsonb", "meetingid" "uuid", "summer_paused" boolean, "duration" integer, "student" "jsonb", "tutor" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_enrollment_with_profiles"("enrollment_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_enrollments_with_student_profile"() RETURNS TABLE("id" "uuid", "created_at" timestamp with time zone, "student_id" "uuid", "tutor_id" "uuid", "summary" "text", "start_date" "date", "end_date" "date", "availability" "jsonb", "meetingid" "uuid", "summer_paused" boolean, "duration" integer, "profile_id" "uuid", "profile_user_id" "uuid", "first_name" "text", "last_name" "text", "email" "text")
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_enrollments_with_student_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event_hours_range"("input_user_id" "text", "input_start_date" timestamp with time zone, "input_end_date" timestamp with time zone) RETURNS real
    LANGUAGE "plpgsql"
    AS $$BEGIN
RETURN (
  SELECT COALESCE(SUM(hours), 0)
  FROM "Events"
  WHERE tutor_id::text = input_user_id
    AND date > input_start_date
    AND date < input_end_date
);
END$$;


ALTER FUNCTION "public"."get_event_hours_range"("input_user_id" "text", "input_start_date" timestamp with time zone, "input_end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event_hours_range_batch"("start_date" timestamp with time zone, "end_date" timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$BEGIN
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
END;$$;


ALTER FUNCTION "public"."get_event_hours_range_batch"("start_date" timestamp with time zone, "end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_first_overlapping_availability"("a" "jsonb"[], "b" "jsonb"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_first_overlapping_availability"("a" "jsonb"[], "b" "jsonb"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_first_pairing_availability"("pairing_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_first_pairing_availability"("pairing_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_hours_range_batch"("start_date" timestamp with time zone, "end_date" timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$BEGIN
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
END;$$;


ALTER FUNCTION "public"."get_hours_range_batch"("start_date" timestamp with time zone, "end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_session_completion_stats"() RETURNS TABLE("month" "date", "total_completed" bigint, "total_resolved" bigint, "pct_completed" numeric)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select period, total_completed, total_resolved, pct_completed
  from get_period_session_completion_stats('month');
$$;


ALTER FUNCTION "public"."get_monthly_session_completion_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_overlapping_availabilities_array"("a" "jsonb"[], "b" "jsonb"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_overlapping_availabilities_array"("a" "jsonb"[], "b" "jsonb"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pairing_logs"("start_time" timestamp with time zone, "end_time" timestamp with time zone) RETURNS TABLE("id" "uuid", "type" "text", "profile" "jsonb", "match_profile" "jsonb", "message" "text", "status" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_pairing_logs"("start_time" timestamp with time zone, "end_time" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pairing_match"("match_id" "uuid") RETURNS TABLE("pairing_match_id" "uuid", "student_id" "uuid", "tutor_id" "uuid", "created_at" timestamp with time zone, "student" "jsonb", "tutor" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $$
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
$$;


ALTER FUNCTION "public"."get_pairing_match"("match_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pairing_matches_with_profiles"("requestor" "uuid") RETURNS TABLE("pairing_match_id" "uuid", "student_id" "uuid", "tutor_id" "uuid", "created_at" timestamp with time zone, "student" "jsonb", "tutor" "jsonb", "tutor_status" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_requestor_auth_id uuid;
BEGIN
  -- Resolve the requestor's auth UUID so we can match rows stored with either ID.
  SELECT p.user_id INTO v_requestor_auth_id
  FROM public."Profiles" p
  WHERE p.id = requestor
  LIMIT 1;

  RETURN QUERY
  SELECT
    pm.id                                                        AS pairing_match_id,
    pm.student_id,
    pm.tutor_id,
    pm.created_at,
    jsonb_build_object(
      'id',                COALESCE(sp.id,  sp2.id),
      'first_name',        COALESCE(sp.first_name,  sp2.first_name),
      'last_name',         COALESCE(sp.last_name,   sp2.last_name),
      'role',              'student',
      'availability',      COALESCE(sp.availability,         sp2.availability),
      'subjectsOfInterest', COALESCE(sp.subjects_of_interest, sp2.subjects_of_interest),
      'languagesSpoken',   COALESCE(sp.languages_spoken,     sp2.languages_spoken)
    )                                                            AS student,
    jsonb_build_object(
      'id',                COALESCE(tp.id,  tp2.id),
      'first_name',        COALESCE(tp.first_name,  tp2.first_name),
      'last_name',         COALESCE(tp.last_name,   tp2.last_name),
      'role',              'tutor',
      'availability',      COALESCE(tp.availability,         tp2.availability),
      'subjectsOfInterest', COALESCE(tp.subjects_of_interest, tp2.subjects_of_interest),
      'languagesSpoken',   COALESCE(tp.languages_spoken,     tp2.languages_spoken)
    )                                                            AS tutor,
    pm.tutor_status
  FROM pairing_matches pm

  -- Student: primary path via user_settings (matches when stored id = auth UUID)
  LEFT JOIN public.user_settings us_s
    ON us_s.user_id = pm.student_id
  LEFT JOIN public."Profiles" sp
    ON sp.id = us_s.last_active_profile_id

  -- Student: fallback direct join (matches when stored id = Profiles.id)
  LEFT JOIN public."Profiles" sp2
    ON sp2.id = pm.student_id
   AND sp.id IS NULL

  -- Tutor: primary path via user_settings
  LEFT JOIN public.user_settings us_t
    ON us_t.user_id = pm.tutor_id
  LEFT JOIN public."Profiles" tp
    ON tp.id = us_t.last_active_profile_id

  -- Tutor: fallback direct join
  LEFT JOIN public."Profiles" tp2
    ON tp2.id = pm.tutor_id
   AND tp.id IS NULL

  WHERE (
    -- stored as auth UUID
    pm.student_id = v_requestor_auth_id
    OR pm.tutor_id = v_requestor_auth_id
    -- stored as Profiles.id
    OR pm.student_id = requestor
    OR pm.tutor_id   = requestor
  )
    AND (pm.tutor_status = 'pending' OR pm.tutor_status IS NULL)
  ORDER BY pm.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_pairing_matches_with_profiles"("requestor" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pairing_requests_with_profiles"("requestor" "uuid") RETURNS TABLE("pairing_request_id" "uuid", "status" "text", "student_id" "uuid", "tutor_id" "uuid", "created_at" timestamp without time zone, "updated_at" timestamp without time zone, "student" "jsonb", "tutor" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $$
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
$$;


ALTER FUNCTION "public"."get_pairing_requests_with_profiles"("requestor" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pairing_with_profiles"("pairing_uuid" "uuid") RETURNS TABLE("id" "uuid", "created_at" timestamp with time zone, "student_id" "uuid", "tutor_id" "uuid", "student" "jsonb", "tutor" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_pairing_with_profiles"("pairing_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_period_session_completion_stats"("p_granularity" "text" DEFAULT 'month'::"text") RETURNS TABLE("period" "date", "total_completed" bigint, "total_resolved" bigint, "pct_completed" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not exists (
    select 1 from public."Profiles" p
    where p.user_id = auth.uid() and p.role = 'Admin'
  ) then
    raise exception 'Admin access required';
  end if;

  if p_granularity not in ('month', 'week') then
    raise exception 'Invalid granularity: %. Expected month or week.', p_granularity;
  end if;

  return query
  select
    date_trunc(p_granularity, s.date)::date as period,
    count(*) filter (where s.status = 'Complete') as total_completed,
    count(*) as total_resolved,
    round(100.0 * count(*) filter (where s.status = 'Complete') / nullif(count(*), 0), 1) as pct_completed
  from "Sessions" s
  where s.status in ('Complete', 'Cancelled')
    and s.date < date_trunc(p_granularity, now()) -- exclude the current, still-incomplete period
  group by date_trunc(p_granularity, s.date)
  order by 1;
end;
$$;


ALTER FUNCTION "public"."get_period_session_completion_stats"("p_granularity" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_session_completion_stats"() RETURNS TABLE("total_completed" bigint, "total_resolved" bigint, "pct_completed" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not exists (
    select 1 from public."Profiles" p
    where p.user_id = auth.uid() and p.role = 'Admin'
  ) then
    raise exception 'Admin access required';
  end if;

  return query
  select
    count(*) filter (where status = 'Complete') as total_completed,
    count(*) filter (where status in ('Complete', 'Cancelled')) as total_resolved,
    round(
      100.0 * count(*) filter (where status = 'Complete')
      / nullif(count(*) filter (where status in ('Complete', 'Cancelled')), 0),
      1
    ) as pct_completed
  from "Sessions";
end;
$$;


ALTER FUNCTION "public"."get_session_completion_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_session_hours_by_student"("p_tutor_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$BEGIN
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
END;$$;


ALTER FUNCTION "public"."get_session_hours_by_student"("p_tutor_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_session_hours_range"("input_tutor_id" "text", "input_start_date" timestamp with time zone, "input_end_date" timestamp with time zone) RETURNS real
    LANGUAGE "plpgsql"
    AS $$BEGIN
RETURN (
  SELECT COALESCE(SUM(duration), 0)
  FROM "Sessions"
  WHERE tutor_id::text = input_tutor_id
    AND status = 'Complete'
    AND date >= input_start_date
    AND date <= input_end_date
);
END;$$;


ALTER FUNCTION "public"."get_session_hours_range"("input_tutor_id" "text", "input_start_date" timestamp with time zone, "input_end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_session_hours_range_batch"("start_date" timestamp with time zone, "end_date" timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$BEGIN
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
END;$$;


ALTER FUNCTION "public"."get_session_hours_range_batch"("start_date" timestamp with time zone, "end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_session_hours_range_with_student"("input_tutor_id" "text", "input_student_id" "text", "input_start_date" timestamp with time zone, "input_end_date" timestamp with time zone) RETURNS real
    LANGUAGE "plpgsql"
    AS $$BEGIN
RETURN (
  SELECT COALESCE(SUM(duration), 0)
  FROM "Sessions"
  WHERE tutor_id::text = input_tutor_id
    AND student_id::text = input_student_id
    AND status = 'Complete'
    AND date >= input_start_date
    AND date <= input_end_date
);

END;$$;


ALTER FUNCTION "public"."get_session_hours_range_with_student"("input_tutor_id" "text", "input_student_id" "text", "input_start_date" timestamp with time zone, "input_end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_top_pairing_request"("request_type" "text") RETURNS TABLE("pairing_request_id" "uuid", "profile_id" "uuid", "embedding" "public"."vector")
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_top_pairing_request"("request_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_total_event_hours_range"("start_date" timestamp with time zone, "end_date" timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$BEGIN
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
  END;$$;


ALTER FUNCTION "public"."get_total_event_hours_range"("start_date" timestamp with time zone, "end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_total_hours"() RETURNS real
    LANGUAGE "plpgsql"
    AS $$BEGIN
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
END;$$;


ALTER FUNCTION "public"."get_total_hours"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_total_hours_range"("start_date" timestamp with time zone, "end_date" timestamp with time zone) RETURNS real
    LANGUAGE "plpgsql"
    AS $$BEGIN
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
END;$$;


ALTER FUNCTION "public"."get_total_hours_range"("start_date" timestamp with time zone, "end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_total_session_hours_range"("start_date" timestamp with time zone, "end_date" timestamp with time zone) RETURNS real
    LANGUAGE "plpgsql"
    AS $$BEGIN
RETURN (
  SELECT COALESCE(SUM(duration), 0) 
  FROM "Sessions"
  WHERE "date" >= start_date
    AND "date" <= end_date
    AND status = 'Complete'
);
END;$$;


ALTER FUNCTION "public"."get_total_session_hours_range"("start_date" timestamp with time zone, "end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tutor_sessions"("p_start_date" "text", "p_end_date" "text") RETURNS TABLE("tutor_id" "uuid", "first_name" "text", "last_name" "text", "total_sessions" bigint, "session_dates" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_tutor_sessions"("p_start_date" "text", "p_end_date" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tutor_sessions_with_date"("p_start_date" "text", "p_end_date" "text") RETURNS TABLE("tutor_id" "uuid", "first_name" "text", "last_name" "text", "total_sessions" bigint)
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_tutor_sessions_with_date"("p_start_date" "text", "p_end_date" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_by_email"("email" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
BEGIN
  RETURN (
    SELECT jsonb_build_object('id', au.id)
    FROM auth.users AS au
    WHERE au.email = $1
    LIMIT 1
  );
END;
$_$;


ALTER FUNCTION "public"."get_user_by_email"("email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_enrollments"("input_user_id" "uuid") RETURNS TABLE("id" "uuid", "created_at" timestamp with time zone, "student_id" "uuid", "tutor_id" "uuid", "summary" "text", "start_date" timestamp with time zone, "end_date" timestamp with time zone, "availability" "jsonb", "meetingId" "uuid", "summer_paused" boolean, "duration" real, "profile_id" "uuid", "profile_user_id" "uuid", "profile_name" "text", "profile_email" "text")
    LANGUAGE "sql" SECURITY DEFINER
    AS $$SELECT 
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
  ORDER BY e.created_at DESC;$$;


ALTER FUNCTION "public"."get_user_enrollments"("input_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_enrollments_with_profiles"("requestor_auth_id" "uuid") RETURNS TABLE("id" "uuid", "created_at" timestamp with time zone, "summary" "text", "start_date" "date", "end_date" "date", "availability" "jsonb", "meetingid" "uuid", "summer_paused" boolean, "duration" integer, "student" "jsonb", "tutor" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_user_enrollments_with_profiles"("requestor_auth_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_enrollments_with_student_profile"("requestor_auth_id" "uuid") RETURNS TABLE("id" "uuid", "created_at" timestamp with time zone, "student_id" "uuid", "tutor_id" "uuid", "summary" "text", "start_date" "date", "end_date" "date", "availability" "jsonb", "meetingid" "uuid", "summer_paused" boolean, "duration" integer, "student_profile_id" "uuid", "student_user_id" "uuid", "student_first_name" "text", "student_last_name" "text", "student_email" "text")
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_user_enrollments_with_student_profile"("requestor_auth_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_pairings_with_profiles"("requestor_auth_id" "uuid") RETURNS TABLE("id" "uuid", "created_at" timestamp with time zone, "student_id" "uuid", "tutor_id" "uuid", "student" "jsonb", "tutor" "jsonb")
    LANGUAGE "sql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_user_pairings_with_profiles"("requestor_auth_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_chat_room_notification_preferences_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_chat_room_notification_preferences_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public."Profiles" (
    user_id, 
    email, 
    role,
    first_name, 
    last_name, 
    age,
    grade,
    gender,
    start_date,
    availability,
    parent_name,
    parent_email,
    phone_number,
    timezone,
    subjects_of_interest,
    status,
    student_number,
    languages_spoken
  )
  values (
    new.id, 
    new.email,
    new.raw_user_meta_data ->> 'role',
    new.raw_user_meta_data ->> 'first_name', 
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'age',
    new.raw_user_meta_data ->> 'grade',
    new.raw_user_meta_data ->> 'gender',
    (new.raw_user_meta_data ->> 'start_date')::DATE,
  (SELECT array_agg(value) FROM jsonb_array_elements(new.raw_user_meta_data -> 'availability')),
    new.raw_user_meta_data ->> 'parent_name',
    new.raw_user_meta_data ->> 'parent_email',
    new.raw_user_meta_data ->> 'phone_number',
    new.raw_user_meta_data ->> 'timezone',
    (SELECT array_agg(value) FROM jsonb_array_elements(new.raw_user_meta_data -> 'subjects_of_interest')),
    new.raw_user_meta_data ->> 'status',
    new.raw_user_meta_data ->> 'student_number',
      (SELECT array_agg(value) FROM jsonb_array_elements(new.raw_user_meta_data -> 'languages_spoken'))
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_pairing_from_matches"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.tutor_status = 'accepted' THEN
    INSERT INTO public."Pairings"(student_id, tutor_id)
    VALUES (NEW.student_id, NEW.tutor_id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."insert_pairing_from_matches"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_pairing_from_pairing_matches_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
IF OLD.status != NEW.status AND NEW.status = 'accepted' THEN
  INSERT INTO public."Pairings"(student_id, tutor_id)
  VALUES (NEW.student_id, NEW.tutor_id);
END IF;
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."insert_pairing_from_pairing_matches_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_user_settings"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$BEGIN
  INSERT INTO user_settings(user_id, last_active_profile_id, email)
  VALUES (NEW.user_id, NEW.id, NEW.email)
  ON CONFLICT(user_id)
  DO NOTHING;

  RETURN NEW;
END;$$;


ALTER FUNCTION "public"."insert_user_settings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_availability"("avail" "jsonb"[], "tz" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
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
$$;


ALTER FUNCTION "public"."normalize_availability"("avail" "jsonb"[], "tz" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_availability"("avail" "jsonb", "tz" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
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
$$;


ALTER FUNCTION "public"."normalize_availability"("avail" "jsonb", "tz" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pairing_subject_priority_alignment"("requestor_subjects" "text"[], "candidate_subjects" "text"[]) RETURNS numeric
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO 'public'
    AS $$
  WITH ra AS (
    SELECT COALESCE(requestor_subjects, '{}'::text[]) AS r
  ),
  cb AS (
    SELECT COALESCE(candidate_subjects, '{}'::text[]) AS c
  ),
  dims AS (
    SELECT cardinality(ra.r)::integer AS n, cardinality(cb.c)::integer AS m
    FROM ra, cb
  ),
  raw_sum AS (
    SELECT COALESCE(
      SUM(
        (d.n - pos.ord + 1)::numeric
        * (d.m - array_position(cb.c, pos.elem) + 1)::numeric
      ),
      0::numeric
    ) AS v
    FROM ra
    CROSS JOIN cb
    CROSS JOIN dims d
    CROSS JOIN LATERAL unnest(ra.r) WITH ORDINALITY AS pos(elem, ord)
    WHERE array_position(cb.c, pos.elem) IS NOT NULL
  ),
  max_sum AS (
    SELECT COALESCE(
      SUM((d.n - s.k + 1)::numeric * (d.m - s.k + 1)::numeric),
      0::numeric
    ) AS v
    FROM dims d
    CROSS JOIN LATERAL generate_series(1, GREATEST(LEAST(d.n, d.m), 0)) AS s(k)
  )
  SELECT CASE
    WHEN (SELECT v FROM max_sum) = 0 THEN 0::numeric
    ELSE LEAST(
      1::numeric,
      (SELECT v FROM raw_sum) / NULLIF((SELECT v FROM max_sum), 0)
    )
  END;
$$;


ALTER FUNCTION "public"."pairing_subject_priority_alignment"("requestor_subjects" "text"[], "candidate_subjects" "text"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."pairing_subject_priority_alignment"("requestor_subjects" "text"[], "candidate_subjects" "text"[]) IS 'Priority-ordered subject fit in [0,1]: earlier entries in each array matter more; normalized by best possible aligned score.';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."Emails" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "recipient_id" "uuid",
    "description" "text",
    "session_id" "uuid",
    "message_id" "text"
);


ALTER TABLE "public"."Emails" OWNER TO "postgres";


COMMENT ON TABLE "public"."Emails" IS 'Email Notifications';



ALTER TABLE "public"."Emails" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."Emails_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."Enrollments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "student_id" "uuid",
    "tutor_id" "uuid",
    "summary" "text",
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "availability" "jsonb",
    "meetingId" "uuid",
    "paused" boolean DEFAULT false NOT NULL,
    "duration" real NOT NULL,
    "frequency" "public"."session_frequency" DEFAULT 'weekly'::"public"."session_frequency" NOT NULL,
    "pairing_id" "uuid",
    "day" "text",
    "start_time" time without time zone,
    "end_time" time without time zone,
    "inactivity_warning_sent_at" timestamp with time zone
);


ALTER TABLE "public"."Enrollments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."Enrollments"."meetingId" IS 'Zoom Link';



COMMENT ON COLUMN "public"."Enrollments"."inactivity_warning_sent_at" IS 'When the "Inactivating Connect Me Enrollment" warning was last emailed to the tutor. The nightly cleanup cron claims enrollments by stamping this column before sending, so a re-run on the same night (or a retried invocation) does not warn the same tutor twice.';



CREATE TABLE IF NOT EXISTS "public"."Events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "date" timestamp with time zone,
    "summary" "text",
    "tutor_id" "uuid" DEFAULT "gen_random_uuid"(),
    "hours" double precision,
    "type" "public"."event_type" DEFAULT 'Other'::"public"."event_type" NOT NULL
);


ALTER TABLE "public"."Events" OWNER TO "postgres";


COMMENT ON COLUMN "public"."Events"."type" IS 'Type of Event';



CREATE TABLE IF NOT EXISTS "public"."Forms" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "submitter" "uuid"
);


ALTER TABLE "public"."Forms" OWNER TO "postgres";


ALTER TABLE "public"."Forms" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."Forms_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."Meetings" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "link" "text" NOT NULL,
    "meeting_id" "text" NOT NULL,
    "password" "text",
    "name" "text" NOT NULL
);


ALTER TABLE "public"."Meetings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Notifications" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "summary" "text",
    "session_id" "uuid",
    "previous_date" timestamp with time zone,
    "suggested_date" timestamp with time zone,
    "tutor_id" "uuid",
    "student_id" "uuid",
    "status" "text",
    "type" "text"
);


ALTER TABLE "public"."Notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Pairings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tutor_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL
);


ALTER TABLE "public"."Pairings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "user_id" "uuid" DEFAULT "gen_random_uuid"(),
    "role" "text",
    "start_date" "date",
    "availability" "jsonb"[],
    "parent_name" "text",
    "parent_phone" "text",
    "parent_email" "text",
    "timezone" "text",
    "status" "text",
    "subjects_of_interest" "text"[],
    "date_of_birth" "date",
    "email" "text",
    "tutor_ids" "uuid"[],
    "student_number" "text",
    "age" "text",
    "grade" "text",
    "gender" "text",
    "tutoring_hours" real DEFAULT '0'::real,
    "settings_id" "uuid" NOT NULL,
    "ai_tutor_chatlogs" "text",
    "languages_spoken" "text"[],
    "subject_embed" "public"."vector"(384),
    "phone_number" "text",
    "orientation_completed_at" timestamp with time zone
);


ALTER TABLE "public"."Profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."Profiles"."student_number" IS 'Only applies if the user is a student';



COMMENT ON COLUMN "public"."Profiles"."age" IS 'Only for Students';



COMMENT ON COLUMN "public"."Profiles"."tutoring_hours" IS 'Tutoring Hours for tutors';



COMMENT ON COLUMN "public"."Profiles"."languages_spoken" IS 'Language user speaks';



CREATE TABLE IF NOT EXISTS "public"."Requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "request_information" "jsonb",
    "request_type" "text"
);


ALTER TABLE "public"."Requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Sessions" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "date" timestamp with time zone,
    "meeting_id" "uuid",
    "student_id" "uuid",
    "tutor_id" "uuid",
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "summary" "text",
    "status" "public"."session_status",
    "session_exit_form" "text",
    "is_question_or_concern" boolean DEFAULT false NOT NULL,
    "is_first_session" boolean DEFAULT false NOT NULL,
    "enrollment_id" "uuid",
    "duration" real NOT NULL,
    "is_standalone" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."Sessions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."Sessions"."session_exit_form" IS 'What topics were covered in the session';



CREATE TABLE IF NOT EXISTS "public"."User_Availabilities" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "day_of_the_week" integer,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "timezone" "public"."timezone",
    "profile_id" "uuid"
);


ALTER TABLE "public"."User_Availabilities" OWNER TO "postgres";


ALTER TABLE "public"."User_Availabilities" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."User_Availabilities_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."chat_room_notification_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "room_id" "uuid" NOT NULL,
    "email_muted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chat_room_notification_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_participant" (
    "conversation_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL
);


ALTER TABLE "public"."conversation_participant" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_conversation" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."discord_chatbot_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "discord_user_id" "uuid" DEFAULT "gen_random_uuid"(),
    "discord_channel_id" "uuid" DEFAULT "gen_random_uuid"(),
    "prompt" "text",
    "response" "text"
);


ALTER TABLE "public"."discord_chatbot_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text",
    "file" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pairing_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message" "text" NOT NULL,
    "type" "text" NOT NULL,
    "error" boolean DEFAULT false,
    "role" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "pairing_logs_role_check" CHECK (("role" = ANY (ARRAY['student'::"text", 'tutor'::"text"]))),
    CONSTRAINT "pairing_logs_type_check" CHECK (("type" = ANY (ARRAY['pairing-match'::"text", 'pairing-match-rejected'::"text", 'pairing-match-accepted'::"text", 'pairing-selection-failed'::"text"])))
);


ALTER TABLE "public"."pairing_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pairing_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tutor_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "similarity" real,
    "tutor_status" "text" DEFAULT 'pending'::"text",
    "rejected_at" timestamp with time zone
);


ALTER TABLE "public"."pairing_matches" OWNER TO "postgres";


COMMENT ON COLUMN "public"."pairing_matches"."rejected_at" IS 'Set when tutor_status becomes rejected; used for re-match cooldown.';



CREATE TABLE IF NOT EXISTS "public"."pairing_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "priority" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text",
    "in_queue" boolean DEFAULT true NOT NULL,
    "exclude_rejected_tutors" boolean DEFAULT true NOT NULL,
    CONSTRAINT "pairing_request_type_check" CHECK (("type" = ANY (ARRAY['student'::"text", 'tutor'::"text"])))
);


ALTER TABLE "public"."pairing_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."pairing_requests" IS 'pairing_requests.user_id should reference Profiles.id; legacy auth-user-id rows are backfilled in 20260430225000.';



COMMENT ON COLUMN "public"."pairing_requests"."in_queue" IS 'When false, the request is archived (left queue) but the row is kept for notes/history.';



COMMENT ON COLUMN "public"."pairing_requests"."exclude_rejected_tutors" IS 'When true (default), students will not be matched with tutors who previously rejected them.';



CREATE TABLE IF NOT EXISTS "public"."user_notification_settings" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email_tutoring_session_notifications_enabled" boolean DEFAULT true NOT NULL,
    "text_tutoring_session_notifications_enabled" boolean DEFAULT true NOT NULL,
    "email_webinar_notifications_enabled" boolean DEFAULT true NOT NULL,
    "text_webinar_notifications_enabled" boolean DEFAULT true NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "public"."user_notification_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "last_active_profile_id" "uuid" NOT NULL,
    "email" "text"
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weekly_meeting_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "meeting_id" "uuid",
    "day_of_week" "public"."day_of_week" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL
);


ALTER TABLE "public"."weekly_meeting_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zoom_participant_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "participant_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "action" "text" NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "session_id" "uuid" DEFAULT "gen_random_uuid"(),
    "zoom_meeting_uuid" "text"
);


ALTER TABLE "public"."zoom_participant_events" OWNER TO "postgres";


ALTER TABLE ONLY "public"."Emails"
    ADD CONSTRAINT "Emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Enrollments"
    ADD CONSTRAINT "Enrollments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Events"
    ADD CONSTRAINT "Events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Forms"
    ADD CONSTRAINT "Forms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Notifications"
    ADD CONSTRAINT "Notifications_id_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."Notifications"
    ADD CONSTRAINT "Notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Profiles"
    ADD CONSTRAINT "Profiles_notification_settings_key" UNIQUE ("settings_id");



ALTER TABLE ONLY "public"."Profiles"
    ADD CONSTRAINT "Profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Requests"
    ADD CONSTRAINT "Requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Sessions"
    ADD CONSTRAINT "Sessions_id_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."Sessions"
    ADD CONSTRAINT "Sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."User_Availabilities"
    ADD CONSTRAINT "User_Availabilities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_notification_settings"
    ADD CONSTRAINT "User_Notification_Settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Meetings"
    ADD CONSTRAINT "Zoom Links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_room_notification_preferences"
    ADD CONSTRAINT "chat_room_notification_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_room_notification_preferences"
    ADD CONSTRAINT "chat_room_notification_preferences_profile_room_key" UNIQUE ("profile_id", "room_id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversation_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_participant"
    ADD CONSTRAINT "conversationparticipant_pkey" PRIMARY KEY ("conversation_id", "profile_id");



ALTER TABLE ONLY "public"."discord_chatbot_conversations"
    ADD CONSTRAINT "discord_chatbot_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_meeting_schedules"
    ADD CONSTRAINT "meeting_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pairing_logs"
    ADD CONSTRAINT "pairing_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pairing_matches"
    ADD CONSTRAINT "pairing_matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pairing_requests"
    ADD CONSTRAINT "pairing_request_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Pairings"
    ADD CONSTRAINT "pairings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pairing_matches"
    ADD CONSTRAINT "unique_pairing_match" UNIQUE ("tutor_id", "student_id");



ALTER TABLE ONLY "public"."Sessions"
    ADD CONSTRAINT "unique_sessions" UNIQUE ("tutor_id", "student_id", "date");



ALTER TABLE ONLY "public"."Pairings"
    ADD CONSTRAINT "unique_tutor_student_pair" UNIQUE ("tutor_id", "student_id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_profile_last_active_profile_id_key" UNIQUE ("last_active_profile_id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_profile_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."zoom_participant_events"
    ADD CONSTRAINT "zoom_participant_events_pkey" PRIMARY KEY ("id");



CREATE INDEX "Enrollments_inactivity_warning_sent_at_idx" ON "public"."Enrollments" USING "btree" ("inactivity_warning_sent_at");



CREATE INDEX "idx_chat_room_notification_preferences_profile_id" ON "public"."chat_room_notification_preferences" USING "btree" ("profile_id");



CREATE INDEX "idx_chat_room_notification_preferences_profile_room" ON "public"."chat_room_notification_preferences" USING "btree" ("profile_id", "room_id");



CREATE INDEX "idx_chat_room_notification_preferences_room_id" ON "public"."chat_room_notification_preferences" USING "btree" ("room_id");



CREATE INDEX "idx_pairing_matches_student_tutor_status" ON "public"."pairing_matches" USING "btree" ("student_id", "tutor_id", "tutor_status");



CREATE INDEX "idx_zoom_participant_events_zoom_meeting_uuid" ON "public"."zoom_participant_events" USING "btree" ("zoom_meeting_uuid");



CREATE INDEX "profiles_subject_embed_idx" ON "public"."Profiles" USING "ivfflat" ("subject_embed") WITH ("lists"='100');



CREATE OR REPLACE TRIGGER "Automatically_create_pairing_from_new_enrollment" BEFORE INSERT OR UPDATE ON "public"."Enrollments" FOR EACH ROW EXECUTE FUNCTION "public"."Automatically_create_pairing_from_enrollments"();



CREATE OR REPLACE TRIGGER "Automatically_set_default_settings_for_new_profiles" BEFORE INSERT ON "public"."Profiles" FOR EACH ROW EXECUTE FUNCTION "public"."Automatic create settings for new profiles"();



CREATE OR REPLACE TRIGGER "chat_room_notification_preferences_set_updated_at" BEFORE UPDATE ON "public"."chat_room_notification_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."handle_chat_room_notification_preferences_updated_at"();



CREATE OR REPLACE TRIGGER "insert_pairing_from_matches_updates" AFTER UPDATE ON "public"."pairing_matches" FOR EACH ROW EXECUTE FUNCTION "public"."insert_pairing_from_pairing_matches_update"();



CREATE OR REPLACE TRIGGER "insert_pairing_from_pairing_matches" AFTER INSERT ON "public"."pairing_matches" FOR EACH ROW EXECUTE FUNCTION "public"."insert_pairing_from_matches"();



CREATE OR REPLACE TRIGGER "insert_user_settings_from_profiles" AFTER INSERT ON "public"."Profiles" FOR EACH ROW EXECUTE FUNCTION "public"."insert_user_settings"();



ALTER TABLE ONLY "public"."Enrollments"
    ADD CONSTRAINT "Enrollments_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "public"."Meetings"("id");



ALTER TABLE ONLY "public"."Enrollments"
    ADD CONSTRAINT "Enrollments_pairing_id_fkey" FOREIGN KEY ("pairing_id") REFERENCES "public"."Pairings"("id");



ALTER TABLE ONLY "public"."Enrollments"
    ADD CONSTRAINT "Enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."Profiles"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Enrollments"
    ADD CONSTRAINT "Enrollments_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "public"."Profiles"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Events"
    ADD CONSTRAINT "Events_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "public"."Profiles"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Notifications"
    ADD CONSTRAINT "Notifications_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."Sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Profiles"
    ADD CONSTRAINT "Profiles_settings_id_fkey" FOREIGN KEY ("settings_id") REFERENCES "public"."user_notification_settings"("id");



ALTER TABLE ONLY "public"."Profiles"
    ADD CONSTRAINT "Profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Sessions"
    ADD CONSTRAINT "Sessions_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "public"."Enrollments"("id") ON UPDATE RESTRICT ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Sessions"
    ADD CONSTRAINT "Sessions_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."Meetings"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Sessions"
    ADD CONSTRAINT "Sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."Profiles"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Sessions"
    ADD CONSTRAINT "Sessions_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "public"."Profiles"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."User_Availabilities"
    ADD CONSTRAINT "User_Availabilities_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."Profiles"("id") ON UPDATE RESTRICT ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_room_notification_preferences"
    ADD CONSTRAINT "chat_room_notification_preferences_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."Profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_participant"
    ADD CONSTRAINT "conversationparticipant_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_participant"
    ADD CONSTRAINT "conversationparticipant_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."Profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weekly_meeting_schedules"
    ADD CONSTRAINT "meeting_schedules_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."Meetings"("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."Profiles"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pairing_requests"
    ADD CONSTRAINT "pairing_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."Profiles"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Pairings"
    ADD CONSTRAINT "pairings_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."Profiles"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Pairings"
    ADD CONSTRAINT "pairings_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "public"."Profiles"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_last_active_profile_id_fkey" FOREIGN KEY ("last_active_profile_id") REFERENCES "public"."Profiles"("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zoom_participant_events"
    ADD CONSTRAINT "zoom_participant_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."Sessions"("id");



CREATE POLICY "Delete Events" ON "public"."Events" FOR DELETE TO "authenticated" USING (( SELECT ("Profiles"."role" = 'Admin'::"text")
   FROM "public"."Profiles"
  WHERE ("Profiles"."user_id" = "auth"."uid"())));



ALTER TABLE "public"."Emails" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Enable Update" ON "public"."user_settings" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable delete for users" ON "public"."weekly_meeting_schedules" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Enable delete for users based on user_id" ON "public"."Enrollments" FOR DELETE TO "authenticated" USING (("auth"."uid"() IN ( SELECT "Profiles"."user_id"
   FROM "public"."Profiles"
  WHERE (("Profiles"."role" = 'Admin'::"text") OR ("Profiles"."role" = 'Tutor'::"text")))));



CREATE POLICY "Enable delete for users based on user_id" ON "public"."Pairings" FOR DELETE TO "authenticated" USING (( SELECT ("Profiles"."role" = 'Tutor'::"text")
   FROM "public"."Profiles"
  WHERE ("Profiles"."user_id" = "auth"."uid"())));



CREATE POLICY "Enable delete for users based on user_id" ON "public"."User_Availabilities" FOR DELETE TO "authenticated" USING (( SELECT ("Profiles"."role" = 'Tutor'::"text")
   FROM "public"."Profiles"
  WHERE ("Profiles"."user_id" = "auth"."uid"())));



CREATE POLICY "Enable delete for users based on user_id" ON "public"."conversation_participant" FOR DELETE TO "authenticated" USING (( SELECT ("Profiles"."role" = 'Tutor'::"text")
   FROM "public"."Profiles"
  WHERE ("Profiles"."user_id" = "auth"."uid"())));



CREATE POLICY "Enable delete for users based on user_id" ON "public"."conversations" FOR DELETE TO "authenticated" USING (( SELECT ("Profiles"."role" = 'Tutor'::"text")
   FROM "public"."Profiles"
  WHERE ("Profiles"."user_id" = "auth"."uid"())));



CREATE POLICY "Enable delete for users based on user_id" ON "public"."messages" FOR DELETE TO "authenticated" USING (( SELECT ("Profiles"."role" = 'Tutor'::"text")
   FROM "public"."Profiles"
  WHERE ("Profiles"."user_id" = "auth"."uid"())));



CREATE POLICY "Enable delete for users based on user_id" ON "public"."pairing_logs" FOR DELETE TO "authenticated" USING (( SELECT ("Profiles"."role" = 'Tutor'::"text")
   FROM "public"."Profiles"
  WHERE ("Profiles"."user_id" = "auth"."uid"())));



CREATE POLICY "Enable delete for users based on user_id" ON "public"."pairing_matches" FOR DELETE TO "authenticated" USING (( SELECT ("Profiles"."role" = 'Tutor'::"text")
   FROM "public"."Profiles"
  WHERE ("Profiles"."user_id" = "auth"."uid"())));



CREATE POLICY "Enable delete for users based on user_id" ON "public"."pairing_requests" FOR DELETE TO "authenticated" USING (( SELECT ("Profiles"."role" = 'Tutor'::"text")
   FROM "public"."Profiles"
  WHERE ("Profiles"."user_id" = "auth"."uid"())));



CREATE POLICY "Enable delete for users based on user_id" ON "public"."user_settings" FOR DELETE TO "authenticated" USING (( SELECT ("Profiles"."role" = 'Admin'::"text")
   FROM "public"."Profiles"
  WHERE ("Profiles"."user_id" = "auth"."uid"())));



CREATE POLICY "Enable delete for users based on user_id" ON "public"."zoom_participant_events" FOR DELETE USING (( SELECT ("Profiles"."role" = 'Tutor'::"text")
   FROM "public"."Profiles"
  WHERE ("Profiles"."user_id" = "auth"."uid"())));



CREATE POLICY "Enable delete for users if admin" ON "public"."Sessions" FOR DELETE TO "authenticated" USING (("auth"."uid"() IN ( SELECT "Profiles"."user_id"
   FROM "public"."Profiles"
  WHERE (("Profiles"."role" = 'Admin'::"text") OR ("Profiles"."role" = 'Tutor'::"text")))));



CREATE POLICY "Enable insert for authenticated users only" ON "public"."Emails" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."Enrollments" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."Events" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."Meetings" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."Notifications" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."Pairings" FOR INSERT TO "authenticated", "supabase_admin", "supabase_auth_admin" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."Profiles" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."Sessions" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."User_Availabilities" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."conversation_participant" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."conversations" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."pairing_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."pairing_matches" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."pairing_requests" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."user_notification_settings" FOR INSERT TO "postgres", "authenticated", "anon", "service_role" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."user_settings" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."weekly_meeting_schedules" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."zoom_participant_events" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable read access for all users" ON "public"."Emails" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."Enrollments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."Events" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."Meetings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."Notifications" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."Pairings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."Profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."Sessions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."User_Availabilities" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."conversation_participant" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."conversations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."messages" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."pairing_logs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."pairing_matches" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."pairing_requests" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."user_notification_settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."user_settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."weekly_meeting_schedules" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."zoom_participant_events" FOR SELECT USING (true);



CREATE POLICY "Enable sessions if tutor" ON "public"."Sessions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."Profiles"
  WHERE ("Profiles"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."Profiles"
  WHERE (("Profiles"."user_id" = "auth"."uid"()) AND ("Profiles"."role" = 'Tutor'::"text")))));



CREATE POLICY "Enable update" ON "public"."pairing_requests" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable update access" ON "public"."User_Availabilities" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Enable update access " ON "public"."zoom_participant_events" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Enable update access for all users" ON "public"."conversation_participant" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable update access for all users" ON "public"."conversations" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable update for users" ON "public"."user_notification_settings" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Enable update for users based on email" ON "public"."Enrollments" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."Enrollments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Forms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Meetings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Messages Update" ON "public"."messages" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."Notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Pairing Matches Update" ON "public"."pairing_matches" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."Pairings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Policy with table joins" ON "public"."Emails" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Policy with table joins" ON "public"."weekly_meeting_schedules" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "public"."Profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Update Pairing Logs" ON "public"."pairing_logs" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Update notification if admin" ON "public"."Notifications" FOR UPDATE TO "authenticated" USING (( SELECT ("auth"."uid"() = "Profiles"."user_id")
   FROM "public"."Profiles"
  WHERE ("Profiles"."user_id" = "auth"."uid"()))) WITH CHECK (( SELECT ("Profiles"."role" = 'Admin'::"text")
   FROM "public"."Profiles"
  WHERE ("Profiles"."user_id" = "auth"."uid"())));



CREATE POLICY "Update policy for enrollments" ON "public"."Enrollments" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Update profile if admin" ON "public"."Profiles" FOR UPDATE TO "authenticated" USING (( SELECT ("auth"."uid"() = "Profiles_1"."user_id")
   FROM "public"."Profiles" "Profiles_1"
  WHERE ("Profiles_1"."user_id" = "auth"."uid"()))) WITH CHECK (( SELECT ("Profiles_1"."role" = 'Admin'::"text")
   FROM "public"."Profiles" "Profiles_1"
  WHERE ("Profiles_1"."user_id" = "auth"."uid"())));



CREATE POLICY "Update sessions if admin" ON "public"."Sessions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."Profiles"
  WHERE ("Profiles"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."Profiles"
  WHERE (("Profiles"."user_id" = "auth"."uid"()) AND ("Profiles"."role" = 'Admin'::"text")))));



CREATE POLICY "Update sessions if student" ON "public"."Sessions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."Profiles"
  WHERE ("Profiles"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."Profiles"
  WHERE (("Profiles"."user_id" = "auth"."uid"()) AND ("Profiles"."role" = 'Student'::"text")))));



ALTER TABLE "public"."User_Availabilities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Users can view enrollments they're involved in" ON "public"."Enrollments" FOR SELECT TO "authenticated" USING ((("tutor_id" IN ( SELECT "Profiles"."id"
   FROM "public"."Profiles"
  WHERE ("Profiles"."user_id" = "auth"."uid"()))) OR ("student_id" IN ( SELECT "Profiles"."id"
   FROM "public"."Profiles"
  WHERE ("Profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "analytics read" ON "public"."Enrollments" FOR SELECT TO "anon" USING (true);



CREATE POLICY "analytics read" ON "public"."Events" FOR SELECT TO "anon" USING (true);



CREATE POLICY "analytics read" ON "public"."Notifications" FOR SELECT TO "anon" USING (true);



CREATE POLICY "analytics read" ON "public"."Pairings" FOR SELECT TO "anon" USING (true);



CREATE POLICY "analytics read" ON "public"."Profiles" FOR SELECT TO "anon" USING (true);



CREATE POLICY "analytics read" ON "public"."Sessions" FOR SELECT TO "anon" USING (true);



CREATE POLICY "analytics read" ON "public"."User_Availabilities" FOR SELECT TO "anon" USING (true);



CREATE POLICY "analytics read" ON "public"."pairing_logs" FOR SELECT TO "anon" USING (true);



CREATE POLICY "analytics read" ON "public"."pairing_matches" FOR SELECT TO "anon" USING (true);



CREATE POLICY "analytics read" ON "public"."pairing_requests" FOR SELECT TO "anon" USING (true);



CREATE POLICY "analytics read" ON "public"."zoom_participant_events" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."chat_room_notification_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversation_participant" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "delete_own_chat_room_notification_preferences" ON "public"."chat_room_notification_preferences" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."Profiles" "p"
  WHERE (("p"."id" = "chat_room_notification_preferences"."profile_id") AND ("p"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."discord_chatbot_conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert_own_chat_room_notification_preferences" ON "public"."chat_room_notification_preferences" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."Profiles" "p"
  WHERE (("p"."id" = "chat_room_notification_preferences"."profile_id") AND ("p"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pairing_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pairing_matches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pairing_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select_own_chat_room_notification_preferences" ON "public"."chat_room_notification_preferences" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."Profiles" "p"
  WHERE (("p"."id" = "chat_room_notification_preferences"."profile_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "update if owner" ON "public"."Profiles" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "update_own_chat_room_notification_preferences" ON "public"."chat_room_notification_preferences" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."Profiles" "p"
  WHERE (("p"."id" = "chat_room_notification_preferences"."profile_id") AND ("p"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."user_notification_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weekly_meeting_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zoom_participant_events" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."Automatic create settings for new profiles"() TO "anon";
GRANT ALL ON FUNCTION "public"."Automatic create settings for new profiles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."Automatic create settings for new profiles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."Automatically_create_pairing_from_enrollments"() TO "anon";
GRANT ALL ON FUNCTION "public"."Automatically_create_pairing_from_enrollments"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."Automatically_create_pairing_from_enrollments"() TO "service_role";



GRANT ALL ON FUNCTION "public"."availability_overlap"("slots1" "jsonb", "slots2" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."availability_overlap"("slots1" "jsonb", "slots2" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."availability_overlap"("slots1" "jsonb", "slots2" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."availability_to_slots"("availabilities" "jsonb"[], "tz" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."availability_to_slots"("availabilities" "jsonb"[], "tz" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."availability_to_slots"("availabilities" "jsonb"[], "tz" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_admin_conversations"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_admin_conversations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_conversations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_event_details_for_tutor"("p_tutor_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_event_details_for_tutor"("p_tutor_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_event_details_for_tutor"("p_tutor_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_event_hours"("input_user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_event_hours"("input_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_event_hours"("input_user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_event_hours_batch"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_event_hours_batch"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_event_hours_batch"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_event_hours_batch_with_type"("event_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_event_hours_batch_with_type"("event_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_event_hours_batch_with_type"("event_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_hours_batch"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_hours_batch"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_hours_batch"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_pairing_requests"("p_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_pairing_requests"("p_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_pairing_requests"("p_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_session_hours"("input_user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_session_hours"("input_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_session_hours"("input_user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_session_hours_batch"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_session_hours_batch"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_session_hours_batch"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_session_hours_with_student"("input_tutor_id" "text", "input_student_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_session_hours_with_student"("input_tutor_id" "text", "input_student_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_session_hours_with_student"("input_tutor_id" "text", "input_student_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_best_match"("request_type" "text", "request_id" "uuid", "p_exclude_tutor_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_best_match"("request_type" "text", "request_id" "uuid", "p_exclude_tutor_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_best_match"("request_type" "text", "request_id" "uuid", "p_exclude_tutor_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_best_pairing_match"("request_type" "text", "request_id" "uuid", "profile_id" "uuid", "embedding" "public"."vector", "availability" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."get_best_pairing_match"("request_type" "text", "request_id" "uuid", "profile_id" "uuid", "embedding" "public"."vector", "availability" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_best_pairing_match"("request_type" "text", "request_id" "uuid", "profile_id" "uuid", "embedding" "public"."vector", "availability" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_client_admin_conversations"("profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_client_admin_conversations"("profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_client_admin_conversations"("profile_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_enrollment_with_profiles"("enrollment_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_enrollment_with_profiles"("enrollment_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_enrollment_with_profiles"("enrollment_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_enrollments_with_student_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_enrollments_with_student_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_enrollments_with_student_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_event_hours_range"("input_user_id" "text", "input_start_date" timestamp with time zone, "input_end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_event_hours_range"("input_user_id" "text", "input_start_date" timestamp with time zone, "input_end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_hours_range"("input_user_id" "text", "input_start_date" timestamp with time zone, "input_end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_event_hours_range_batch"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_event_hours_range_batch"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_hours_range_batch"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_first_overlapping_availability"("a" "jsonb"[], "b" "jsonb"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_first_overlapping_availability"("a" "jsonb"[], "b" "jsonb"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_first_overlapping_availability"("a" "jsonb"[], "b" "jsonb"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_first_pairing_availability"("pairing_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_first_pairing_availability"("pairing_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_first_pairing_availability"("pairing_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_hours_range_batch"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_hours_range_batch"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_hours_range_batch"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_session_completion_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_session_completion_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_session_completion_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_overlapping_availabilities_array"("a" "jsonb"[], "b" "jsonb"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_overlapping_availabilities_array"("a" "jsonb"[], "b" "jsonb"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_overlapping_availabilities_array"("a" "jsonb"[], "b" "jsonb"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pairing_logs"("start_time" timestamp with time zone, "end_time" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_pairing_logs"("start_time" timestamp with time zone, "end_time" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pairing_logs"("start_time" timestamp with time zone, "end_time" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pairing_match"("match_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_pairing_match"("match_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pairing_match"("match_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pairing_matches_with_profiles"("requestor" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_pairing_matches_with_profiles"("requestor" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pairing_matches_with_profiles"("requestor" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pairing_requests_with_profiles"("requestor" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_pairing_requests_with_profiles"("requestor" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pairing_requests_with_profiles"("requestor" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pairing_with_profiles"("pairing_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_pairing_with_profiles"("pairing_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pairing_with_profiles"("pairing_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_period_session_completion_stats"("p_granularity" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_period_session_completion_stats"("p_granularity" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_period_session_completion_stats"("p_granularity" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_session_completion_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_session_completion_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_session_completion_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_session_hours_by_student"("p_tutor_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_session_hours_by_student"("p_tutor_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_session_hours_by_student"("p_tutor_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_session_hours_range"("input_tutor_id" "text", "input_start_date" timestamp with time zone, "input_end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_session_hours_range"("input_tutor_id" "text", "input_start_date" timestamp with time zone, "input_end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_session_hours_range"("input_tutor_id" "text", "input_start_date" timestamp with time zone, "input_end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_session_hours_range_batch"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_session_hours_range_batch"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_session_hours_range_batch"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_session_hours_range_with_student"("input_tutor_id" "text", "input_student_id" "text", "input_start_date" timestamp with time zone, "input_end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_session_hours_range_with_student"("input_tutor_id" "text", "input_student_id" "text", "input_start_date" timestamp with time zone, "input_end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_session_hours_range_with_student"("input_tutor_id" "text", "input_student_id" "text", "input_start_date" timestamp with time zone, "input_end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_top_pairing_request"("request_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_top_pairing_request"("request_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_top_pairing_request"("request_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_total_event_hours_range"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_total_event_hours_range"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_total_event_hours_range"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_total_hours"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_total_hours"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_total_hours"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_total_hours_range"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_total_hours_range"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_total_hours_range"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_total_session_hours_range"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_total_session_hours_range"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_total_session_hours_range"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tutor_sessions"("p_start_date" "text", "p_end_date" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_tutor_sessions"("p_start_date" "text", "p_end_date" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tutor_sessions"("p_start_date" "text", "p_end_date" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tutor_sessions_with_date"("p_start_date" "text", "p_end_date" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_tutor_sessions_with_date"("p_start_date" "text", "p_end_date" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tutor_sessions_with_date"("p_start_date" "text", "p_end_date" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_by_email"("email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_by_email"("email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_by_email"("email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_enrollments"("input_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_enrollments"("input_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_enrollments"("input_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_enrollments_with_profiles"("requestor_auth_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_enrollments_with_profiles"("requestor_auth_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_enrollments_with_profiles"("requestor_auth_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_enrollments_with_student_profile"("requestor_auth_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_enrollments_with_student_profile"("requestor_auth_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_enrollments_with_student_profile"("requestor_auth_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_pairings_with_profiles"("requestor_auth_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_pairings_with_profiles"("requestor_auth_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_pairings_with_profiles"("requestor_auth_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_chat_room_notification_preferences_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_chat_room_notification_preferences_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_chat_room_notification_preferences_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_pairing_from_matches"() TO "anon";
GRANT ALL ON FUNCTION "public"."insert_pairing_from_matches"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_pairing_from_matches"() TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_pairing_from_pairing_matches_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."insert_pairing_from_pairing_matches_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_pairing_from_pairing_matches_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_user_settings"() TO "anon";
GRANT ALL ON FUNCTION "public"."insert_user_settings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_user_settings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_availability"("avail" "jsonb"[], "tz" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_availability"("avail" "jsonb"[], "tz" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_availability"("avail" "jsonb"[], "tz" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_availability"("avail" "jsonb", "tz" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_availability"("avail" "jsonb", "tz" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_availability"("avail" "jsonb", "tz" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pairing_subject_priority_alignment"("requestor_subjects" "text"[], "candidate_subjects" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."pairing_subject_priority_alignment"("requestor_subjects" "text"[], "candidate_subjects" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pairing_subject_priority_alignment"("requestor_subjects" "text"[], "candidate_subjects" "text"[]) TO "service_role";



GRANT ALL ON TABLE "public"."Emails" TO "anon";
GRANT ALL ON TABLE "public"."Emails" TO "authenticated";
GRANT ALL ON TABLE "public"."Emails" TO "service_role";



GRANT ALL ON SEQUENCE "public"."Emails_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."Emails_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."Emails_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."Enrollments" TO "anon";
GRANT ALL ON TABLE "public"."Enrollments" TO "authenticated";
GRANT ALL ON TABLE "public"."Enrollments" TO "service_role";



GRANT ALL ON TABLE "public"."Events" TO "anon";
GRANT ALL ON TABLE "public"."Events" TO "authenticated";
GRANT ALL ON TABLE "public"."Events" TO "service_role";



GRANT ALL ON TABLE "public"."Forms" TO "anon";
GRANT ALL ON TABLE "public"."Forms" TO "authenticated";
GRANT ALL ON TABLE "public"."Forms" TO "service_role";



GRANT ALL ON SEQUENCE "public"."Forms_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."Forms_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."Forms_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."Meetings" TO "anon";
GRANT ALL ON TABLE "public"."Meetings" TO "authenticated";
GRANT ALL ON TABLE "public"."Meetings" TO "service_role";



GRANT ALL ON TABLE "public"."Notifications" TO "anon";
GRANT ALL ON TABLE "public"."Notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."Notifications" TO "service_role";



GRANT ALL ON TABLE "public"."Pairings" TO "anon";
GRANT ALL ON TABLE "public"."Pairings" TO "authenticated";
GRANT ALL ON TABLE "public"."Pairings" TO "service_role";



GRANT ALL ON TABLE "public"."Profiles" TO "anon";
GRANT ALL ON TABLE "public"."Profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."Profiles" TO "service_role";



GRANT ALL ON TABLE "public"."Requests" TO "anon";
GRANT ALL ON TABLE "public"."Requests" TO "authenticated";
GRANT ALL ON TABLE "public"."Requests" TO "service_role";



GRANT ALL ON TABLE "public"."Sessions" TO "anon";
GRANT ALL ON TABLE "public"."Sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."Sessions" TO "service_role";



GRANT ALL ON TABLE "public"."User_Availabilities" TO "anon";
GRANT ALL ON TABLE "public"."User_Availabilities" TO "authenticated";
GRANT ALL ON TABLE "public"."User_Availabilities" TO "service_role";



GRANT ALL ON SEQUENCE "public"."User_Availabilities_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."User_Availabilities_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."User_Availabilities_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."chat_room_notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."chat_room_notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_room_notification_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_participant" TO "anon";
GRANT ALL ON TABLE "public"."conversation_participant" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_participant" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."discord_chatbot_conversations" TO "anon";
GRANT ALL ON TABLE "public"."discord_chatbot_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."discord_chatbot_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."pairing_logs" TO "anon";
GRANT ALL ON TABLE "public"."pairing_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."pairing_logs" TO "service_role";



GRANT ALL ON TABLE "public"."pairing_matches" TO "anon";
GRANT ALL ON TABLE "public"."pairing_matches" TO "authenticated";
GRANT ALL ON TABLE "public"."pairing_matches" TO "service_role";



GRANT ALL ON TABLE "public"."pairing_requests" TO "anon";
GRANT ALL ON TABLE "public"."pairing_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."pairing_requests" TO "service_role";



GRANT ALL ON TABLE "public"."user_notification_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_notification_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_notification_settings" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_meeting_schedules" TO "anon";
GRANT ALL ON TABLE "public"."weekly_meeting_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_meeting_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."zoom_participant_events" TO "anon";
GRANT ALL ON TABLE "public"."zoom_participant_events" TO "authenticated";
GRANT ALL ON TABLE "public"."zoom_participant_events" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






