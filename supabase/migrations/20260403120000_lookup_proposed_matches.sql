-- Proposed-match lookup: ranked preview candidates for a pairing request.
-- Complements get_best_match (single pick) with a transparent algorithm in the database.
--
-- Algorithm (STABLE, deterministic ordering):
--   rank_score = (queue_priority_component) + (subject_jaccard * 100)
--   - queue_priority_component = (4 - least(candidate.priority, 3)) * 10  → lower numeric
--     priority in pairing_requests is better (aligned with UI sort ascending).
--   - subject_jaccard = |A ∩ B| / |A ∪ B| on coalesce(subjects_of_interest, '{}')
-- Excludes: p_exclude_tutor_ids (student flow), existing rows in "Pairings", and
-- candidates not in_queue.

CREATE OR REPLACE FUNCTION public.lookup_proposed_matches(
  request_type text,
  p_request_id uuid,
  p_exclude_tutor_ids uuid[] DEFAULT NULL,
  p_limit integer DEFAULT 5
)
RETURNS TABLE (
  candidate_pairing_request_id uuid,
  match_profile_id uuid,
  match_first_name text,
  match_last_name text,
  match_email text,
  similarity numeric,
  rank_score numeric
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
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
      cpr.sim AS similarity,
      ((4 - LEAST(cpr.priority, 3))::numeric * 10.0) + (cpr.sim * 100.0) AS rank_score
    FROM (
      SELECT
        pr2.id AS pr2_id,
        pr2.priority,
        pr2.user_id AS cand_user_id,
        CASE
          WHEN CARDINALITY(COALESCE(v_requestor_subjects, '{}'::text[]) || COALESCE(p.subjects_of_interest, '{}'::text[])) = 0
            THEN 0::numeric
          ELSE (
            (
              SELECT COUNT(*)::numeric
              FROM (
                SELECT UNNEST(COALESCE(v_requestor_subjects, '{}'::text[]))
                INTERSECT
                SELECT UNNEST(COALESCE(p.subjects_of_interest, '{}'::text[]))
              ) inter
            )
            / NULLIF(
                (
                  SELECT COUNT(DISTINCT u)::numeric
                  FROM UNNEST(
                    COALESCE(v_requestor_subjects, '{}'::text[]) || COALESCE(p.subjects_of_interest, '{}'::text[])
                  ) AS u
                ),
                0
              )
          )
        END AS sim
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
    -- tutor → student candidates
    RETURN QUERY
    SELECT
      cpr.pr2_id AS candidate_pairing_request_id,
      cp.id AS match_profile_id,
      cp.first_name AS match_first_name,
      cp.last_name AS match_last_name,
      cp.email AS match_email,
      cpr.sim AS similarity,
      ((4 - LEAST(cpr.priority, 3))::numeric * 10.0) + (cpr.sim * 100.0) AS rank_score
    FROM (
      SELECT
        pr2.id AS pr2_id,
        pr2.priority,
        pr2.user_id AS cand_user_id,
        CASE
          WHEN CARDINALITY(COALESCE(v_requestor_subjects, '{}'::text[]) || COALESCE(p.subjects_of_interest, '{}'::text[])) = 0
            THEN 0::numeric
          ELSE (
            (
              SELECT COUNT(*)::numeric
              FROM (
                SELECT UNNEST(COALESCE(v_requestor_subjects, '{}'::text[]))
                INTERSECT
                SELECT UNNEST(COALESCE(p.subjects_of_interest, '{}'::text[]))
              ) inter
            )
            / NULLIF(
                (
                  SELECT COUNT(DISTINCT u)::numeric
                  FROM UNNEST(
                    COALESCE(v_requestor_subjects, '{}'::text[]) || COALESCE(p.subjects_of_interest, '{}'::text[])
                  ) AS u
                ),
                0
              )
          )
        END AS sim
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
$$;

COMMENT ON FUNCTION public.lookup_proposed_matches(text, uuid, uuid[], integer) IS
  'Ranked pairing-queue candidates: priority band + Jaccard(subject overlap). For preview/admin; production match may use get_best_match.';

GRANT EXECUTE ON FUNCTION public.lookup_proposed_matches(text, uuid, uuid[], integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_proposed_matches(text, uuid, uuid[], integer) TO service_role;
