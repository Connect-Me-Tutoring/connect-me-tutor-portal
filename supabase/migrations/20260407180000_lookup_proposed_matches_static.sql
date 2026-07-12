-- Standalone matching helpers: same Jaccard + rank_score as lookup_proposed_matches,
-- but inputs are static arrays/JSON — no pairing_requests, Profiles, or Pairings.
-- Use for tests and local logic checks on any Postgres once this migration is applied.

CREATE OR REPLACE FUNCTION public.pairing_subject_jaccard(
  requestor_subjects text[],
  candidate_subjects text[]
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE
    WHEN cardinality(coalesce(requestor_subjects, '{}'::text[]) || coalesce(candidate_subjects, '{}'::text[])) = 0
      THEN 0::numeric
    ELSE (
      (
        SELECT COUNT(*)::numeric
        FROM (
          SELECT UNNEST(coalesce(requestor_subjects, '{}'::text[]))
          INTERSECT
          SELECT UNNEST(coalesce(candidate_subjects, '{}'::text[]))
        ) inter
      )
      / NULLIF(
          (
            SELECT COUNT(DISTINCT u)::numeric
            FROM UNNEST(
              coalesce(requestor_subjects, '{}'::text[]) || coalesce(candidate_subjects, '{}'::text[])
            ) AS u
          ),
          0
        )
    )
  END;
$$;

COMMENT ON FUNCTION public.pairing_subject_jaccard(text[], text[]) IS
  'Jaccard similarity on subject tag sets; matches lookup_proposed_matches behavior.';

CREATE OR REPLACE FUNCTION public.lookup_proposed_matches_static(
  p_requestor_subjects text[],
  p_candidates jsonb,
  p_exclude_ids text[] DEFAULT NULL,
  p_limit integer DEFAULT 5
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
      COALESCE(elem->>'email', '') AS em
    FROM jsonb_array_elements(COALESCE(p_candidates, '[]'::jsonb)) AS t(elem)
  ),
  filtered AS (
    SELECT *
    FROM expanded e
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
      public.pairing_subject_jaccard(p_requestor_subjects, f.subs) AS sim
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

COMMENT ON FUNCTION public.lookup_proposed_matches_static(text[], jsonb, text[], integer) IS
  'Rank candidates from static JSON: same formula as lookup_proposed_matches (priority band + Jaccard*100). '
  'Each candidate: {"id","priority","subjects":[],"first_name","last_name","email"}.';

GRANT EXECUTE ON FUNCTION public.pairing_subject_jaccard(text[], text[]) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_proposed_matches_static(text[], jsonb, text[], integer) TO PUBLIC;
