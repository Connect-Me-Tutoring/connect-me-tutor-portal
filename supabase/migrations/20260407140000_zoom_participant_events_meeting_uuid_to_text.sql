-- Zoom meeting instance ids are often base64 (e.g. xD/tJy24TvyF7gohBpDvCw==), not PostgreSQL uuid.
-- If this column was created as uuid, inserts fail with 22P02.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'zoom_participant_events'
      AND c.column_name = 'zoom_meeting_uuid'
      AND c.data_type IS DISTINCT FROM 'text'
  ) THEN
    ALTER TABLE public.zoom_participant_events
      ALTER COLUMN zoom_meeting_uuid TYPE text
      USING (zoom_meeting_uuid::text);
  END IF;
END $$;

COMMENT ON COLUMN public.zoom_participant_events.zoom_meeting_uuid IS
  'Zoom meeting UUID from webhook: base64 or hyphenated uuid; stored as text.';
