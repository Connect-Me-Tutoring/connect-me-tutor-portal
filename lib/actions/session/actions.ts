/** Zoom webhook: payload.object → Zoom meeting number → `Meetings` row → `Sessions` row */
export type ZoomSessionResolution = {
  /** Zoom `object.id` / `meeting_number` (numeric string) */
  zoomMeetingNumber: string | undefined;
  /** Zoom `object.uuid` (often base64) */
  zoomMeetingUuid: string | undefined;
  /** `Meetings.id` */
  meetingsRowId: string | null;
  /** `Meetings.meeting_id` as stored */
  storedMeetingId: string | null;
  /** `Sessions.id` when an active past session matches */
  appSessionId: string | null;
};

export function zoomSessionResolutionStatus(
  r: ZoomSessionResolution,
):
  | "no_meeting_number_in_payload"
  | "meeting_not_in_database"
  | "no_matching_active_session"
  | "session_resolved" {
  if (!r.zoomMeetingNumber) return "no_meeting_number_in_payload";
  if (!r.meetingsRowId) return "meeting_not_in_database";
  if (!r.appSessionId) return "no_matching_active_session";
  return "session_resolved";
}
