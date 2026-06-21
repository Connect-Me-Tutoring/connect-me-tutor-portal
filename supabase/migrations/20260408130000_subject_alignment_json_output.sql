-- Emit compared subject context alongside similarity: full ordered lists plus each
-- contributing match (requestor index, candidate index, subject label).
-- pairing_subject_priority_alignment delegates to pairing_subject_priority_alignment_detail.

CREATE OR REPLACE FUNCTION public.pairing_subject_priority_alignment_detail(
  requestor_subjects text[],
  candidate_subjects text[]
)
RETURNS jsonb
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
  matched_rows AS (
    SELECT
      pos.elem AS subject,
      pos.ord::integer AS requestor_index,
      array_position(cb.c, pos.elem)::integer AS candidate_index
    FROM ra
    CROSS JOIN cb
    CROSS JOIN LATERAL unnest(ra.r) WITH ORDINALITY AS pos(elem, ord)
    WHERE array_position(cb.c, pos.elem) IS NOT NULL
  ),
  raw_sum AS (
    SELECT COALESCE(
      SUM(
        (d.n - mr.requestor_index + 1)::numeric
        * (d.m - mr.candidate_index + 1)::numeric
      ),
      0::numeric
    ) AS v
    FROM matched_rows mr
    CROSS JOIN dims d
  ),
  max_sum AS (
    SELECT COALESCE(
      SUM((d.n - s.k + 1)::numeric * (d.m - s.k + 1)::numeric),
      0::numeric
    ) AS v
    FROM dims d
    CROSS JOIN LATERAL generate_series(1, GREATEST(LEAST(d.n, d.m), 0)) AS s(k)
  ),
  sim AS (
    SELECT
      CASE
        WHEN (SELECT v FROM max_sum) = 0 THEN 0::numeric
        ELSE LEAST(
          1::numeric,
          (SELECT v FROM raw_sum) / NULLIF((SELECT v FROM max_sum), 0)
        )
      END AS similarity
  )
  SELECT jsonb_build_object(
    'similarity', (SELECT similarity FROM sim),
    'requestor_subjects', (SELECT to_jsonb(r) FROM ra),
    'candidate_subjects', (SELECT to_jsonb(c) FROM cb),
    'matched', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'subject', mr.subject,
            'requestor_index', mr.requestor_index,
            'candidate_index', mr.candidate_index
          )
          ORDER BY mr.requestor_index
        )
        FROM matched_rows mr
      ),
      '[]'::jsonb
    )
  );
$$;

COMMENT ON FUNCTION public.pairing_subject_priority_alignment_detail(text[], text[]) IS
  'JSON with similarity, echo of both ordered subject arrays, and matched index pairs used for scoring.';

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
  SELECT (public.pairing_subject_priority_alignment_detail(requestor_subjects, candidate_subjects)->>'similarity')::numeric;
$$;

-- Return type adds subject_alignment jsonb; must drop prior signature.
DROP FUNCTION IF EXISTS public.lookup_proposed_matches(text, uuid, uuid[], integer);
DROP FUNCTION IF EXISTS public.lookup_proposed_matches_static(text[], jsonb, text[], integer, text);

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
  rank_score numeric,
  subject_alignment jsonb
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
$$;

COMMENT ON FUNCTION public.lookup_proposed_matches(text, uuid, uuid[], integer) IS
  'Ranked pairing-queue candidates: queue priority band + priority-aligned subject fit; subject_alignment = compared lists + matched index pairs (no duplicate similarity key).';

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
  rank_score numeric,
  subject_alignment jsonb
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
      public.pairing_subject_priority_alignment_detail(p_requestor_subjects, f.subs) AS detail_json
    FROM filtered f
  ),
  ranked AS (
    SELECT
      s.cid,
      s.pri,
      s.fn,
      s.ln,
      s.em,
      (s.detail_json->>'similarity')::numeric AS sim,
      ((4 - LEAST(s.pri, 3))::numeric * 10.0) + ((s.detail_json->>'similarity')::numeric * 100.0) AS rscore,
      (s.detail_json - 'similarity') AS align_json
    FROM scored s
  )
  SELECT
    r.cid AS candidate_id,
    r.fn AS match_first_name,
    r.ln AS match_last_name,
    r.em AS match_email,
    r.sim AS similarity,
    r.rscore AS rank_score,
    r.align_json AS subject_alignment
  FROM ranked r
  ORDER BY r.rscore DESC, r.pri ASC, r.ln, r.fn
  LIMIT (CASE WHEN p_limit IS NULL OR p_limit < 1 THEN 5 ELSE p_limit END);
$$;

COMMENT ON FUNCTION public.lookup_proposed_matches_static(text[], jsonb, text[], integer, text) IS
  'Static ranked matches; similarity from pairing_subject_priority_alignment; subject_alignment = both ordered subject arrays plus matched index pairs (no duplicate similarity).';

GRANT EXECUTE ON FUNCTION public.pairing_subject_priority_alignment_detail(text[], text[]) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_proposed_matches_static(text[], jsonb, text[], integer, text) TO PUBLIC;

DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE
      'GRANT EXECUTE ON FUNCTION public.lookup_proposed_matches(text, uuid, uuid[], integer) TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE
      'GRANT EXECUTE ON FUNCTION public.lookup_proposed_matches(text, uuid, uuid[], integer) TO service_role';
  END IF;
END;
$grant$;
