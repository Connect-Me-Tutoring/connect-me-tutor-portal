"use server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Enrollment, Meeting, Session } from "@/types";
import type { Database } from "@/types/database.types";

type SessionStatus = Database["public"]["Enums"]["session_status"];
import { toast } from "react-hot-toast";
import { Client } from "@upstash/qstash";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  applySessionScope,
  requireAdmin,
  requireAuthenticatedProfile,
  requireEnrollmentAccess,
  requireSessionAccess,
  requireStudentProfileAccess,
  requireTutorProfileAccess,
} from "./authz.server";
import { Profile } from "@/types";
import { getMeeting } from "./meeting.server.actions";
import { createServerClient } from "../supabase/server";
import { Table } from "../supabase/tables";
import {
  getParticipationBySessionId,
  getParticipantEventCountsBySessionIds,
} from "./zoom.server.actions";
import { normalizeZoomParticipationEvents } from "@/lib/zoom/participation-normalize";
import { tableToInterfaceEnrollments, tableToInterfaceSessions } from "../type-utils";
import {
  deleteScheduledEmailBeforeSessions,
  sendScheduledEmailsBeforeSessions,
  sendStudentSessionCancellationEmail,
  sendTutorSessionCancellationEmail,
  updateScheduledEmailBeforeSessions,
} from "./email.server.actions";
import { logError } from "@/lib/posthog";

import { startOfWeek, endOfWeek, subDays, parseISO, format, addDays } from "date-fns"; // Only use date-fns

import * as DateFNS from "date-fns-tz";
const { fromZonedTime } = DateFNS;

async function isSessioninPastWeek(enrollmentId: string, midWeek: Date) {
  const supabase = await createClient();

  const midLastWeek = subDays(midWeek, 7);

  const startOfLastWeek: Date = startOfWeek(midLastWeek);
  const endOfLastWeek: Date = endOfWeek(midLastWeek);

  const { data, error } = await supabase
    .from("Sessions")
    .select("*")
    .gte("date", startOfLastWeek.toISOString())
    .lte("date", endOfLastWeek.toISOString())
    .eq("enrollment_id", enrollmentId);

  if (error) throw error;

  return Object.keys(data).length > 0;
}

/**
 * Add sessions for enrollments within the specified week range
 * @param weekStartString - ISO string (UTC instant) of the Eastern-time week start,
 *   e.g. from `getEasternWeekBounds()` — must already be a correct absolute instant.
 * @param weekEndString - ISO string (UTC instant) of the Eastern-time week end
 * @param enrollments - List of enrollments to create sessions for
 * @param sessions - Existing sessions to avoid duplicates
 * @returns Newly created sessions
 */
export async function addSessionsServer(
  weekStartString: string,
  weekEndString: string,
  enrollments: Enrollment[],
  sessions: Session[],
) {
  try {
    const supabase = await createClient();
    const weekStart = parseISO(weekStartString);
    const weekEnd = parseISO(weekEndString);

    if (Number.isNaN(weekStart.getTime()) || Number.isNaN(weekEnd.getTime())) {
      throw new Error(
        `Invalid week range: weekStartString=${weekStartString}, weekEndString=${weekEndString}`,
      );
    }

    const scheduledSessions: Set<string> = new Set();
    sessions.forEach((session) => {
      if (session.date) {
        const sessionDate = new Date(session.date);
        const key = `${session.student?.id}-${session.tutor?.id}-${format(
          sessionDate,
          "yyyy-MM-dd-HH:mm",
        )}`;
        scheduledSessions.add(key);
      }
    });

    const enrollmentsWithSessions: Set<string> = new Set(
      sessions.filter((s) => s.enrollmentId).map((s) => s.enrollmentId as string),
    );

    const sessionsToCreate: any[] = [];

    for (const enrollment of enrollments) {
      const { id, student, tutor, availability, meetingId, summary, startDate, duration } =
        enrollment;

      if (enrollment.paused) {
        continue;
      }

      if (enrollmentsWithSessions.has(id)) {
        continue;
      }

      if (!student?.id || !tutor?.id || !availability?.length) {
        continue;
      }

      let { day, startTime, endTime } = availability[0];

      if (!startTime || !endTime) {
        console.error(`Invalid time format in availability:`, availability[0]);
        await logError(
          new Error("Invalid time format in availability"),
          {
            availability: availability[0],
            enrollment_id: id,
          },
          "session_error",
        );
        continue;
      }

      const startDate_asDate = new Date(startDate);
      let currentDate = new Date(weekStart);
      const dayLower = day.toLowerCase();

      while (currentDate <= weekEnd) {
        const currentDay = format(currentDate, "EEEE").toLowerCase();

        if (currentDay !== dayLower) {
          currentDate = addDays(currentDate, 1);
          continue;
        }

        if (currentDate < weekStart) {
          currentDate = addDays(currentDate, 7);
        }

        if (currentDate > weekEnd) {
          currentDate = addDays(currentDate, -7);
        }

        try {
          const [startHour, startMinute] = startTime.split(":").map(Number);
          const [endHour, endMinute] = endTime.split(":").map(Number);

          if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) {
            throw new Error(`Invalid time format: start=${startTime}, end=${endTime}`);
          }

          const dateString = `${format(currentDate, "yyyy-MM-dd")}T${startTime}:00`;
          const sessionStartTime = fromZonedTime(dateString, "America/New_York");

          if (sessionStartTime < startDate_asDate) {
            throw new Error("Session occurs before start date");
          }

          const sessionKey = `${student.id}-${tutor.id}-${format(
            sessionStartTime,
            "yyyy-MM-dd-HH:mm",
          )}`;

          if (!scheduledSessions.has(sessionKey)) {
            sessionsToCreate.push({
              enrollment_id: id,
              date: sessionStartTime.toISOString(),
              student_id: student.id,
              tutor_id: tutor.id,
              status: "Active",
              summary: summary || "",
              meeting_id: meetingId || null,
              duration: duration,
            });

            scheduledSessions.add(sessionKey);
          }
        } catch (err) {
          console.error("Error processing time for %s %s-%s:", day, startTime, endTime, err);
          await logError(err, { enrollment_id: id, day, startTime, endTime }, "session_error");
        }

        currentDate = addDays(currentDate, 1);
      }
    }

    if (sessionsToCreate.length > 0) {
      const { data, error } = await supabase.from(Table.Sessions).insert(sessionsToCreate).select(`
          *,
          student:Profiles!student_id(*),
          tutor:Profiles!tutor_id(*),
          meeting:Meetings!meeting_id(*)
          `);

      if (error) throw error;

      if (data) {
        const createdSessions: Session[] = data.map((session: any) =>
          tableToInterfaceSessions(session),
        );
        return createdSessions;
      }
    }

    return [];
  } catch (error) {
    console.error("Error creating sessions:", error);
    await logError(error, { weekStartString, weekEndString }, "session_error");
    throw error;
  }
}

/**
 * Normalize meeting ID by keeping only digits for comparison.
 * Handles stored or incoming formats with spaces, dashes, etc.
 * @param meetingId - Meeting ID in any human-formatted style
 * @returns Digits-only meeting ID
 */
function normalizeMeetingId(meetingId: string): string {
  return meetingId.replace(/\D+/g, "");
}

/**
 * Format a normalized Zoom meeting number into spaced storage format.
 * Example: "93034287023" -> "930 3428 7023"
 */
function formatMeetingIdForStorage(normalizedMeetingId: string): string {
  if (!normalizedMeetingId) return "";
  if (normalizedMeetingId.length <= 3) return normalizedMeetingId;
  if (normalizedMeetingId.length <= 7) {
    return `${normalizedMeetingId.slice(0, 3)} ${normalizedMeetingId.slice(3)}`;
  }

  return `${normalizedMeetingId.slice(0, 3)} ${normalizedMeetingId.slice(3, 7)} ${normalizedMeetingId.slice(7)}`;
}

/**
 * Resolve `Meetings` row where the stored Zoom numeric id matches `normalizedSearch`
 * after applying the spaced storage format used in the Meetings table.
 */
async function findMeetingRecordByNormalizedZoomNumber(
  supabase: SupabaseClient,
  normalizedSearch: string,
): Promise<{ id: string; meeting_id: string } | null> {
  const formattedSearch = formatMeetingIdForStorage(normalizedSearch);
  const { data: meetingRecord, error } = await supabase
    .from(Table.Meetings)
    .select("id, meeting_id")
    .eq("meeting_id", formattedSearch)
    .maybeSingle();

  if (error) {
    console.error("Error fetching meeting for Zoom webhook:", error);
    await logError(error, { normalized_search: normalizedSearch }, "session_error");
    return null;
  }

  return meetingRecord ?? null;
}

/**
 * Find a meeting by normalized meeting_id (handles spaces in stored format)
 * @param zoomMeetingNumber - Zoom meeting number (e.g., "96691315547")
 * @returns Meeting record or null if not found
 */
export async function findMeetingByNormalizedId(
  zoomMeetingNumber: string,
): Promise<{ id: string; meeting_id: string } | null> {
  try {
    const supabase = await createClient();
    const normalizedSearch = normalizeMeetingId(zoomMeetingNumber);

    // Fetch all meetings and filter by normalized meeting_id
    const { data: meetings, error } = await supabase.from(Table.Meetings).select("id, meeting_id");

    if (error) {
      console.error("Error fetching meetings:", error);
      await logError(error, { zoom_meeting_number: zoomMeetingNumber }, "session_error");
      return null;
    }

    if (!meetings || meetings.length === 0) {
      return null;
    }

    // Find meeting where normalized meeting_id matches
    const matchingMeeting = meetings.find((meeting) => {
      const normalizedStored = normalizeMeetingId(meeting.meeting_id || "");
      return normalizedStored === normalizedSearch;
    });

    return matchingMeeting || null;
  } catch (error) {
    console.error("Error finding meeting by normalized ID:", error);
    await logError(error, { zoom_meeting_number: zoomMeetingNumber }, "session_error");
    return null;
  }
}

/**
 * Get active session by meeting ID (UUID from Meetings table)
 * Finds the closest active session to the current time that is in the past
 * @param meetingID - Meeting UUID (from Meetings.id)
 * @returns Array of active sessions (closest to current time, in the past) or empty array if not found
 */
export async function getActiveSessionFromMeetingID(meetingID: string) {
  const supabase = await createServerClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from(Table.Sessions)
    .select("*")
    .eq("meeting_id", meetingID)
    .eq("status", "Active")
    .lte("date", now) // Only sessions in the past (date <= current time)
    .order("date", { ascending: false }) // Most recent first
    .limit(1); // Get the closest one to now

  if (error) {
    console.error("Error fetching session:", error);
    await logError(error, { meeting_id: meetingID }, "session_error");
    return [];
  }

  return data || [];
}

export async function cancelSession(session: Session, actor: "tutor" | "student") {
  const authSupabase = await createClient();
  const adminSupabase = await createAdminClient();

  const { data: existingSession, error: existingSessionError } = await authSupabase
    .from(Table.Sessions)
    .select("id, tutor_id, student_id")
    .eq("id", session.id)
    .single();

  if (existingSessionError || !existingSession) {
    console.error("Error loading session before cancellation:", existingSessionError);
    await logError(
      existingSessionError ?? new Error("Session not found before cancellation"),
      {
        session_id: session.id,
      },
      "session_error",
    );
    throw existingSessionError ?? new Error("Session not found");
  }

  await requireSessionAccess(existingSession);

  const { error } = await adminSupabase
    .from(Table.Sessions)
    .update({
      status: "Cancelled",
      session_exit_form: session.session_exit_form ?? null,
    })
    .eq("id", session.id);

  if (error) {
    console.error("Error cancelling session:", error);
    await logError(error, { session_id: session.id, actor }, "session_error");
    throw error;
  }

  try {
    const sessionDate = session.date ? format(new Date(session.date), "MMMM d, yyyy") : "";
    const sessionTime = session.date ? format(new Date(session.date), "h:mm a") : "";
    const studentName =
      `${session.student?.firstName ?? ""} ${session.student?.lastName ?? ""}`.trim() || "Student";
    const tutorName =
      `${session.tutor?.firstName ?? ""} ${session.tutor?.lastName ?? ""}`.trim() || "Your Tutor";
    const reason = session.session_exit_form || undefined;

    if (actor === "tutor" && session.student?.email) {
      await sendStudentSessionCancellationEmail(
        { studentName, tutorName, sessionDate, sessionTime, reason },
        session.student.email,
      );
    } else if (actor === "student" && session.tutor?.email) {
      // Student cancelled -> notify the tutor.
      await sendTutorSessionCancellationEmail(
        { tutorName, studentName, sessionDate, sessionTime, reason },
        session.tutor.email,
      );
    }
  } catch (emailError) {
    console.error("Failed to send cancellation email:", emailError);
    await logError(emailError, { session_id: session.id, actor }, "session_error");
  }

  return { ...session, status: "Cancelled" as const };
}

export async function removeSessionServer(sessionId: string, updateEmail: boolean = true) {
  await requireAdmin();
  const supabase = await createAdminClient();

  const { error: notificationError } = await supabase
    .from(Table.Notifications)
    .delete()
    .eq("session_id", sessionId);

  if (notificationError) throw notificationError;

  const { error: participantEventError } = await supabase
    .from("zoom_participant_events")
    .update({ session_id: null })
    .eq("session_id", sessionId);

  if (participantEventError) throw participantEventError;

  const { error: sessionError } = await supabase.from(Table.Sessions).delete().eq("id", sessionId);

  if (sessionError) throw sessionError;

  if (updateEmail) {
    await deleteScheduledEmailBeforeSessions(sessionId);
  }
}

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

export async function zoomSessionResolutionStatus(
  r: ZoomSessionResolution,
): Promise<
  | "no_meeting_number_in_payload"
  | "meeting_not_in_database"
  | "no_matching_active_session"
  | "session_resolved"
> {
  if (!r.zoomMeetingNumber) return "no_meeting_number_in_payload";
  if (!r.meetingsRowId) return "meeting_not_in_database";
  if (!r.appSessionId) return "no_matching_active_session";
  return "session_resolved";
}

/**
 * Map Zoom webhook `payload.object` to app session: meeting number → normalized match on
 * `Meetings.meeting_id` → `Sessions.meeting_id` = `Meetings.id`.
 */
export async function resolveAppSessionFromZoomWebhookObject(
  payloadObject: Record<string, unknown> | null | undefined,
): Promise<ZoomSessionResolution> {
  const raw = payloadObject?.id ?? payloadObject?.meeting_number;
  const meetingNumber = raw !== undefined && raw !== null ? String(raw) : undefined;
  const uuidRaw = payloadObject?.uuid;
  const zoomMeetingUuid = uuidRaw !== undefined && uuidRaw !== null ? String(uuidRaw) : undefined;

  if (!meetingNumber) {
    return {
      zoomMeetingNumber: undefined,
      zoomMeetingUuid,
      meetingsRowId: null,
      storedMeetingId: null,
      appSessionId: null,
    };
  }

  const resolved = await resolvePortalSessionForZoomMeetingNumber(meetingNumber);
  if (!resolved) {
    return {
      zoomMeetingNumber: meetingNumber,
      zoomMeetingUuid,
      meetingsRowId: null,
      storedMeetingId: null,
      appSessionId: null,
    };
  }

  return {
    zoomMeetingNumber: meetingNumber,
    zoomMeetingUuid,
    meetingsRowId: resolved.meetingRecord.id,
    storedMeetingId: resolved.meetingRecord.meeting_id,
    appSessionId: resolved.sessionId,
  };
}

/** Zoom sends join/leave before the scheduled start; allow attribution slightly early */
const ZOOM_WEBHOOK_EARLY_JOIN_MS = 45 * 60 * 1000;
/** Only consider portal sessions whose start time is within this lookback (hours) */
const ZOOM_WEBHOOK_SESSION_LOOKBACK_HOURS = 24;

export type ZoomWebhookMeetingResolution = {
  meetingRecord: { id: string; meeting_id: string };
  sessionId: string | null;
};

/**
 * For Zoom webhooks: resolve the portal `Meetings` row by numeric Zoom meeting id
 * (`payload.object.id`) using normalized `Meetings.meeting_id`, then find an
 * `Active` `Sessions` row for `Meetings.id` = `Sessions.meeting_id` whose scheduled
 * window contains the current instant. Sessions are loaded with an inner join to
 * `Meetings` so rows always match the FK relationship.
 * Uses the service role so this works without a logged-in user (webhook context).
 */
export async function resolvePortalSessionForZoomMeetingNumber(
  zoomMeetingNumber: string,
): Promise<ZoomWebhookMeetingResolution | null> {
  const supabase = await createAdminClient();
  const normalizedSearch = normalizeMeetingId(zoomMeetingNumber);

  const meetingRecord = await findMeetingRecordByNormalizedZoomNumber(supabase, normalizedSearch);

  if (!meetingRecord) {
    return null;
  }

  const nowMs = Date.now();
  const lookbackIso = new Date(
    nowMs - ZOOM_WEBHOOK_SESSION_LOOKBACK_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data: sessions, error: sessionError } = await supabase
    .from(Table.Sessions)
    .select(
      `
      id,
      date,
      duration,
      meeting_id,
      status,
      meeting:Meetings!meeting_id!inner(id, meeting_id)
    `,
    )
    .eq("meeting_id", meetingRecord.id)
    .eq("status", "Active")
    .not("date", "is", null)
    .gte("date", lookbackIso)
    .order("date", { ascending: false })
    .limit(40);

  if (sessionError) {
    console.error("Error fetching sessions for Zoom webhook:", sessionError);
    await logError(
      sessionError,
      {
        zoom_meeting_number: zoomMeetingNumber,
        meetings_row_id: meetingRecord.id,
      },
      "session_error",
    );
    return { meetingRecord, sessionId: null };
  }

  if (!sessions?.length) {
    return { meetingRecord, sessionId: null };
  }

  const durationMs = (durationHours: number) =>
    Math.max(0, Number(durationHours) || 0) * 60 * 60 * 1000;

  for (const s of sessions) {
    const startMs = new Date(s.date as string).getTime();
    const endMs = startMs + durationMs(s.duration as number);
    const effectiveStart = startMs - ZOOM_WEBHOOK_EARLY_JOIN_MS;
    if (nowMs >= effectiveStart && nowMs <= endMs) {
      return { meetingRecord, sessionId: s.id as string };
    }
  }

  return { meetingRecord, sessionId: null };
}

export async function getSessions(start: string, end: string): Promise<Session[]> {
  try {
    await requireAdmin();
    const supabase = await createAdminClient();

    const { data: sessionData, error: sessionError } = await supabase
      .from(Table.Sessions)
      .select(
        `*,
         meeting:Meetings!meeting_id(*),
          student:Profiles!student_id(*),
          tutor:Profiles!tutor_id(*)
        `,
      )
      .gt("date", start)
      .lt("date", end);

    if (sessionError) throw sessionError;

    const sessions: Session[] = sessionData
      .filter((session: any) => session.student && session.tutor)
      .map((session: any) => tableToInterfaceSessions(session));

    return sessions;
  } catch (error) {
    console.error("Error fetching sessions: ", error);
    await logError(error, { start, end }, "session_error");
    throw error;
  }
}

export async function getAllSessionsServer(
  startDate?: string,
  endDate?: string,
  orderBy?: string,
  ascending?: boolean,
) {
  await requireAdmin();
  const supabase = await createClient();
  try {
    let query = supabase.from(Table.Sessions).select(`
      *,
      meeting:Meetings!meeting_id(*),
      student:Profiles!student_id(*),
      tutor:Profiles!tutor_id(*)
    `);

    if (startDate) {
      query = query.gte("date", startDate);
    }
    if (endDate) {
      query = query.lte("date", endDate);
    }

    if (orderBy && ascending !== undefined) {
      query = query.order(orderBy, { ascending });
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching student sessions:", error.message);
      await logError(error, { startDate, endDate, orderBy, ascending }, "session_error");
      throw error;
    }

    const sessions: Session[] = await Promise.all(
      data
        .filter((session: any) => session.student && session.tutor)
        .map((session: any): Session => tableToInterfaceSessions(session)),
    );

    return sessions;
  } catch (error) {
    console.error("Error fetching sessions", error);
    await logError(error, { startDate, endDate, orderBy, ascending }, "session_error");
    return [];
  }
}

export async function getAllSessions(
  startDate?: string,
  endDate?: string,
  options?: {
    orderBy?: {
      field: string;
      ascending: boolean;
    };
  },
): Promise<Session[]> {
  try {
    const { profile } = await requireAuthenticatedProfile();
    const supabase = await createClient();

    let query = supabase.from(Table.Sessions).select(`
      *,
      meeting:Meetings!meeting_id(*),
      student:Profiles!student_id(*),
      tutor:Profiles!tutor_id(*)
    `);

    query = applySessionScope(query, profile);

    if (startDate) {
      query = query.gte("date", startDate);
    }
    if (endDate) {
      query = query.lte("date", endDate);
    }

    if (options && options.orderBy) {
      query = query.order(options.orderBy.field, {
        ascending: options.orderBy.ascending,
      });
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching student sessions:", error.message);
      await logError(error, { startDate, endDate, profile_id: profile.id }, "session_error");
      throw error;
    }

    const sessions: Session[] = data
      .filter((session: any) => session.student && session.tutor)
      .map((session: any) => tableToInterfaceSessions(session));

    return sessions;
  } catch (error) {
    console.error("Error fetching sessions", error);
    await logError(error, { startDate, endDate }, "session_error");
    return [];
  }
}

export async function updateSessionParticipantion(meetingID: string) {}

function profileLabelForActivity(p: Profile | null): string {
  if (!p) return "Unknown";
  const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
  if (name) return name;
  if (p.email) return p.email;
  return "Unknown";
}

export type EnrollmentActivitySessionRow = {
  id: string;
  date: string;
  status: string | null;
  meetingTitle: string;
  meetingId: string;
  zoomEventCount: number;
};

export type EnrollmentSessionsActivityData = {
  enrollment: {
    id: string;
    summary: string;
    frequency: string;
    paused: boolean;
    studentName: string;
    tutorName: string;
  };
  sessions: EnrollmentActivitySessionRow[];
};

/**
 * Enrollment header plus all portal sessions for that enrollment, with Zoom log counts.
 */
export async function getEnrollmentSessionsActivityData(
  enrollmentId: string,
): Promise<EnrollmentSessionsActivityData | null> {
  try {
    if (!enrollmentId) return null;
    await requireEnrollmentAccess(enrollmentId);
    const supabase = await createClient();

    const { data: enRow, error: enErr } = await supabase
      .from(Table.Enrollments)
      .select(
        `
        id,
        summary,
        frequency,
        paused,
        student:Profiles!student_id(*),
        tutor:Profiles!tutor_id(*)
      `,
      )
      .eq("id", enrollmentId)
      .single();

    if (enErr || !enRow) {
      console.error("getEnrollmentSessionsActivityData enrollment:", enErr);
      await logError(
        enErr ?? new Error("Enrollment not found"),
        { enrollment_id: enrollmentId },
        "session_error",
      );
      return null;
    }

    if (!enRow.student || !enRow.tutor) {
      console.error("getEnrollmentSessionsActivityData: enrollment missing student or tutor");
      await logError(
        new Error("Enrollment missing student or tutor"),
        {
          enrollment_id: enrollmentId,
        },
        "session_error",
      );
      return null;
    }

    const en = tableToInterfaceEnrollments(enRow);

    const { data: sessRows, error: sErr } = await supabase
      .from(Table.Sessions)
      .select(
        `
        id,
        date,
        status,
        meeting:Meetings!meeting_id(name, meeting_id)
      `,
      )
      .eq("enrollment_id", enrollmentId)
      .order("date", { ascending: false })
      .limit(150);

    if (sErr) {
      console.error("getEnrollmentSessionsActivityData sessions:", sErr);
      await logError(sErr, { enrollment_id: enrollmentId }, "session_error");
      throw sErr;
    }

    const sessionIds = (sessRows || []).map((r: { id: string }) => r.id);
    const counts = await getParticipantEventCountsBySessionIds(sessionIds);

    const sessions: EnrollmentActivitySessionRow[] = (sessRows || []).map((r: any) => {
      const m = Array.isArray(r.meeting) ? r.meeting[0] : r.meeting;
      return {
        id: r.id,
        date: r.date ?? "",
        status: r.status,
        meetingTitle: m?.name || "Meeting",
        meetingId: m?.meeting_id || "",
        zoomEventCount: counts[r.id] ?? 0,
      };
    });

    return {
      enrollment: {
        id: en.id,
        summary: en.summary,
        frequency: en.frequency,
        paused: en.paused,
        studentName: profileLabelForActivity(en.student),
        tutorName: profileLabelForActivity(en.tutor),
      },
      sessions,
    };
  } catch (error) {
    console.error("getEnrollmentSessionsActivityData:", error);
    await logError(error, { enrollment_id: enrollmentId }, "session_error");
    return null;
  }
}

export interface ParticipationEvent {
  id: string;
  participantId: string;
  name: string;
  email: string;
  action: "joined" | "left";
  timestamp: string;
  /** Present when join was inferred (e.g. first webhook was a leave). */
  inferred?: boolean;
  /** Join timestamp was before the scheduled session start. */
  joinedBeforeScheduledStart?: boolean;
}

export interface ParticipationSummary {
  id: string;
  name: string;
  email: string;
  totalDuration: number;
  joinCount: number;
  currentlyInMeeting: boolean;
  firstJoined: string;
  lastActivity: string;
  hadInferredJoin?: boolean;
  joinedBeforeScheduledStart?: boolean;
}

export interface ParticipationData {
  session: {
    id: string;
    /** Portal enrollment this session belongs to, if any. */
    enrollmentId: string | null;
    meetingTitle: string;
    meetingId: string;
    startTime: string;
    endTime: string | null;
    totalDuration: number;
  };
  events: ParticipationEvent[];
  participantSummaries: ParticipationSummary[];
  /** Present when `?enrollmentId=` matches this session's enrollment. */
  enrollmentBreakdown?: {
    enrollment: {
      id: string;
      summary: string;
      frequency: string;
      studentName: string;
      tutorName: string;
    };
    sessions: EnrollmentActivitySessionRow[];
  };
  /** `?enrollmentId=` was sent but does not match this session (or enrollment missing). */
  enrollmentQueryMismatch?: boolean;
}

export async function getParticipationData(
  sessionId: string,
  enrollmentIdFromSearch?: string | null,
): Promise<ParticipationData | null> {
  try {
    if (!sessionId) {
      return null;
    }

    // Get session details to calculate meeting end time
    const session = await getSessionById(sessionId, { skipAccessCheck: true });

    if (!session) {
      return null;
    }

    await requireSessionAccess(session);

    const participationRecords = await getParticipationBySessionId(sessionId);

    const sessionStartTime = session.date ? new Date(session.date) : new Date();
    const sessionEndTime = session.duration
      ? new Date(sessionStartTime.getTime() + session.duration * 60 * 60 * 1000)
      : null;

    const { events, participantSummaries } = normalizeZoomParticipationEvents(
      participationRecords,
      { sessionStart: sessionStartTime, sessionEnd: sessionEndTime },
    );

    const base: ParticipationData = {
      session: {
        id: session.id,
        enrollmentId: session.enrollmentId,
        meetingTitle: session.meeting?.name || "Tutoring Session",
        meetingId: session.meeting?.meetingId || "",
        startTime: session.date,
        endTime: sessionEndTime?.toISOString() || null,
        totalDuration: Math.round((session.duration || 0) * 60),
      },
      events,
      participantSummaries,
    };

    const q = enrollmentIdFromSearch?.trim();
    if (!q) {
      return base;
    }

    if (!session.enrollmentId || q !== session.enrollmentId) {
      return { ...base, enrollmentQueryMismatch: true };
    }

    const activity = await getEnrollmentSessionsActivityData(session.enrollmentId);
    if (!activity) {
      return { ...base, enrollmentQueryMismatch: true };
    }

    return {
      ...base,
      enrollmentBreakdown: {
        enrollment: {
          id: activity.enrollment.id,
          summary: activity.enrollment.summary,
          frequency: activity.enrollment.frequency,
          studentName: activity.enrollment.studentName,
          tutorName: activity.enrollment.tutorName,
        },
        sessions: activity.sessions,
      },
    };
  } catch (error) {
    console.error("Error fetching participation data:", error);
    await logError(
      error,
      {
        session_id: sessionId,
        enrollment_id_from_search: enrollmentIdFromSearch,
      },
      "session_error",
    );
    return null;
  }
}

export async function getSessionById(
  sessionId: string,
  options?: { skipAccessCheck?: boolean },
): Promise<Session | null> {
  try {
    const supabase = await createClient();

    const { data: sessionData, error: sessionError } = await supabase
      .from(Table.Sessions)
      .select(
        `
        *,
        tutor:Profiles!tutor_id(*),
        student:Profiles!student_id(*),
        meeting:Meetings!meeting_id(*)
      `,
      )
      .eq("id", sessionId)
      .single();

    if (sessionError || !sessionData) {
      console.error("Error fetching session:", sessionError);
      await logError(
        sessionError ?? new Error("Session not found"),
        { session_id: sessionId },
        "session_error",
      );
      return null;
    }

    const session: Session = tableToInterfaceSessions(sessionData);

    if (!options?.skipAccessCheck) {
      await requireSessionAccess(session);
    }

    return session;
  } catch (error) {
    console.error("Error fetching session by ID:", error);
    await logError(error, { session_id: sessionId }, "session_error");
    return null;
  }
}

export async function getTutorSessions(
  profileId: string,
  params: {
    startDate?: string;
    endDate?: string;
    status?: SessionStatus | SessionStatus[];
    orderBy?: string;
    ascending?: boolean;
  },
): Promise<Session[]> {
  await requireTutorProfileAccess(profileId);
  const supabase = await createClient();
  const { startDate, endDate, status, orderBy, ascending } = params ? params : {};

  let query = supabase
    .from(Table.Sessions)
    .select(
      `
     *,
     meeting:Meetings!meeting_id(*),
     student:Profiles!student_id(*),
     tutor:Profiles!tutor_id(*)
    `,
    )
    .eq("tutor_id", profileId);

  if (startDate) {
    query = query.gte("date", startDate);
  }
  if (endDate) {
    query = query.lte("date", endDate);
  }

  if (status) {
    if (Array.isArray(status)) {
      query = query.in("status", status);
    } else {
      query = query.eq("status", status);
    }
  }

  if (orderBy && ascending !== undefined) {
    query = query.order(orderBy, { ascending });
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching student sessions:", error.message);
    await logError(error, { profile_id: profileId, startDate, endDate, status }, "session_error");
    throw error;
  }

  const sessions: Session[] = data
    .filter((data) => data.meeting && data.student && data.tutor)
    .map((session: any) => tableToInterfaceSessions(session));

  return sessions;
}

export async function getStudentSessions(
  profileId: string,
  params?: {
    startDate?: string;
    endDate?: string;
    status?: SessionStatus | SessionStatus[];
    orderBy?: string;
    ascending?: boolean;
  },
): Promise<Session[]> {
  await requireStudentProfileAccess(profileId);
  const supabase = await createClient();
  const { startDate, endDate, status, orderBy, ascending } = params ? params : {};

  let query = supabase
    .from(Table.Sessions)
    .select(
      `
      *,
      student:Profiles!student_id(*),
      tutor:Profiles!tutor_id(*),
      meeting:Meetings!meeting_id(*)
    `,
    )
    .eq("student_id", profileId);

  if (startDate) {
    query = query.gte("date", startDate);
  }
  if (endDate) {
    query = query.lte("date", endDate);
  }

  if (status) {
    if (Array.isArray(status)) {
      query = query.in("status", status);
    } else {
      query = query.eq("status", status);
    }
  }

  if (orderBy && ascending !== undefined) {
    query = query.order(orderBy, { ascending });
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching student sessions:", error.message);
    await logError(error, { profile_id: profileId, startDate, endDate, status }, "session_error");
    throw error;
  }

  const sessions: Session[] = data
    .filter((session) => session.meeting && session.tutor_id && session.student_id)
    .map((session: any) => tableToInterfaceSessions(session));

  return sessions;
}

export async function rescheduleSession(
  sessionId: string,
  newDate: any,
  meetingId: string,
  tutorid?: string,
) {
  const existing = await getSessionById(sessionId);
  if (!existing) {
    throw new Error("Session not found");
  }
  const supabase = await createClient();
  try {
    const { data: sessionData, error } = await supabase
      .from(Table.Sessions)
      .update({
        date: newDate,
        meeting_id: meetingId,
      })
      .eq("id", sessionId)
      .select(
        `*,
        tutor:Profiles!tutor_id(*),
        student:Profiles!student_id(*),
        meeting:Meetings!meeting_id(*)`,
      )
      .single();

    if (error) throw error;

    const { error: notificationError } = await supabase.from("Notifications").insert({
      session_id: sessionId,
      previous_date: sessionData.date,
      suggested_date: newDate,
      tutor_id: sessionData.tutor_id,
      student_id: sessionData.student_id,
      type: "RESCHEDULE_REQUEST",
      status: "Active",
    });

    if (notificationError) throw notificationError;
    if (sessionData) {
      return tableToInterfaceSessions(sessionData);
    }
  } catch (error) {
    console.error("Unable to reschedule", error);
    await logError(error, { session_id: sessionId, newDate, meetingId, tutorid }, "session_error");
    throw error;
  }
}
export async function addStandaloneSession(
  session: Session,
  scheduleEmail: boolean = true,
  details?: {
    student?: Profile;
    tutor?: Profile;
    meeting?: Meeting;
  },
): Promise<void> {
  const { profile } = await requireAuthenticatedProfile();
  if (profile.role !== "Admin") {
    const tutorId = session.tutor?.id;
    if (!tutorId || profile.id !== tutorId) {
      throw new Error("Unauthorized");
    }
  }
  const supabase = await createClient();

  try {
    const newSession = {
      date: session.date,
      enrollment_id: session.enrollmentId || null, //omdependent of enrollment date
      student_id: session.student?.id,
      tutor_id: session.tutor?.id,
      status: session.status || "Active",
      summary: session.summary,
      meeting_id: session.meeting?.id,
      duration: session.duration || 1,
      is_standalone: true,
    };

    const { data, error } = await supabase
      .from(Table.Sessions)
      .insert(newSession)
      .select(
        `*,
        tutor:Profiles!tutor_id(*),
        student:Profiles!student_id(*),
        meeting:Meetings!meeting_id(*)`,
      )
      .single();

    if (error) throw error;
    if (!data) toast.error("No Data");

    if (data && scheduleEmail) {
      const addedSession: Session = tableToInterfaceSessions(data);

      sendScheduledEmailsBeforeSessions([addedSession]);
    }
  } catch (error) {
    console.error("Unable to add one session", error);
    await logError(
      error,
      { session_id: session.id, student_id: session.student?.id, tutor_id: session.tutor?.id },
      "session_error",
    );
    throw error;
  }
}

export async function cancelUnsubmittedSEF(profile: Profile) {
  try {
    const supabase = await createClient();
    const now = new Date();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    await supabase
      .from("Sessions")
      .update({ status: "Cancelled" })
      .eq("tutor_id", profile.id)
      .lt("date", fortyEightHoursAgo);
  } catch (error) {
    console.error("Unable to cancel unsubmitted SEF");
    await logError(error, { tutor_id: profile.id }, "session_error");
  }
}

export async function cancelUnsubmittedSEFCron() {
  const supabase = await createAdminClient();
  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  // First, fetch sessions that need to be cancelled
  const { data: sessions, error: fetchError } = await supabase
    .from("Sessions")
    .select("id")
    .eq("status", "Active")
    .lt("date", fortyEightHoursAgo);

  if (fetchError) {
    return { success: false, error: fetchError.message, cancelled: 0 };
  }

  if (!sessions || sessions.length === 0) {
    return { success: true, error: undefined, cancelled: 0 };
  }

  // Then update them
  const { error: updateError } = await supabase
    .from("Sessions")
    .update({ status: "Cancelled" })
    .eq("status", "Active")
    .eq("is_standalone", false)
    .lt("date", fortyEightHoursAgo);

  if (updateError) {
    return { success: false, error: updateError.message, cancelled: 0 };
  }

  return { success: true, error: undefined, cancelled: sessions.length };
}

export async function updateSessionsStatus(sessionIds: string[], status: SessionStatus) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from(Table.Sessions).update({ status }).in("id", sessionIds);

    if (error) throw error;
  } catch (error) {
    console.error("Error updating sessions status:", error);
    await logError(error, { session_ids: sessionIds, status }, "session_error");
    throw error;
  }
}

export async function updateSession(updatedSession: Session, updateEmail: boolean = true) {
  try {
    const {
      id,
      status,
      tutor,
      student,
      date,
      duration,
      summary,
      meeting,
      session_exit_form,
      isQuestionOrConcern,
      isFirstSession,
    } = updatedSession;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from(Table.Sessions)
      .update({
        status: status,
        student_id: student?.id,
        tutor_id: tutor?.id,
        date: date,
        duration: duration,
        summary: summary,
        meeting_id: meeting?.id,
        session_exit_form: session_exit_form,
        is_question_or_concern: isQuestionOrConcern,
        is_first_session: isFirstSession,
      })
      .eq("id", id)
      .select(
        `*,
        tutor:Profiles!tutor_id(*),
        student:Profiles!student_id(*),
        meeting:Meetings!meeting_id(*)`,
      )
      .single();

    if (error) {
      console.error("Error updating session:", error);
      await logError(error, { session_id: id }, "session_error");
      return null;
    }

    if (!data) {
      console.error("NO DATA");
      await logError(
        new Error("No data returned when updating session"),
        { session_id: id },
        "session_error",
      );
      return null;
    }

    const newSession: Session = tableToInterfaceSessions(data);

    if (updateEmail) {
      await updateScheduledEmailBeforeSessions(newSession);
    }

    return newSession;
  } catch (error) {
    console.error("Unable to update session");
    await logError(error, { session_id: updatedSession.id }, "session_error");
    throw error;
  }
}
