CREATE OR REPLACE FUNCTION public."Automatically_create_pairing_from_enrollments"()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$DECLARE
  pairing_uuid UUID;
BEGIN
  -- Try to find an existing pairing
  SELECT p.id
  INTO pairing_uuid
  FROM public."Pairings" p
  WHERE p.student_id = NEW.student_id
    AND p.tutor_id = NEW.tutor_id
  LIMIT 1;

  -- If not found, insert a new pairing
  IF pairing_uuid IS NULL THEN
    INSERT INTO public."Pairings"(student_id, tutor_id)
    VALUES (NEW.student_id, NEW.tutor_id)
    RETURNING id INTO pairing_uuid;
  END IF;

  -- Set the enrollment's pairing_id
  NEW.pairing_id := pairing_uuid;

  RETURN NEW;
END;$function$
