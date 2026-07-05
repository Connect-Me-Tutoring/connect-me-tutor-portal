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
  'Priority-ordered subject fit in [0,1]: earlier entries in each array matter more; normalized by best possible aligned score.';

GRANT EXECUTE ON FUNCTION public.pairing_subject_priority_alignment(text[], text[]) TO PUBLIC;

DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE
      'GRANT EXECUTE ON FUNCTION public.pairing_subject_priority_alignment(text[], text[]) TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE
      'GRANT EXECUTE ON FUNCTION public.pairing_subject_priority_alignment(text[], text[]) TO service_role';
  END IF;
END;
$grant$;
