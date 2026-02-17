"use client";
// lib/admins.actions.ts

// lib/student.actions.ts
import { getSupabase, supabase, supabaseClient } from "@/lib/supabase/client";
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
  startOfWeek,
  endOfWeek,
  subDays,
} from "date-fns"; // Only use date-fns
import * as DateFNS from "date-fns-tz";
import ResetPassword from "@/app/(auth)/set-password/page";
import { getStudentSessions } from "./student.actions";
import { date } from "zod";
import { withCoalescedInvoke } from "next/dist/lib/coalesced-function";
import toast from "react-hot-toast";
import { DatabaseIcon } from "lucide-react";
import { SYSTEM_ENTRYPOINTS } from "next/dist/shared/lib/constants";
import { Table } from "../supabase/tables";
import { handleCalculateDuration } from "@/lib/utils";
import { tableToInterfaceProfiles } from "../type-utils";
import { createPairingRequest } from "./pairing.actions";
import { scheduleMultipleSessionReminders } from "../twilio";
import { removeFutureSessions } from "./enrollment.server.actions";
// import { getMeeting } from "./meeting.actions";

const { fromZonedTime } = DateFNS;

/* PROFILES */
export async function getAllProfiles(
  role: "Student" | "Tutor" | "Admin",
  orderBy?: string | null,
  ascending?: boolean | null,
  status?: string | null,
): Promise<Profile[] | null> {
  try {
    const profileFields = `
      id,
      created_at,
      role,
      user_id,
      age,
      grade,
      gender,
      first_name,
      last_name,
      date_of_birth,
      start_date,
      availability,
      email,
      phone_number,
      parent_name,
      parent_phone,
      parent_email,
      tutor_ids,
      timezone,
      subjects_of_interest,
      languages_spoken,
      status,
      student_number,
      settings_id
    `;

    // Build query
    let query = supabase
      .from(Table.Profiles)
      .select(profileFields)
      .eq("role", role);

    if (status) {
      query = query.eq("status", status);
    }

    // Add ordering if provided
    if (orderBy && ascending !== null) {
      query = query.order(orderBy, { ascending });
    }

    // Execute query
    const { data, error } = await query;

    if (error) {
      console.error("Error fetching profiles:", error.message);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    // Map database fields to camelCase Profile model
    const userProfiles: Profile[] = data.map((profile) => ({
      id: profile.id,
      createdAt: profile.created_at,
      role: profile.role,
      userId: profile.user_id,
      age: profile.age,
      grade: profile.grade,
      gender: profile.gender,
      firstName: profile.first_name,
      lastName: profile.last_name,
      dateOfBirth: profile.date_of_birth,
      startDate: profile.start_date,
      availability: profile.availability,
      email: profile.email,
      phoneNumber: profile.phone_number,
      parentName: profile.parent_name,
      parentPhone: profile.parent_phone,
      parentEmail: profile.parent_email,
      tutorIds: profile.tutor_ids,
      timeZone: profile.timezone,
      subjectsOfInterest: profile.subjects_of_interest,
      status: profile.status,
      studentNumber: profile.student_number,
      settingsId: profile.settings_id,
      subjects_of_interest: profile.subjects_of_interest,
      languages_spoken: profile.languages_spoken,
    }));

    return userProfiles;
  } catch (error) {
    console.error("Unexpected error in getProfile:", error);
    return null;
  }
}

// export async function deleteUser(profileId: string) {
//   try {
//     if (!profileId) throw new Error("Profile ID is required");

//     const response = await fetch("/api/admin/delete-user", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({ profileId }),
//     });

//     if (!response.ok) {
//       const error = await response.json();
//       throw new Error(
//         error.error || `HTTP ${response.status}: Failed to delete user`
//       );
//     }

//     const response = await

//     return await response.json();
//   } catch (error) {
//     console.error("Error deleting user:", error);
//     throw error;
//   }
// }

export async function getUserFromId(profileId: string) {
  try {
    const { data: profile, error } = await supabase
      .from(Table.Profiles)
      .select(
        ` id,
          created_at,
          role,
          user_id,
          first_name,
          last_name,
          age,
          grade,
          gender,
          date_of_birth,
          start_date,
          availability,
          email,
          phone_number,
          parent_name,
          parent_phone,
          parent_email,
          tutor_ids,
          timezone,
          subjects_of_interest,
          languages_spoken,
          status,
          student_number,
          settings_id
        `,
      )
      .eq("id", profileId)
      .single();

    if (error) {
      throw error;
    }
    if (!profile) return null;

    const userProfile: Profile = {
      id: profile.id,
      createdAt: profile.created_at,
      role: profile.role,
      userId: profile.user_id,
      firstName: profile.first_name,
      lastName: profile.last_name,
      age: profile.age,
      grade: profile.grade,
      gender: profile.gender,
      dateOfBirth: profile.date_of_birth,
      startDate: profile.start_date,
      availability: profile.availability,
      email: profile.email,
      phoneNumber: profile.phone_number,
      parentName: profile.parent_name,
      parentPhone: profile.parent_phone,
      parentEmail: profile.parent_email,
      tutorIds: profile.tutor_ids,
      timeZone: profile.timezone,
      subjects_of_interest: profile.subjects_of_interest,
      languages_spoken: profile.languages_spoken,
      status: profile.status,
      studentNumber: profile.student_number,
      settingsId: profile.settings_id,
    };
    return userProfile;
  } catch (error) {
    console.error("Failed to fetch user");
    return null;
  }
}

export async function deactivateUser(profileId: string) {
  try {
    const { data, error } = await supabase
      .from(Table.Profiles)
      .update({ status: "Inactive" })
      .eq("id", profileId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error deactivating user:", error);
    throw error;
  }
}

export async function reactivateUser(profileId: string) {
  try {
    const { data, error } = await supabase
      .from(Table.Profiles)
      .update({ status: "Active" })
      .eq("id", profileId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error reactivating user:", error);
    throw error;
  }
}

/* USERS */

export const sendConfirmationEmail = async (email: string) => {
  try {
    await resendEmailConfirmation(email);
  } catch (error) {
    console.error("Unable to send confirmation email", email);
    throw error;
  }
};

export const createConfirmationEmail = async (
  email: string,
  tempPassword: string,
) => {
  try {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "signup",
      email: email,
      password: tempPassword,
      options: {
        redirectTo: `${window.location.origin}`,
      },
    });
  } catch (error) {
    console.error("Unable to create confirmation email");
    throw error;
  }
};

export const resendEmailConfirmation = async (email: string) => {
  try {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email,
      options: {
        emailRedirectTo: `${window.location.origin}`,
      },
    });
    if (error) throw error;
  } catch (error) {
    console.error("Failed to resend Email Confirmation", error);
    throw error;
  }
};

/* SESSIONS */
export async function createSession(sessionData: any) {
  const { data, error } = await supabase
    .from(Table.Sessions)
    .insert(sessionData)
    .single();

  if (error) throw error;
  return data;
}

export async function getAllSessions(
  startDate?: string,
  endDate?: string,
  orderBy?: string,
  ascending?: boolean,
): Promise<Session[]> {
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

// export function getAllSessions(
//   startDate?: string,
//   endDate?: string,
//   orderBy?: string,
//   ascending?: boolean
// ) {
//   try {
//     let query = supabase.from(Table.Sessions).select(`
//       id,
//       created_at,
//       environment,
//       student_id,
//       tutor_id,
//       date,
//       summary,
//       meeting_id,
//       status,
//       is_question_or_concern,
//       is_first_session,
//       session_exit_form
//     `);

//     if (startDate) {
//       query = query.gte("date", startDate);
//     }
//     if (endDate) {
//       query = query.lte("date", endDate);
//     }

//     if (orderBy && ascending !== undefined) {
//       query = query.order(orderBy, { ascending });
//     }

//     const { data, error } = await query;

//     if (error) {
//       console.error("Error fetching student sessions:", error.message);
//       throw error;
//     }

//     // Map the result to the Session interface
//     const sessions: Session[] = await Promise.all(
//       data.map(async (session: any) => ({
//         id: session.id,
//         createdAt: session.created_at,
//         environment: session.environment,
//         date: session.date,
//         summary: session.summary,
//         // meetingId: session.meeting_id,
//         meeting: await getMeeting(session.meeting_id),
//         student: await getProfileWithProfileId(session.student_id),
//         tutor: await getProfileWithProfileId(session.tutor_id),
//         status: session.status,
//         session_exit_form: session.session_exit_form,
//         isQuestionOrConcern: Boolean(session.is_question_or_concern),
//         isFirstSession: Boolean(session.is_first_session),
//       }))
//     );

//     console.log(sessions);

//     return sessions;
//   } catch (error) {
//     console.error("Error fetching sessions");
//     return [];
//   }
// }

export async function rescheduleSession(sessionId: string, newDate: string) {
  const { data, error } = await supabase
    .from(Table.Sessions)
    .update({
      date: newDate,
    })
    .eq("id", sessionId)
    .single();

  if (error) throw error;
  return data;
}

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
 * Checks if a meeting is available at the requested session time
 *
 * @param meetingId - ID of the meeting to check
 * @param sessionId - ID of the current session (to exclude from conflicts)
 * @param sessionDate - ISO string date of the requested session
 * @param existingSessions - Array of all sessions to check for conflicts
 * @returns boolean - True if the meeting is available
 */
// export async function isMeetingAvailable(
//   meetingId: string,
//   sessionId: string | undefined,
//   sessionDate: string,
//   existingSessions: Session[]
// ): Promise<boolean> {
//   try {
//     // Check if the session date is valid
//     if (!sessionDate || !isValid(parseISO(sessionDate))) {
//       console.error("Invalid session date provided");
//       return false;
//     }

//     // Calculate session time range
//     const sessionStartTime = parseISO(sessionDate);
//     const sessionEndTime = addHours(sessionStartTime, 1);

//     // Check for conflicts with existing sessions
//     const hasConflict = existingSessions.some(
//       (existingSession) =>
//         // Don't check against the same session we're updating
//         sessionId !== existingSession.id &&
//         // Check if the meeting ID matches
//         existingSession.meeting?.id === meetingId &&
//         // Check for time overlap
//         areIntervalsOverlapping(
//           { start: sessionStartTime, end: sessionEndTime },
//           {
//             start: parseISO(existingSession.date),
//             end: addHours(parseISO(existingSession.date), 1),
//           }
//         )
//     );

//     // Return true if no conflicts found
//     return !hasConflict;
//   } catch (error) {
//     console.error("Error checking meeting availability:", error);
//     return false; // Default to unavailable on error
//   }
// }

/**
 *Applies a SQL query to check if an individual meeting is available
 *@param meetingId
 *@param session
 */

export async function isSingleMeetingAvailable(
  meetingId: string,
  session: Session,
): Promise<void> {}

/**
 * Checks availability of multiple meetings at once
 *
 * @param meetings - Array of meetings to check
 * @param sessionId - ID of the current session
 * @param sessionDate - ISO string date of the requested session
 * @param existingSessions - Array of all sessions to check for conflicts
 * @returns Record<string, boolean> - Map of meeting IDs to availability
 */
// export async function checkMeetingsAvailability(
//   meetings: Meeting[],
//   sessionId: string | undefined,
//   sessionDate: string,
//   existingSessions: Session[]
// ): Promise<Record<string, boolean>> {
//   try {
//     const meetingAvailability: Record<string, boolean> = {};

//     // Initialize all meetings as available
//     meetings.forEach((meeting) => {
//       meetingAvailability[meeting.id] = true;
//     });

//     // Check each meeting for conflicts
//     for (const meeting of meetings) {
//       meetingAvailability[meeting.id] = await isMeetingAvailable(
//         meeting.id,
//         sessionId,
//         sessionDate,
//         existingSessions
//       );
//     }

//     return meetingAvailability;
//   } catch (error) {
//     console.error("Error checking meetings availability:", error);
//     return {}; // Return empty object on error
//   }
// }

async function isSessioninPastWeek(enrollmentId: string, midWeek: Date) {
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

export async function updateSession(
  updatedSession: Session,
  updateEmail: boolean = true,
) {
  try {
    const {
      id,
      status,
      tutor,
      student,
      date,
      summary,
      meeting,
      session_exit_form,
      isQuestionOrConcern,
      isFirstSession,
    } = updatedSession;

    const { data, error } = await supabase
      .from(Table.Sessions)
      .update({
        status: status,
        student_id: student?.id,
        tutor_id: tutor?.id,
        date: date,
        summary: summary,
        meeting_id: meeting?.id,
        session_exit_form: session_exit_form,
        is_question_or_concern: isQuestionOrConcern,
        is_first_session: isFirstSession,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating session:", error);
      return null;
    }

    if (data) {
      return data[0];
    } else {
      console.error("NO DATA");
    }
    if (updateEmail && data) {
      const newSession: Session = {
        id: data.id,
        enrollmentId: data.enrollment_id,
        createdAt: data.created_at,
        environment: data.environment,
        date: data.date,
        summary: data.summary,
        meeting: await getMeeting(data.meeting_id),
        student: await getProfileWithProfileId(data.student_id),
        tutor: await getProfileWithProfileId(data.tutor_id),
        status: data.status,
        session_exit_form: data.session_exit_form || null,
        isQuestionOrConcern: data.isQuestionOrConcern,
        isFirstSession: data.isFirstSession,
        duration: data.duration,
      };
      await updateScheduledEmailBeforeSessions(newSession);
    }
  } catch (error) {
    console.error("Unable to update session");
    throw error;
  }
}

export async function removeSession(
  sessionId: string,
  updateEmail: boolean = true,
) {
  // Create a notification for the admin
  const { error: eventError } = await supabase
    .from(Table.Sessions)
    .delete()
    .eq("id", sessionId);

  if (eventError) {
    throw eventError;
  }

  if (updateEmail) {
    await deleteScheduledEmailBeforeSessions(sessionId);
  }
}

/* MEETINGS */
export async function getMeetings(): Promise<Meeting[] | null> {
  try {
    // Fetch meeting details from Supabase
    const { data, error } = await supabase.from(Table.Meetings).select(`
        id,
        link,
        meeting_id,
        password,
        created_at,
        name
      `);

    // Check for errors and log them
    if (error) {
      console.error("Error fetching event details:", error.message);
      return null; // Returning null here is valid since the function returns Promise<Notification[] | null>
    }

    // Check if data exists
    if (!data) {
      return null; // Valid return
    }

    // Mapping the fetched data to the Notification object
    const meetings: Meeting[] = await Promise.all(
      data.map(async (meeting: any) => ({
        id: meeting.id,
        name: meeting.name,
        meetingId: meeting.meeting_id,
        password: meeting.password,
        link: meeting.link,
        createdAt: meeting.created_at,
        // name: meeting.name,
      })),
    );

    return meetings; // Return the array of notifications
  } catch (error) {
    console.error("Unexpected error in getMeeting:", error);
    return null; // Valid return
  }
}

/* ENROLLMENTS */
export async function getAllEnrollments(): Promise<Enrollment[] | null> {
  try {
    // Fetch meeting details from Supabase
    const { data, error } = await supabase.from(Table.Enrollments).select(`
        id,
        created_at,
        summary,
        student_id,
        tutor_id,
        start_date,
        end_date,
        availability,
        meetingId,
        paused,
        duration,
        frequency,
        student:Profiles!student_id(*),
        tutor:Profiles!tutor_id(*)
      `);

    // Check for errors and log them
    if (error) {
      console.error("Error fetching event details:", error.message);
      return null; // Returning null here is valid since the function returns Promise<Notification[] | null>
    }

    // Check if data exists
    if (!data) {
      return null; // Valid return
    }

    // Mapping the fetched data to the Notification object
    const enrollments: Enrollment[] = data
      .filter((enrollment) => enrollment.student && enrollment.tutor)
      .map((enrollment: any) => ({
        createdAt: enrollment.created_at,
        id: enrollment.id,
        summary: enrollment.summary,
        student: tableToInterfaceProfiles(enrollment.student),
        tutor: tableToInterfaceProfiles(enrollment.tutor),
        startDate: enrollment.start_date,
        endDate: enrollment.end_date,
        availability: enrollment.availability,
        meetingId: enrollment.meetingId,
        paused: enrollment.paused,
        duration: enrollment.duration,
        frequency: enrollment.frequency,
      }));

    return enrollments; // Return the array of enrollments
  } catch (error) {
    console.error("Unexpected error in getMeeting:", error);
    return null;
  }
}

export async function pauseEnrollmentOverSummer(enrollment: Enrollment) {
  try {
    const { data, error } = await supabase
      .from(Table.Enrollments)
      .update({ paused: enrollment.paused })
      .eq("id", enrollment.id)
      .select()
      .single();

    if (error) throw error;

    return enrollment;
  } catch (error) {
    console.error("Unable to pause/unpause enrollment over summer");
    throw error;
  }
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  try {
    // Fetch meeting details from Supabase
    const { data, error } = await supabase
      .from("Meetings")
      .select(
        `
        id,
        link,
        meeting_id,
        password,
        created_at,
        name
      `,
      )
      .eq("id", id)
      .single();

    // Check for errors and log them
    if (error) {
      console.error("Error fetching event details:", error.message);
      return null; // Returning null here is valid since the function returns Promise<Notification[] | null>
    }
    // Check if data exists
    if (!data) {
      return null; // Valid return
    }
    // Mapping the fetched data to the Notification object
    const meeting: Meeting = {
      id: data.id,
      name: data.name,
      meetingId: data.meeting_id,
      password: data.password,
      link: data.link,
      createdAt: data.created_at,
    };
    return meeting; // Return the array of notifications
  } catch (error) {
    console.error("Unexpected error in getMeeting:", error);
    return null; // Valid return
  }
}

export async function getEventsWithTutorMonth(
  tutorId: string,
  selectedMonth: string,
): Promise<Event[] | null> {
  try {
    // Fetch event details filtered by tutor IDs and selected month
    const { data, error } = await supabase
      .from("Events")
      .select(
        `
        id,
        created_at,
        date,
        summary,
        tutor_id,
        hours
      `,
      )
      .eq("tutor_id", tutorId) // Filter by tutor IDs
      .gte("date", selectedMonth) // Filter events from the start of the selected month
      .lt(
        "date",
        new Date(
          new Date(selectedMonth).setMonth(
            new Date(selectedMonth).getMonth() + 1,
          ),
        ).toISOString(),
      ); // Filter before the start of the next month

    // Check for errors and log them
    if (error) {
      console.error("Error fetching event details:", error.message);
      return null;
    }

    // Check if data exists
    if (!data) {
      return null;
    }

    // Map the fetched data to the Event object
    const events: Event[] = data.map((event: any) => ({
      createdAt: event.created_at,
      id: event.id,
      summary: event.summary,
      tutorId: event.tutor_id,
      date: event.date,
      hours: event.hours,
      type: event.type,
    }));

    return events; // Return the array of events
  } catch (error) {
    console.error("Unexpected error in getEventsWithTutorMonth:", error);
    return null;
  }
}

export async function createEvent(event: Event) {
  // Create a notification for the admin
  const { error: eventError } = await supabase.from("Events").insert({
    date: event.date,
    summary: event.summary,
    tutor_id: event.tutorId,
    hours: event.hours,
    type: event.type,
  });

  if (eventError) {
    throw eventError;
  }
}

export async function removeEvent(eventId: string): Promise<boolean> {
  try {
    // Validate eventId format
    if (!eventId || typeof eventId !== "string") {
      console.error("Invalid event ID provided:", eventId);
      return false;
    }

    // Attempt to delete the event
    const { data, error, count } = await supabase
      .from("Events")
      .delete()
      .eq("id", eventId)
      .select(); // Add this to get back the deleted record

    if (error) {
      console.error("Error deleting event:", error);
      throw error;
    }

    // Check if any records were actually deleted
    if (!data || data.length === 0) {
      console.warn(`No event found with ID: ${eventId}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to remove event:", error);
    throw error;
  }
}

/* NOTIFICATIONS */
export async function getAllNotifications(): Promise<Notification[] | null> {
  try {
    // Fetch meeting details from Supabase
    const { data, error } = await supabase.from("Notifications").select(`
        id,
        created_at,
        session_id,
        previous_date,
        suggested_date,
        tutor_id,
        student_id,
        status,
        summary,
        student:Profiles!student_id(*),
        tutor:Profiles!tutor_id(*)
      `);

    // Check for errors and log them
    if (error) {
      console.error("Error fetching notification details:", error.message);
      return null; // Returning null here is valid since the function returns Promise<Notification[] | null>
    }

    // Check if data exists
    if (!data) {
      return null; // Valid return
    }

    // Mapping the fetched data to the Notification object
    const notifications: Notification[] = data.map((notification: any) => ({
      createdAt: notification.created_at,
      id: notification.id,
      summary: notification.summary,
      sessionId: notification.session_id,
      previousDate: notification.previous_date,
      suggestedDate: notification.suggested_date,
      student: tableToInterfaceProfiles(notification.student_id),
      tutor: tableToInterfaceProfiles(notification.tutor_id),
      status: notification.status,
    }));

    return notifications; // Return the array of notifications
  } catch (error) {
    console.error("Unexpected error in getMeeting:", error);
    return null; // Valid return
  }
}

export const updateNotification = async (
  notificationId: string,
  status: "Active" | "Resolved",
) => {
  try {
    const { data, error } = await supabase
      .from("Notifications") // Adjust this table name to match your database
      .update({ status: status }) // Update the status field
      .eq("id", notificationId); // Assuming `id` is the primary key for the notifications table

    if (error) {
      throw error; // Handle the error as needed
    }

    return data; // Return the updated notification data or whatever is needed
  } catch (error) {
    console.error("Error updating notification:", error);
    throw new Error("Failed to update notification");
  }
};

// function zonedTimeToUtc(arg0: any, arg1: string) {
//   throw new Error("Function not implemented.");
// }
