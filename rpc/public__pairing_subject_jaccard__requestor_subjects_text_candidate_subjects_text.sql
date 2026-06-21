CREATE OR REPLACE FUNCTION public.pairing_subject_jaccard(requestor_subjects text[], candidate_subjects text[])
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO 'public'
AS $function$
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
$function$
