"use server";
import { Enrollment, Meeting, Session } from "@/types";
import { toast } from "react-hot-toast";
import { Client } from "@upstash/qstash";
import { createClient } from "@/lib/supabase/server";
import { Profile } from "@/types";
import { getProfileWithProfileId } from "./user.actions";
import { getMeeting } from "./meeting.server.actions";
import { createServerClient } from "../supabase/server";
import { Table } from "../supabase/tables";

import {
  addDays,
  format,
  parse,
  parseISO,
  isBefore,
  isAfter,
  areIntervalsOverlapping,
  addHours,
  isValid,
  setHours,
  setMinutes,
  startOfWeek,
  endOfWeek,
  subDays,
} from "date-fns"; // Only use date-fns

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
 * @param weekStartString - ISO string of week start in Eastern Time
 * @param weekEndString - ISO string of week end in Eastern Time
 * @param enrollments - List of enrollments to create sessions for
 * @param sessions - Existing sessions to avoid duplicates
 * @returns Newly created sessions
 */

/**
 * Normalize meeting ID by removing spaces for comparison
 * @param meetingId - Meeting ID with or without spaces (e.g., "96691315547" or "966 913 15547")
 * @returns Normalized meeting ID without spaces
 */
function normalizeMeetingId(meetingId: string): string {
  return meetingId.replace(/\s+/g, "");
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
    const { data: meetings, error } = await supabase
      .from(Table.Meetings)
      .select("id, meeting_id");

    if (error) {
      console.error("Error fetching meetings:", error);
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
    return [];
  }

  return data || [];
}
import { getParticipationBySessionId } from "./zoom.server.actions";
import { scheduleMultipleSessionReminders } from "../twilio";
import {
  tableToInterfaceMeetings,
  tableToInterfaceProfiles,
} from "../type-utils";
import { revalidatePath } from "next/cache";
import { sendScheduledEmailsBeforeSessions } from "./email.server.actions";

export async function getSessions(
  start: string,
  end: string,
): Promise<Session[]> {
  try {
    const supabase = await createClient();

    const { data: sessionData, error: sessionError } = await supabase
      .from(Table.Sessions)
      .select("*")
      .gt("date", start)
      .lt("date", end);

    if (sessionError) throw sessionError;

    const sessions: Session[] = await Promise.all(
      sessionData.map(async (session: any) => ({
        id: session.id,
        enrollmentId: session.enrollment_id,
        createdAt: session.created_at,
        environment: session.environment,
        date: session.date,
        summary: session.summary,
        // meetingId: session.meeting_id,
        meeting: await getMeeting(session.meeting_id),
        student: await getProfileWithProfileId(session.student_id),
        tutor: await getProfileWithProfileId(session.tutor_id),
        status: session.status,
        session_exit_form: session.session_exit_form,
        isQuestionOrConcern: Boolean(session.is_question_or_concern),
        isFirstSession: Boolean(session.is_first_session),
        duration: session.duration,
      })),
    );

    return sessions;
  } catch (error) {
    console.error("Error fetching sessions: ", error);
    throw error;
  }
}

export async function getAllSessionsServer(
  startDate?: string,
  endDate?: string,
  orderBy?: string,
  ascending?: boolean,
) {
  const supabase = await createClient();
  try {
    let query = supabase.from(Table.Sessions).select(`
      id,
      enrollment_id,
      created_at,
      environment,
      student_id,
      tutor_id,
      date,
      summary,
      meeting_id,
      status,
      is_question_or_concern,
      is_first_session,
      session_exit_form,
      duration,
      meetings:Meetings!meeting_id(*),
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

    // console.log(data);

    if (error) {
      console.error("Error fetching student sessions:", error.message);
      throw error;
    }

    const sessions: Session[] = await Promise.all(
      data
        .filter((session: any) => session.student & session.tutor)
        .map(async (session: any) => {
          // Check if tutor and student exist first
          return {
            id: session.id,
            enrollmentId: session.enrollment_id,
            createdAt: session.created_at,
            environment: session.environment,
            date: session.date,
            summary: session.summary,
            meeting: session.meetings,
            student: await tableToInterfaceProfiles(session.student),
            tutor: await tableToInterfaceProfiles(session.tutor),
            status: session.status,
            session_exit_form: session.session_exit_form,
            isQuestionOrConcern: Boolean(session.is_question_or_concern),
            isFirstSession: Boolean(session.is_first_session),
            duration: session.duration,
          };
        }),
    );

    return sessions;
  } catch (error) {
    console.error("Error fetching sessions", error);
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
    const supabase = await createClient();

    let query = supabase.from(Table.Sessions).select(`
      id,
      enrollment_id,
      created_at,
      environment,
      student_id,
      tutor_id,
      date,
      summary,
      meeting_id,
      status,
      is_question_or_concern,
      is_first_session,
      session_exit_form,
      duration,
      meetings:Meetings!meeting_id(*),
      student:Profiles!student_id(*),
      tutor:Profiles!tutor_id(*)
    `);

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
      throw error;
    }

    const sessions: Session[] = data
      .filter((session: any) => session.student && session.tutor)
      .map((session: any) => ({
        id: session.id,
        enrollmentId: session.enrollment_id,
        createdAt: session.created_at,
        environment: session.environment,
        date: session.date,
        summary: session.summary,
        // meetingId: session.meeting_id,
        // meeting: await getMeeting(session.meeting_id),
        meeting: session.meetings,
        student: tableToInterfaceProfiles(session.student),
        tutor: tableToInterfaceProfiles(session.tutor),
        // student: await getProfileWithProfileId(session.student_id),
        // tutor: await getProfileWithProfileId(session.tutor_id),
        status: session.status,
        session_exit_form: session.session_exit_form,
        isQuestionOrConcern: Boolean(session.is_question_or_concern),
        isFirstSession: Boolean(session.is_first_session),
        duration: session.duration,
      }));

    return sessions;
  } catch (error) {
    console.error("Error fetching sessions", error);
    return [];
  }
}

export async function updateSessionParticipantion(meetingID: string) {}

export interface ParticipationEvent {
  id: string;
  participantId: string;
  name: string;
  email: string;
  action: "joined" | "left";
  timestamp: string;
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
}

export interface ParticipationData {
  session: {
    id: string;
    meetingTitle: string;
    meetingId: string;
    startTime: string;
    endTime: string | null;
    totalDuration: number;
  };
  events: ParticipationEvent[];
  participantSummaries: ParticipationSummary[];
}

export async function getParticipationData(
  sessionId: string,
): Promise<ParticipationData | null> {
  try {
    if (!sessionId) {
      return null;
    }

    // Get session details to calculate meeting end time
    const session = await getSessionById(sessionId);

    if (!session) {
      return null;
    }

    // Get participation records
    const participationRecords = await getParticipationBySessionId(sessionId);

    // Transform participation records into events format
    // Each record in zoom_participant_events already represents a single action (joined or left)
    const events: ParticipationEvent[] = participationRecords.map((record) => ({
      id: record.id,
      participantId: record.participant_id,
      name: record.name,
      email: record.email || "",
      action: record.action as "joined" | "left",
      timestamp: record.timestamp,
    }));

    // Sort events by timestamp
    events.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    // Calculate participant summaries
    const participantMap = new Map<
      string,
      {
        id: string;
        name: string;
        email: string;
        totalDuration: number;
        joinCount: number;
        currentlyInMeeting: boolean;
        firstJoined: string;
        lastActivity: string;
      }
    >();

    const sessionStartTime = session.date ? new Date(session.date) : new Date();
    const sessionEndTime = session.duration
      ? new Date(sessionStartTime.getTime() + session.duration * 60 * 1000)
      : null;

    events.forEach((event) => {
      if (!participantMap.has(event.participantId)) {
        participantMap.set(event.participantId, {
          id: event.participantId,
          name: event.name,
          email: event.email,
          totalDuration: 0,
          joinCount: 0,
          currentlyInMeeting: false,
          firstJoined: event.timestamp,
          lastActivity: event.timestamp,
        });
      }

      const summary = participantMap.get(event.participantId)!;
      summary.lastActivity = event.timestamp;

      if (event.action === "joined") {
        summary.joinCount++;
        summary.currentlyInMeeting = true;
      } else {
        summary.currentlyInMeeting = false;
      }
    });

    // Calculate durations for each participant
    participantMap.forEach((summary) => {
      const userEvents = events.filter((e) => e.participantId === summary.id);
      let totalDuration = 0;
      let joinTime: Date | null = null;

      userEvents.forEach((event) => {
        if (event.action === "joined") {
          joinTime = new Date(event.timestamp);
        } else if (event.action === "left" && joinTime) {
          const leaveTime = new Date(event.timestamp);
          totalDuration +=
            (leaveTime.getTime() - joinTime.getTime()) / (1000 * 60);
          joinTime = null;
        }
      });

      // If still in meeting, calculate duration until session end or now
      if (joinTime !== null && summary.currentlyInMeeting) {
        const now = new Date();
        const joinTimeDate = joinTime as Date;

        // Determine the end time: use session end if it exists and is in the past,
        // otherwise use current time, but never use a time before the join time
        let endTime: Date;
        if (sessionEndTime && sessionEndTime >= joinTimeDate) {
          // Session has ended, use session end time (but not if it's in the future)
          endTime = sessionEndTime < now ? sessionEndTime : now;
        } else {
          // No session end time or it's before join time, use current time
          endTime = now;
        }

        // Only calculate if join time is before or equal to end time
        if (joinTimeDate <= endTime) {
          const duration =
            (endTime.getTime() - joinTimeDate.getTime()) / (1000 * 60);
          // Only add positive durations
          if (duration > 0) {
            totalDuration += duration;
          }
        }
      }

      // Ensure totalDuration is never negative
      summary.totalDuration = Math.max(0, Math.round(totalDuration));
    });

    const participantSummaries = Array.from(participantMap.values()).sort(
      (a, b) => b.totalDuration - a.totalDuration,
    );

    return {
      session: {
        id: session.id,
        meetingTitle: session.meeting?.name || "Tutoring Session",
        meetingId: session.meeting?.meetingId || "",
        startTime: session.date,
        endTime: sessionEndTime?.toISOString() || null,
        totalDuration: session.duration || 0,
      },
      events,
      participantSummaries,
    };
  } catch (error) {
    console.error("Error fetching participation data:", error);
    return null;
  }
}

export async function getSessionById(
  sessionId: string,
): Promise<Session | null> {
  try {
    const supabase = await createClient();

    const { data: sessionData, error: sessionError } = await supabase
      .from(Table.Sessions)
      .select(
        `
        id,
        enrollment_id,
        created_at,
        environment,
        student_id,
        tutor_id,
        date,
        summary,
        meeting_id,
        status,
        is_question_or_concern,
        is_first_session,
        session_exit_form,
        duration,
        meetings:Meetings!meeting_id(*)
      `,
      )
      .eq("id", sessionId)
      .single();

    if (sessionError || !sessionData) {
      console.error("Error fetching session:", sessionError);
      return null;
    }

    const [student, tutor] = await Promise.all([
      getProfileWithProfileId(sessionData.student_id),
      getProfileWithProfileId(sessionData.tutor_id),
    ]);

    const session: Session = {
      id: sessionData.id,
      enrollmentId: sessionData.enrollment_id,
      createdAt: sessionData.created_at,
      environment: sessionData.environment,
      date: sessionData.date,
      summary: sessionData.summary,
      meeting:
        sessionData.meetings && !Array.isArray(sessionData.meetings)
          ? await getMeeting((sessionData.meetings as any).id)
          : null,
      student,
      tutor,
      status: sessionData.status,
      session_exit_form: sessionData.session_exit_form,
      isQuestionOrConcern: Boolean(sessionData.is_question_or_concern),
      isFirstSession: Boolean(sessionData.is_first_session),
      duration: sessionData.duration,
    };

    return session;
  } catch (error) {
    console.error("Error fetching session by ID:", error);
    return null;
  }
}

export async function getTutorSessions(
  profileId: string,
  params: {
    startDate?: string;
    endDate?: string;
    status?: string | string[];
    orderBy?: string;
    ascending?: boolean;
  },
): Promise<Session[]> {
  const supabase = await createClient();
  const { startDate, endDate, status, orderBy, ascending } = params
    ? params
    : {};

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
    throw error;
  }

  // Map the result to the Session interface
  const sessions: Session[] = data
    .filter((data) => data.meeting && data.student && data.tutor)
    .map((session: any) => {
      return {
        id: session.id,
        enrollmentId: session.enrollment_id,
        createdAt: session.created_at,
        environment: session.environment,
        date: session.date,
        summary: session.summary,
        meeting: tableToInterfaceMeetings(session.meeting),
        student: tableToInterfaceProfiles(session.student),
        tutor: tableToInterfaceProfiles(session.tutor),
        status: session.status,
        session_exit_form: session.session_exit_form,
        isQuestionOrConcern: Boolean(session.isQuestionOrConcernO),
        isFirstSession: Boolean(session.isFirstSession),
        duration: session.duration,
      };
    });

  return sessions;
}

export async function getStudentSessions(
  profileId: string,
  params?: {
    startDate?: string;
    endDate?: string;
    status?: string | string[];
    orderBy?: string;
    ascending?: boolean;
  },
): Promise<Session[]> {
  const supabase = await createClient();
  const { startDate, endDate, status, orderBy, ascending } = params
    ? params
    : {};

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
    throw error;
  }

  // Map the result to the Session interface
  const sessions: Session[] = data
    .filter(
      (session) => session.meeting && session.tutor_id && session.student_id,
    )
    .map((session: any) => ({
      id: session.id,
      enrollmentId: session.enrollment_id,
      createdAt: session.created_at,
      environment: session.environment,
      date: session.date,
      summary: session.summary,
      // meetingId: session.meeting_id,
      meeting: tableToInterfaceMeetings(session.meeting),
      status: session.status,
      student: tableToInterfaceProfiles(session.student),
      tutor: tableToInterfaceProfiles(session.tutor),
      session_exit_form: session.session_exit_form,
      isQuestionOrConcern: session.isQuestionOrConcern,
      isFirstSession: session.isFirstSession,
      duration: session.duration,
    }));

  return sessions;
}

export async function rescheduleSession(
  sessionId: string,
  newDate: any,
  meetingId: string,
  tutorid?: string,
) {
  const supabase = await createClient();
  try {
    const { data: sessionData, error } = await supabase
      .from(Table.Sessions)
      .update({
        date: newDate,
        meeting_id: meetingId,
      })
      .eq("id", sessionId)
      .select("*")
      .single();

    if (error) throw error;

    const { error: notificationError } = await supabase
      .from("Notifications")
      .insert({
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
      return sessionData;
    }
  } catch (error) {
    console.error("Unable to reschedule", error);
    throw error;
  }
}
export async function addOneSession(
  session: Session,
  scheduleEmail: boolean = true,
  details?: {
    student?: Profile;
    tutor?: Profile;
    meeting?: Meeting;
  },
): Promise<void> {
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
      environment: session.environment || "Virtual",
    };

    const { data, error } = await supabase
      .from(Table.Sessions)
      .insert(newSession)
      .select()
      .single();

    const [meeting, student, tutor] = await Promise.all([
      details?.meeting || (await getMeeting(data.meeting_id)),
      details?.student || (await getProfileWithProfileId(data.student_id)),
      details?.tutor || (await getProfileWithProfileId(data.tuotr_id)),
    ]);

    if (error) throw error;

    if (!data) toast.error("No Data");

    if (data && scheduleEmail) {
      const addedSession: Session = {
        id: data.id,
        enrollmentId: data.enrollment_id,
        createdAt: data.created_at,
        environment: data.environment,
        date: data.date,
        summary: data.summary,
        meeting: meeting,
        student: student,
        tutor: tutor,
        status: data.status,
        session_exit_form: data.session_exit_form || null,
        isQuestionOrConcern: data.isQuestionOrConcern,
        isFirstSession: data.isFirstSession,
        duration: 1, //default //! might fix
      };

      sendScheduledEmailsBeforeSessions([addedSession]);
    }
  } catch (error) {
    console.error("Unable to add one session", error);
    throw error;
  }
}

export async function cancelUnsubmittedSEF(profile: Profile) {
  try {
    const supabase = await createClient();
    const now = new Date();
    const fortyEightHoursAgo = new Date(
      now.getTime() - 48 * 60 * 60 * 1000,
    ).toISOString();

    await supabase
      .from("Sessions")
      .update({ status: "Complete" })
      .eq("tutor_id", profile.id)
      .lt("session_date", fortyEightHoursAgo);
  } catch (error) {
    console.error("Unable to cancel unsubmitted SEF");
  }
}
