CREATE OR REPLACE FUNCTION public.lookup_proposed_matches_static(p_requestor_subjects text[], p_candidates jsonb, p_exclude_ids text[] DEFAULT NULL::text[], p_limit integer DEFAULT 5, p_requestor_role text DEFAULT NULL::text)
 RETURNS TABLE(candidate_id text, match_first_name text, match_last_name text, match_email text, similarity numeric, rank_score numeric, subject_alignment jsonb)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
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
$function$
