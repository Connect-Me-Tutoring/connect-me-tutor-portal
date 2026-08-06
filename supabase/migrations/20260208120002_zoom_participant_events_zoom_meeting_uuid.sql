-- Zoom sends meeting uuid as base64 (e.g. wv/XCz6WSjuDwQYhsE2qJg==), not PostgreSQL uuid.
-- Store it in text; keep session_id as resolved app Sessions.id only.

ALTER TABLE zoom_participant_events
  ALTER COLUMN session_id DROP NOT NULL;

ALTER TABLE zoom_participant_events
  ADD COLUMN IF NOT EXISTS zoom_meeting_uuid text;

COMMENT ON COLUMN zoom_participant_events.zoom_meeting_uuid IS
  'Zoom meeting UUID from webhook payload (often base64); used when app session_id is unknown.';

CREATE INDEX IF NOT EXISTS idx_zoom_participant_events_zoom_meeting_uuid
  ON zoom_participant_events (zoom_meeting_uuid);
