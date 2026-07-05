CREATE OR REPLACE FUNCTION public.lookup_proposed_matches(request_type text, p_request_id uuid, p_exclude_tutor_ids uuid[] DEFAULT NULL::uuid[], p_limit integer DEFAULT 5)
 RETURNS TABLE(candidate_pairing_request_id uuid, match_profile_id uuid, match_first_name text, match_last_name text, match_email text, similarity numeric, rank_score numeric, subject_alignment jsonb)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_requestor_id uuid;
  v_requestor_subjects text[];
  v_target_type text;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 THEN
    p_limit := 5;
  END IF;

  SELECT pr.user_id, COALESCE(p.subjects_of_interest, '{}'::text[])
  INTO v_requestor_id, v_requestor_subjects
  FROM pairing_requests pr
  JOIN public."Profiles" p ON p.id = pr.user_id
  WHERE pr.id = p_request_id
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

  IF request_type = 'student' THEN
    RETURN QUERY
    SELECT
      cpr.pr2_id AS candidate_pairing_request_id,
      cp.id AS match_profile_id,
      cp.first_name AS match_first_name,
      cp.last_name AS match_last_name,
      cp.email AS match_email,
      (cpr.detail_json->>'similarity')::numeric AS similarity,
      ((4 - LEAST(cpr.priority, 3))::numeric * 10.0) + ((cpr.detail_json->>'similarity')::numeric * 100.0) AS rank_score,
      (cpr.detail_json - 'similarity') AS subject_alignment
    FROM (
      SELECT
        pr2.id AS pr2_id,
        pr2.priority,
        pr2.user_id AS cand_user_id,
        public.pairing_subject_priority_alignment_detail(
          COALESCE(v_requestor_subjects, '{}'::text[]),
          COALESCE(p.subjects_of_interest, '{}'::text[])
        ) AS detail_json
      FROM pairing_requests pr2
      JOIN public."Profiles" p ON p.id = pr2.user_id
      WHERE pr2.type = v_target_type
        AND pr2.in_queue IS DISTINCT FROM false
        AND pr2.id <> p_request_id
        AND NOT EXISTS (
          SELECT 1
          FROM public."Pairings" pair
          WHERE pair.student_id = v_requestor_id
            AND pair.tutor_id = pr2.user_id
        )
        AND (
          p_exclude_tutor_ids IS NULL
          OR CARDINALITY(p_exclude_tutor_ids) = 0
          OR NOT (pr2.user_id = ANY (p_exclude_tutor_ids))
        )
    ) AS cpr
    JOIN public."Profiles" cp ON cp.id = cpr.cand_user_id
    ORDER BY rank_score DESC, cpr.priority ASC, cp.last_name, cp.first_name
    LIMIT p_limit;

  ELSE
    RETURN QUERY
    SELECT
      cpr.pr2_id AS candidate_pairing_request_id,
      cp.id AS match_profile_id,
      cp.first_name AS match_first_name,
      cp.last_name AS match_last_name,
      cp.email AS match_email,
      (cpr.detail_json->>'similarity')::numeric AS similarity,
      ((4 - LEAST(cpr.priority, 3))::numeric * 10.0) + ((cpr.detail_json->>'similarity')::numeric * 100.0) AS rank_score,
      (cpr.detail_json - 'similarity') AS subject_alignment
    FROM (
      SELECT
        pr2.id AS pr2_id,
        pr2.priority,
        pr2.user_id AS cand_user_id,
        public.pairing_subject_priority_alignment_detail(
          COALESCE(v_requestor_subjects, '{}'::text[]),
          COALESCE(p.subjects_of_interest, '{}'::text[])
        ) AS detail_json
      FROM pairing_requests pr2
      JOIN public."Profiles" p ON p.id = pr2.user_id
      WHERE pr2.type = v_target_type
        AND pr2.in_queue IS DISTINCT FROM false
        AND pr2.id <> p_request_id
        AND NOT EXISTS (
          SELECT 1
          FROM public."Pairings" pair
          WHERE pair.tutor_id = v_requestor_id
            AND pair.student_id = pr2.user_id
        )
    ) AS cpr
    JOIN public."Profiles" cp ON cp.id = cpr.cand_user_id
    ORDER BY rank_score DESC, cpr.priority ASC, cp.last_name, cp.first_name
    LIMIT p_limit;
  END IF;
END;
$function$
