CREATE OR REPLACE FUNCTION public.pairing_subject_priority_alignment_detail(requestor_subjects text[], candidate_subjects text[])
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO 'public'
AS $function$
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
$function$
