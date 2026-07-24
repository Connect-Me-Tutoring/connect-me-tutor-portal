"use server";
// zoomLogger.ts
import { createClient } from "@supabase/supabase-js";
import { logEvent, logError } from "@/lib/posthog";
import crypto from "crypto";
import { Table } from "@/lib/supabase/tables";

// Init Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role key required for inserting rows
);

/** App `Sessions.id` only — never Zoom's base64 meeting uuid */
function isAppSessionUuid(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

/**
 * Only persist `session_id` when it is a real `Sessions.id`. A webhook may supply a
 * UUID-shaped Zoom value (e.g. meeting instance uuid) that is not a session row — that
 * would violate FK on `zoom_participant_events.session_id`.
 */
async function resolveAppSessionIdForZoomEvent(
  candidate: string | null | undefined,
  zoomMeetingUuid: string | null | undefined,
): Promise<string | null> {
  if (!isAppSessionUuid(candidate)) return null;
  const sid = candidate.trim();
  const zoom = zoomMeetingUuid?.trim();
  if (zoom && sid.toLowerCase() === zoom.toLowerCase()) return null;

  const { data, error } = await supabase
    .from(Table.Sessions)
    .select("id")
    .eq("id", sid)
    .maybeSingle();

  if (error) {
    console.error("resolveAppSessionIdForZoomEvent:", error);
    await logError(error, { action: "resolveAppSessionIdForZoomEvent", candidate: sid, zoomMeetingUuid: zoom }, "zoom_action_error");
    return null;
  }
  return data?.id ?? null;
}

/** PostHog + DB context: Zoom payload → Meetings → Sessions chain */
export type ZoomWebhookRelationshipLog = {
  resolution_status: string;
  meetings_row_id: string | null;
  meetings_table_meeting_id: string | null;
  zoom_meeting_number: string | null;
  zoom_meeting_uuid: string | null;
  app_session_id: string | null;
};

interface ZoomParticipantData {
  /** Resolved app session id (`Sessions.id`); null if not resolved */
  session_id: string | null;
  /** Zoom payload `object.uuid` (often base64); stored as text, not in session_id */
  zoom_meeting_uuid: string | null;
  participant_id: string;
  name: string;
  email?: string;
  action: "joined" | "left";
  timestamp: string; // ISO format datetime
  relationship?: ZoomWebhookRelationshipLog;
}

export interface ParticipationRecord {
  id: string;
  participant_id: string;
  name: string;
  email: string;
  action: string;
  timestamp: string;
  session_id: string | null;
  zoom_meeting_uuid?: string | null;
}

/**
 * Log Zoom Account Activity (participant joined or left)
 * @param participant
 * @returns
 */
export async function logZoomMetadata(participant: ZoomParticipantData) {
  const logId = crypto.randomUUID();
  const sessionIdForDb = await resolveAppSessionIdForZoomEvent(
    participant.session_id,
    participant.zoom_meeting_uuid,
  );

  await logEvent("zoom_metadata_insert_start", {
    log_id: logId,
    session_id: sessionIdForDb,
    zoom_meeting_uuid: participant.zoom_meeting_uuid,
    participant_id: participant.participant_id,
    participant_name: participant.name,
    participant_email: participant.email,
    action: participant.action,
    timestamp: participant.timestamp,
    has_session_id: !!sessionIdForDb,
    has_participant_id: !!participant.participant_id,
    has_name: !!participant.name,
    relationship: participant.relationship ?? null,
  });

  const { data, error } = await supabase.from("zoom_participant_events").insert([
    {
      session_id: sessionIdForDb,
      zoom_meeting_uuid: participant.zoom_meeting_uuid,
      participant_id: participant.participant_id,
      name: participant.name,
      email: participant.email || null,
      action: participant.action,
      timestamp: participant.timestamp,
    },
  ]);

  if (error) {
    console.error("Error logging Zoom metadata:", error);
    await logError(error, {
      log_id: logId,
      step: "zoom_metadata_insert",
      session_id: sessionIdForDb,
      participant_id: participant.participant_id,
      participant_name: participant.name,
      action: participant.action,
      error_code: error.code,
      error_message: error.message,
      error_details: error.details,
    });
    throw error;
  }

  // Supabase insert without .select() returns null, so we assume 1 row was inserted on success
  const insertedRows = error ? 0 : 1;
  await logEvent("zoom_metadata_insert_success", {
    log_id: logId,
    session_id: sessionIdForDb,
    participant_id: participant.participant_id,
    participant_name: participant.name,
    action: participant.action,
    inserted_rows: insertedRows,
    relationship: participant.relationship ?? null,
  });

  return data;
}

/**
 * Log participant leave event when they exit the meeting
 * @param appSessionId - App `Sessions.id` when resolved; null if unknown
 * @param zoomMeetingUuid - Zoom `object.uuid` from webhook (base64 ok)
 */
export async function updateParticipantLeaveTime(
  appSessionId: string | null,
  zoomMeetingUuid: string | null,
  participantId: string,
  name: string,
  email: string | null,
  leaveTime: string,
  relationship?: ZoomWebhookRelationshipLog,
) {
  const logId = crypto.randomUUID();
  const sessionIdForDb = await resolveAppSessionIdForZoomEvent(appSessionId, zoomMeetingUuid);

  await logEvent("zoom_participant_leave_insert_start", {
    log_id: logId,
    zoom_meeting_id: zoomMeetingUuid,
    session_id: sessionIdForDb,
    app_session_id: sessionIdForDb,
    participant_id: participantId,
    participant_name: name,
    participant_email: email,
    leave_time: leaveTime,
    has_zoom_meeting_id: Boolean(zoomMeetingUuid),
    has_session_id: !!sessionIdForDb,
    has_participant_id: !!participantId,
    has_name: !!name,
    relationship: relationship ?? null,
  });

  const { data, error } = await supabase
    .from("zoom_participant_events")
    .insert([
      {
        session_id: sessionIdForDb,
        zoom_meeting_uuid: zoomMeetingUuid,
        participant_id: participantId,
        name: name,
        email: email,
        action: "left",
        timestamp: leaveTime,
      },
    ])
    .select();

  if (error) {
    console.error("Error logging participant leave event:", error);
    await logError(error, {
      log_id: logId,
      step: "zoom_participant_leave_insert",
      zoom_meeting_id: zoomMeetingUuid,
      session_id: sessionIdForDb,
      participant_id: participantId,
      participant_name: name,
      leave_time: leaveTime,
      error_code: error.code,
      error_message: error.message,
      error_details: error.details,
    });
    throw error;
  }

  await logEvent("zoom_participant_leave_insert_success", {
    log_id: logId,
    zoom_meeting_id: zoomMeetingUuid,
    session_id: sessionIdForDb,
    participant_id: participantId,
    participant_name: name,
    inserted_rows: Array.isArray(data) ? data.length : data ? 1 : 0,
    relationship: relationship ?? null,
  });

  return data;
}

/**
 * Get participation records by Zoom meeting UUID
 * @param zoomMeetingId - Zoom meeting UUID
 * @returns Array of participation records
 */
export async function getParticipationByZoomMeetingId(
  zoomMeetingId: string,
): Promise<ParticipationRecord[]> {
  const { data, error } = await supabase
    .from("zoom_participant_events")
    .select("*")
    .eq("zoom_meeting_uuid", zoomMeetingId)
    .order("timestamp", { ascending: true });

  if (error) {
    console.error("Error fetching participation data:", error);
    await logError(error, { action: "getParticipationByZoomMeetingId", zoomMeetingId }, "zoom_action_error");
    throw error;
  }

  return (data || []) as ParticipationRecord[];
}

/**
 * Get participation records by internal session ID
 * Queries zoom_participant_events directly by session_id column
 * @param sessionId - Internal session UUID
 * @returns Array of participation records or empty array if none found
 */
export async function getParticipationBySessionId(
  sessionId: string,
): Promise<ParticipationRecord[]> {
  const { data, error } = await supabase
    .from("zoom_participant_events")
    .select("*")
    .eq("session_id", sessionId)
    .order("timestamp", { ascending: true });

  if (error) {
    console.error("Error fetching participation data:", error);
    await logError(error, { action: "getParticipationBySessionId", sessionId }, "zoom_action_error");
    throw error;
  }

  return (data || []) as ParticipationRecord[];
}

/**
 * Count zoom_participant_events rows per portal session id (batch).
 */
export async function getParticipantEventCountsBySessionIds(
  sessionIds: string[],
): Promise<Record<string, number>> {
  if (sessionIds.length === 0) {
    return {};
  }
  const { data, error } = await supabase
    .from("zoom_participant_events")
    .select("session_id")
    .in("session_id", sessionIds);

  if (error) {
    console.error("Error counting zoom participant events:", error);
    await logError(error, { action: "getParticipantEventCountsBySessionIds", sessionIds }, "zoom_action_error");
    throw error;
  }

  const counts: Record<string, number> = {};
  for (const row of data || []) {
    const sid = (row as { session_id?: string | null }).session_id;
    if (!sid) continue;
    counts[sid] = (counts[sid] || 0) + 1;
  }
  return counts;
}
