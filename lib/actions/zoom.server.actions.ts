"use server";
// zoomLogger.ts
import { createClient } from "@supabase/supabase-js";
import { logEvent, logError } from "@/lib/posthog";
import crypto from "crypto";

// Init Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Service role key required for inserting rows
);

// Typescript type (optional)
interface ZoomParticipantData {
  /** Portal `Sessions.id` — never Zoom's base64 `payload.object.uuid` */
  session_id: string;
  participant_id: string;
  name: string;
  email?: string;
  action: "joined" | "left";
  timestamp: string; // ISO format datetime
}

export interface ParticipationRecord {
  id: string;
  participant_id: string;
  name: string;
  email: string;
  action: string;
  timestamp: string;
  session_id: string;
}

/**
 * Log Zoom Account Activity (participant joined or left)
 * @param participant
 * @returns
 */
export async function logZoomMetadata(participant: ZoomParticipantData) {
  const logId = crypto.randomUUID();

  await logEvent("zoom_metadata_insert_start", {
    log_id: logId,
    session_id: participant.session_id,
    participant_id: participant.participant_id,
    participant_name: participant.name,
    participant_email: participant.email,
    action: participant.action,
    timestamp: participant.timestamp,
    has_session_id: !!participant.session_id,
    has_participant_id: !!participant.participant_id,
    has_name: !!participant.name,
  });

  const { data, error } = await supabase
    .from("zoom_participant_events")
    .insert([
      {
        session_id: participant.session_id,
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
      session_id: participant.session_id,
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
    session_id: participant.session_id,
    participant_id: participant.participant_id,
    participant_name: participant.name,
    action: participant.action,
    inserted_rows: insertedRows,
  });

  return data;
}

/**
 * Log participant leave event when they exit the meeting
 * @param sessionId - Portal session id (Sessions.id), not Zoom's base64 meeting uuid
 * @param participantId - Zoom participant id
 * @param name - Participant name
 * @param email - Participant email (optional)
 * @param leaveTime - ISO format datetime of leave
 */
export async function updateParticipantLeaveTime(
  sessionId: string,
  participantId: string,
  name: string,
  email: string | null,
  leaveTime: string
) {
  const logId = crypto.randomUUID();

  await logEvent("zoom_participant_leave_insert_start", {
    log_id: logId,
    session_id: sessionId,
    participant_id: participantId,
    participant_name: name,
    participant_email: email,
    leave_time: leaveTime,
    has_session_id: !!sessionId,
    has_participant_id: !!participantId,
    has_name: !!name,
  });

  const { data, error } = await supabase
    .from("zoom_participant_events")
    .insert([
      {
        session_id: sessionId,
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
      session_id: sessionId,
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
    session_id: sessionId,
    participant_id: participantId,
    participant_name: name,
    inserted_rows: Array.isArray(data) ? data.length : data ? 1 : 0,
  });

  return data;
}

/**
 * Get participation records by Zoom meeting UUID
 * @param zoomMeetingId - Zoom meeting UUID
 * @returns Array of participation records
 */
export async function getParticipationByZoomMeetingId(
  zoomMeetingId: string
): Promise<ParticipationRecord[]> {
  const { data, error } = await supabase
    .from("zoom_participant_events")
    .select("*")
    .eq("session_id", zoomMeetingId)
    .order("timestamp", { ascending: true });

  if (error) {
    console.error("Error fetching participation data:", error);
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
  sessionId: string
): Promise<ParticipationRecord[]> {
  const { data, error } = await supabase
    .from("zoom_participant_events")
    .select("*")
    .eq("session_id", sessionId)
    .order("timestamp", { ascending: true });

  if (error) {
    console.error("Error fetching participation data:", error);
    throw error;
  }

  return (data || []) as ParticipationRecord[];
}
