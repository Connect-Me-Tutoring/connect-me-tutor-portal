import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  Profile,
  Session,
  Notification,
  Event,
  Enrollment,
  Meeting,
} from "@/types";
import {
  deleteScheduledEmailBeforeSessions,
  sendScheduledEmailsBeforeSessions,
  updateScheduledEmailBeforeSessions,
} from "./email.server.actions";
import { getProfileWithProfileId, getProfileByEmail } from "./user.actions";
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
} from "date-fns"; // Only use date-fns
import ResetPassword from "@/app/(auth)/set-password/page";
import { date } from "zod";
import { withCoalescedInvoke } from "next/dist/lib/coalesced-function";
import toast from "react-hot-toast";
import { DatabaseIcon } from "lucide-react";
import { SYSTEM_ENTRYPOINTS } from "next/dist/shared/lib/constants";
import { getMeeting } from "./admin.actions";
import { fromZonedTime } from "date-fns-tz";
import { Table } from "../supabase/tables";
import {
  tableToInterfaceMeetings,
  tableToInterfaceProfiles,
  tableToInterfaceSessions,
} from "../type-utils";
import { supabase } from "@/lib/supabase/client";
// import { getMeeting } from "./meeting.actions";

/**
 * Fetches all sessions within a 24-hour window around the requested date
 * @param requestedDate - The date to search around for existing sessions
 * @returns Promise resolving to array of sessions or undefined
 */
export const fetchDaySessionsFromSchedule = async (requestedDate: Date) => {
  if (requestedDate) {
    try {
      const startDateSearch = addHours(requestedDate, -12).toISOString();

      const endDateSearch = addHours(requestedDate, 12).toISOString();
      const data = await getAllSessions(startDateSearch, endDateSearch);
      return data;
    } catch (error) {
      console.error("Failed to fetch sessions for day");
      throw error;
    }
  }
};

export async function getSessionKeys(data?: Session[]) {
  const sessionKeys: Set<string> = new Set();

  if (!data) {
    const { data, error } = await supabase
      .from(Table.Sessions)
      .select("student_id, tutor_id, date");

    if (error) {
      console.error("Error fetching sessions:", error);
      throw error;
    }
  }

  if (!data) return sessionKeys;

  data.forEach((session) => {
    if (session.date) {
      const sessionDate = new Date(session.date);
      const key = `${session.student?.id}-${session.tutor?.id}-${format(
        sessionDate,
        "yyyy-MM-dd-HH:mm",
      )}`;
      sessionKeys.add(key);
    }
  });

  return sessionKeys;
}

/**
 * Add sessions for enrollments within the specified week range
 * @param weekStartString - ISO string of week start in Eastern Time
 * @param weekEndString - ISO string of week end in Eastern Time
 * @param enrollments - List of enrollments to create sessions for
 * @param sessions - Existing sessions to avoid duplicates
 * @returns Newly created sessions
 */
export async function addSessions(
  weekStartString: string,
  weekEndString: string,
  enrollments: Enrollment[],
  sessions: Session[],
) {
  try {
    const weekStart: Date = fromZonedTime(
      parseISO(weekStartString),
      "America/New_York",
    );
    const weekEnd: Date = fromZonedTime(
      parseISO(weekEndString),
      "America/New_York",
    );

    const now: string = new Date().toISOString();

    //Set created to avoid duplicates
    const scheduledSessions: Set<string> = await getSessionKeys(sessions);

    // skip enrollments that already have a session this week, even if rescheduled to a different time
    const enrollmentsWithSessions: Set<string> = new Set(
      sessions
        .filter((s) => s.enrollmentId)
        .map((s) => s.enrollmentId as string),
    );

    // Prepare bulk insert data
    const sessionsToCreate: any[] = [];

    // Process all enrollments
    for (const enrollment of enrollments) {
      const {
        id,
        student,
        tutor,
        availability,
        meetingId,
        summary,
        startDate,
        duration,
        frequency,
      } = enrollment;

      //Check if paused over the summer
      if (enrollment.paused) {
        continue;
      }

      // already has a session this week, probably rescheduled
      if (enrollmentsWithSessions.has(id)) {
        continue;
      }

      // Skip invalid enrollments
      if (!student?.id || !tutor?.id || !availability?.length) {
        continue;
      }

      // Process each availability slot
      let { day, startTime, endTime } = availability[0];

      // Skip invalid time formats
      if (
        !startTime ||
        !endTime
        // startTime.includes("-") ||
        // endTime.includes("-")
      ) {
        console.error(`Invalid time format in availability:`, availability[0]);
        continue;
      }

      const startDate_asDate = new Date(startDate);

      // Find matching day in the week range
      let currentDate = new Date(weekStart);
      const dayLower = day.toLowerCase();

      while (currentDate <= weekEnd) {
        const currentDay = format(currentDate, "EEEE").toLowerCase();

        // Skip days that don't match
        if (currentDay !== dayLower) {
          currentDate = addDays(currentDate, 1);
          continue;
        }

        //Add Seven Days if CurrentDate is last week (Acts as a Modulus to ensure updating current week only)
        if (currentDate < parseISO(weekStartString)) {
          currentDate = addDays(currentDate, 7);
        }

        //Remove Seven Days if CurrentDate is next week (Acts as a Modulus to ensure updating current week only)
        if (currentDate > parseISO(weekEndString)) {
          currentDate = addDays(currentDate, -7);
        }

        try {
          // Parse times correctly
          const [startHour, startMinute] = startTime.split(":").map(Number);
          const [endHour, endMinute] = endTime.split(":").map(Number);

          if (
            isNaN(startHour) ||
            isNaN(startMinute) ||
            isNaN(endHour) ||
            isNaN(endMinute)
          ) {
            throw new Error(
              `Invalid time format: start=${startTime}, end=${endTime}`,
            );
          }

          // Create session date with correct time
          // * SetHours and SetMinutes are dependent on local timezone

          const dateString = `${format(currentDate, "yyyy-MM-dd")}T${startTime}:00`;
          const sessionStartTime = fromZonedTime(
            dateString,
            "America/New_York",
          ); // Automatically handles DST

          if (sessionStartTime < startDate_asDate) {
            throw new Error("Session occurs before start date");
          }

          // Check for duplicate session
          const sessionKey = `${student.id}-${tutor.id}-${format(
            sessionStartTime,
            "yyyy-MM-dd-HH:mm",
          )}`;

          if (!scheduledSessions.has(sessionKey)) {
            // Add to batch insert
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

            // Track this session to avoid duplicates
            scheduledSessions.add(sessionKey);
          } ////
        } catch (err) {
          console.error(
            `Error processing time for ${day} ${startTime}-${endTime}:`,
            err,
          );
        }

        // Move to next day
        currentDate = addDays(currentDate, 1);
      }
    }

    // Perform batch insert if we have sessions to create
    if (sessionsToCreate.length > 0) {
      const { data, error } = await supabase
        .from(Table.Sessions)
        .insert(sessionsToCreate).select(`
          *,
          student:Profiles!student_id(*),
          tutor:Profiles!tutor_id(*),
          meeting:Meetings!meeting_id(*)
          `);

      if (error) throw error;

      if (data) {
        // Transform returned data to Session objects
        const sessions: Session[] = data.map((session: any) =>
          tableToInterfaceSessions(session),
        );
        return sessions;
      }
    }

    return [];
  } catch (error) {
    console.error("Error creating sessions:", error);
    throw error;
  }
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
    .map((session: any) => tableToInterfaceSessions(session));

  return sessions;
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
    .map((session: any) => tableToInterfaceSessions(session));

  return sessions;
}

export async function getSessionTimePassed(sessionId: string): Promise<number> {
  const { data } = await supabase
    .from("Sessions")
    .select("date")
    .single()
    .throwOnError();
  if (!data || !data.date) throw new Error("Session Date Not Found");
  const sessionDate: Date = new Date(data.date);
  const now: Date = new Date();
  const diff = now.getTime() - sessionDate.getTime();
  return diff;
}

export async function getAllSessions(
  startDate?: string,
  endDate?: string,
  orderBy?: string,
  ascending?: boolean,
): Promise<Session[]> {
  try {
    let query = supabase.from(Table.Sessions).select(`
      *,
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

    if (error) {
      console.error("Error fetching student sessions:", error.message);
      throw error;
    }

    const sessions: Session[] = data
      .filter((session: any) => session.student && session.tutor)
      .map((session: any) => tableToInterfaceSessions(session));

    return sessions;
  } catch (error) {
    console.error("Error fetching sessions", error);
    return [];
  }
}
