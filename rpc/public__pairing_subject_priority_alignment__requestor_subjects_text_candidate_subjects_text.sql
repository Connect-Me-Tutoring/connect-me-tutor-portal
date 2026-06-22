CREATE OR REPLACE FUNCTION public.pairing_subject_priority_alignment(requestor_subjects text[], candidate_subjects text[])
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO 'public'
AS $function$
  SELECT (public.pairing_subject_priority_alignment_detail(requestor_subjects, candidate_subjects)->>'similarity')::numeric;
$function$
