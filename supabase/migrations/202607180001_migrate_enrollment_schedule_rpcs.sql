-- Complete the move from Enrollments.availability to scalar schedule columns,
-- then keep every enrollment RPC aligned with the new contract.

ALTER TABLE public."Enrollments"
  ADD COLUMN IF NOT EXISTS day text,
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time;

-- Backfill deployments that still have the legacy JSON column. The dynamic
-- statement lets this migration remain safe where that column was removed
-- separately before this repository migration was introduced.
DO $migration$
DECLARE
  has_unmigrated_schedule boolean;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Enrollments'
      AND column_name = 'availability'
  ) THEN
    EXECUTE $backfill$
      UPDATE public."Enrollments"
      SET
        day = COALESCE(day, availability->0->>'day'),
        start_time = COALESCE(
          start_time,
          CASE
            WHEN COALESCE(
              availability->0->>'startTime',
              availability->0->>'start_time'
            ) ~ '^[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?$'
            THEN COALESCE(
              availability->0->>'startTime',
              availability->0->>'start_time'
            )::time
          END
        ),
        end_time = COALESCE(
          end_time,
          CASE
            WHEN COALESCE(
              availability->0->>'endTime',
              availability->0->>'end_time'
            ) ~ '^[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?$'
            THEN COALESCE(
              availability->0->>'endTime',
              availability->0->>'end_time'
            )::time
          END
        )
      WHERE availability IS NOT NULL
        AND jsonb_typeof(availability::jsonb) = 'array'
    $backfill$;

    EXECUTE $check$
      SELECT EXISTS (
        SELECT 1
        FROM public."Enrollments"
        WHERE availability IS NOT NULL
          AND availability::jsonb <> 'null'::jsonb
          AND (
            day IS NULL
            OR start_time IS NULL
            OR end_time IS NULL
          )
          AND CASE
            WHEN jsonb_typeof(availability::jsonb) = 'array'
              THEN jsonb_array_length(availability::jsonb) > 0
            ELSE true
          END
      )
    $check$ INTO has_unmigrated_schedule;

    IF has_unmigrated_schedule THEN
      RAISE EXCEPTION
        'Cannot drop Enrollments.availability: some schedules could not be backfilled';
    END IF;
  END IF;
END;
$migration$;

ALTER TABLE public."Enrollments"
  DROP COLUMN IF EXISTS availability;

-- PostgreSQL requires dropping these functions because their TABLE return
-- signatures change when availability is replaced by three scalar columns.

DROP FUNCTION IF EXISTS public.get_enrollment_with_profiles(uuid);

CREATE FUNCTION public.get_enrollment_with_profiles(enrollment_uuid uuid)
RETURNS TABLE(
  id uuid,
  created_at timestamptz,
  student_id uuid,
  tutor_id uuid,
  summary text,
  start_date date,
  end_date date,
  day text,
  start_time time,
  end_time time,
  meetingid uuid,
  summer_paused boolean,
  duration integer,
  student jsonb,
  tutor jsonb
)
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
    e.day,
    e.start_time,
    e.end_time,
    e."meetingId",
    e.paused,
    e.duration::integer,
    jsonb_build_object(
      'id', sp.id,
      'user_id', sp.user_id,
      'first_name', sp.first_name,
      'last_name', sp.last_name,
      'email', sp.email
    ),
    jsonb_build_object(
      'id', tp.id,
      'user_id', tp.user_id,
      'first_name', tp.first_name,
      'last_name', tp.last_name,
      'email', tp.email
    )
  FROM public."Enrollments" e
  LEFT JOIN public."Profiles" sp ON sp.id = e.student_id
  LEFT JOIN public."Profiles" tp ON tp.id = e.tutor_id
  WHERE e.id = enrollment_uuid;
END;
$function$;

DROP FUNCTION IF EXISTS public.get_enrollments_with_student_profile();

CREATE FUNCTION public.get_enrollments_with_student_profile()
RETURNS TABLE(
  id uuid,
  created_at timestamptz,
  student_id uuid,
  tutor_id uuid,
  summary text,
  start_date date,
  end_date date,
  day text,
  start_time time,
  end_time time,
  meetingid uuid,
  summer_paused boolean,
  duration integer,
  profile_id uuid,
  profile_user_id uuid,
  first_name text,
  last_name text,
  email text
)
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
    e.day,
    e.start_time,
    e.end_time,
    e."meetingId",
    e.paused,
    e.duration::integer,
    p.id,
    p.user_id,
    p.first_name,
    p.last_name,
    p.email
  FROM public."Enrollments" e
  LEFT JOIN public."Profiles" p ON p.id = e.student_id
  ORDER BY e.created_at DESC;
END;
$function$;

DROP FUNCTION IF EXISTS public.get_user_enrollments(uuid);

CREATE FUNCTION public.get_user_enrollments(input_user_id uuid)
RETURNS TABLE(
  id uuid,
  created_at timestamptz,
  student_id uuid,
  tutor_id uuid,
  summary text,
  start_date timestamptz,
  end_date timestamptz,
  day text,
  start_time time,
  end_time time,
  "meetingId" uuid,
  summer_paused boolean,
  duration real,
  profile_id uuid,
  profile_user_id uuid,
  profile_name text,
  profile_email text
)
LANGUAGE sql
SECURITY DEFINER
AS $function$
  SELECT
    e.id,
    e.created_at,
    e.student_id,
    e.tutor_id,
    e.summary,
    e.start_date,
    e.end_date,
    e.day,
    e.start_time,
    e.end_time,
    e."meetingId",
    e.paused,
    e.duration,
    p.id,
    p.user_id,
    p.first_name,
    p.email
  FROM public."Enrollments" e
  LEFT JOIN public."Profiles" p ON p.user_id = input_user_id
  WHERE e.tutor_id = p.id OR e.student_id = p.id
  ORDER BY e.created_at DESC;
$function$;

DROP FUNCTION IF EXISTS public.get_user_enrollments_with_profiles(uuid);

CREATE FUNCTION public.get_user_enrollments_with_profiles(requestor_auth_id uuid)
RETURNS TABLE(
  id uuid,
  created_at timestamptz,
  summary text,
  start_date date,
  end_date date,
  day text,
  start_time time,
  end_time time,
  meetingid uuid,
  summer_paused boolean,
  duration integer,
  student jsonb,
  tutor jsonb
)
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
    e.day,
    e.start_time,
    e.end_time,
    e."meetingId",
    e.paused,
    e.duration::integer,
    jsonb_build_object(
      'id', sp.id,
      'user_id', sp.user_id,
      'first_name', sp.first_name,
      'last_name', sp.last_name,
      'email', sp.email
    ),
    jsonb_build_object(
      'id', tp.id,
      'user_id', tp.user_id,
      'first_name', tp.first_name,
      'last_name', tp.last_name,
      'email', tp.email
    )
  FROM public."Enrollments" e
  JOIN public."Profiles" req_profile ON req_profile.user_id = requestor_auth_id
  LEFT JOIN public."Profiles" sp ON sp.id = e.student_id
  LEFT JOIN public."Profiles" tp ON tp.id = e.tutor_id
  WHERE e.student_id = req_profile.id OR e.tutor_id = req_profile.id
  ORDER BY e.created_at DESC;
END;
$function$;

DROP FUNCTION IF EXISTS public.get_user_enrollments_with_student_profile(uuid);

CREATE FUNCTION public.get_user_enrollments_with_student_profile(requestor_auth_id uuid)
RETURNS TABLE(
  id uuid,
  created_at timestamptz,
  student_id uuid,
  tutor_id uuid,
  summary text,
  start_date date,
  end_date date,
  day text,
  start_time time,
  end_time time,
  meetingid uuid,
  summer_paused boolean,
  duration integer,
  student_profile_id uuid,
  student_user_id uuid,
  student_first_name text,
  student_last_name text,
  student_email text
)
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
    e.day,
    e.start_time,
    e.end_time,
    e."meetingId",
    e.paused,
    e.duration::integer,
    sp.id,
    sp.user_id,
    sp.first_name,
    sp.last_name,
    sp.email
  FROM public."Enrollments" e
  JOIN public."Profiles" req_profile ON req_profile.user_id = requestor_auth_id
  LEFT JOIN public."Profiles" sp ON sp.id = e.student_id
  WHERE e.student_id = req_profile.id OR e.tutor_id = req_profile.id
  ORDER BY e.created_at DESC;
END;
$function$;
