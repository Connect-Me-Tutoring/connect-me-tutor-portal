-- Subject lists are ordered by priority (index 1 = most important).
-- Similarity uses bilateral priority weights (Nash-style aligned surplus on early positions):
--   raw = sum over each requestor position i where R[i] appears in candidate list at first index j:
--         (n - i + 1) * (m - j + 1)
--   max_raw = sum_{k=1}^{min(n,m)} (n - k + 1) * (m - k + 1)  [perfect term-by-term alignment at top]
--   similarity = min(1, raw / max_raw)
-- Replaces unordered Jaccard in lookup_proposed_matches and lookup_proposed_matches_static.

CREATE OR REPLACE FUNCTION public.pairing_subject_priority_alignment(
  requestor_subjects text[],
  candidate_subjects text[]
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
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

COMMENT ON FUNCTION public.pairing_subject_priority_alignment(text[], text[]) IS
  'Priority-ordered subject fit in [0,1]: earlier entries in each array matter more; '
  'normalized by the best possible score when lists align position-wise at the top.';

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
        public.pairing_subject_priority_alignment(
          COALESCE(v_requestor_subjects, '{}'::text[]),
          COALESCE(p.subjects_of_interest, '{}'::text[])
        ) AS sim
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
      cpr.sim AS similarity,
      ((4 - LEAST(cpr.priority, 3))::numeric * 10.0) + (cpr.sim * 100.0) AS rank_score
    FROM (
      SELECT
        pr2.id AS pr2_id,
        pr2.priority,
        pr2.user_id AS cand_user_id,
        public.pairing_subject_priority_alignment(
          COALESCE(v_requestor_subjects, '{}'::text[]),
          COALESCE(p.subjects_of_interest, '{}'::text[])
        ) AS sim
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
  'Ranked pairing-queue candidates: queue priority band + priority-aligned subject fit (see pairing_subject_priority_alignment).';

CREATE OR REPLACE FUNCTION public.lookup_proposed_matches_static(
  p_requestor_subjects text[],
  p_candidates jsonb,
  p_exclude_ids text[] DEFAULT NULL,
  p_limit integer DEFAULT 5,
  p_requestor_role text DEFAULT NULL
)
RETURNS TABLE (
  candidate_id text,
  match_first_name text,
  match_last_name text,
  match_email text,
  similarity numeric,
  rank_score numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH expanded AS (
    SELECT
      elem->>'id' AS cid,
      CASE
        WHEN elem->>'priority' ~ '^[0-9]+$' THEN (elem->>'priority')::integer
        ELSE 2
      END AS pri,
      ARRAY(
        SELECT jsonb_array_elements_text(COALESCE(elem->'subjects', '[]'::jsonb))
      ) AS subs,
      COALESCE(elem->>'first_name', '') AS fn,
      COALESCE(elem->>'last_name', '') AS ln,
      COALESCE(elem->>'email', '') AS em,
      COALESCE(elem->>'role', '') AS cand_role
    FROM jsonb_array_elements(COALESCE(p_candidates, '[]'::jsonb)) AS t(elem)
  ),
  role_ok AS (
    SELECT e.*
    FROM expanded e
    WHERE p_requestor_role IS NULL
      OR trim(p_requestor_role) = ''
      OR lower(p_requestor_role) NOT IN ('student', 'tutor')
      OR trim(e.cand_role) = ''
      OR lower(e.cand_role) NOT IN ('student', 'tutor')
      OR (
        lower(p_requestor_role) = 'student'
        AND lower(e.cand_role) = 'tutor'
      )
      OR (
        lower(p_requestor_role) = 'tutor'
        AND lower(e.cand_role) = 'student'
      )
  ),
  filtered AS (
    SELECT *
    FROM role_ok e
    WHERE p_exclude_ids IS NULL
      OR cardinality(p_exclude_ids) = 0
      OR NOT (e.cid = ANY (p_exclude_ids))
  ),
  scored AS (
    SELECT
      f.cid,
      f.pri,
      f.fn,
      f.ln,
      f.em,
      public.pairing_subject_priority_alignment(p_requestor_subjects, f.subs) AS sim
    FROM filtered f
  ),
  ranked AS (
    SELECT
      s.cid,
      s.pri,
      s.fn,
      s.ln,
      s.em,
      s.sim,
      ((4 - LEAST(s.pri, 3))::numeric * 10.0) + (s.sim * 100.0) AS rscore
    FROM scored s
  )
  SELECT
    r.cid AS candidate_id,
    r.fn AS match_first_name,
    r.ln AS match_last_name,
    r.em AS match_email,
    r.sim AS similarity,
    r.rscore AS rank_score
  FROM ranked r
  ORDER BY r.rscore DESC, r.pri ASC, r.ln, r.fn
  LIMIT (CASE WHEN p_limit IS NULL OR p_limit < 1 THEN 5 ELSE p_limit END);
$$;

COMMENT ON FUNCTION public.lookup_proposed_matches_static(text[], jsonb, text[], integer, text) IS
  'Static ranked matches; similarity = pairing_subject_priority_alignment (ordered subject lists). '
  'Optional p_requestor_role filters candidate role.';

GRANT EXECUTE ON FUNCTION public.pairing_subject_priority_alignment(text[], text[]) TO PUBLIC;
