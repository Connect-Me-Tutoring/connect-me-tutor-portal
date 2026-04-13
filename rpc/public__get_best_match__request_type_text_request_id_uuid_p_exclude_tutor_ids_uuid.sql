CREATE OR REPLACE FUNCTION public.get_best_match(request_type text, request_id uuid, p_exclude_tutor_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(pairing_request_id uuid, similarity double precision, match_profile jsonb, requestor_profile jsonb)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
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
    ) AS r(day text, start_ts timestamptz, end_ts timestamptz)
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
    ) AS slot(day text, start_ts timestamptz, end_ts timestamptz)
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
$function$;
