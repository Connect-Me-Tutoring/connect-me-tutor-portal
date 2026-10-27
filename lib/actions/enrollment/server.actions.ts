"use server";
import { Availability, Enrollment, Profile, Session } from "@/types";
import { createAdminClient, createClient } from "../../supabase/server";
import { logError } from "@/lib/posthog";
import { Table } from "../../supabase/tables";
import {
  tableToInterfaceEnrollments,
  tableToInterfaceMeetings,
  tableToInterfaceProfiles,
} from "../../utils/type-utils";
import { cache } from "react";
import { handleCalculateDuration, isValidUUID } from "../../utils";
import { addDays, format, subDays, subWeeks } from "date-fns";
import { addStandaloneSession } from "../session/server.actions";
import { getMeeting } from "../meeting/server.actions";
import { fromZonedTime } from "date-fns-tz";
import { computeSessionDateForSchedule, getEasternWeekBounds } from "../../utils/timezone";
import { assertRoomFreeForEnrollment } from "../meeting/room-conflicts.server";
import { sendMail } from "@/lib/email/mailer";
import InactiveEnrollmentWarning from "@/components/emails/enrollments/inactve-enrollment-warning";
import InactiveEnrollmentEarlyWarning from "@/components/emails/enrollments/inactive-enrollment-early-warning";
import InactiveEnrollmentDeletion from "@/components/emails/enrollments/inactive-enrollment-deletion";
import TutorProbationEmail from "@/components/emails/tutor-probation-email";
import { getEnrollmentSchedule } from "../../enrollment-schedule";
import {
  requireAdmin,
  requireAuthenticatedProfile,
  requireEnrollmentAccess,
  requireTutorProfileAccess,
} from "../auth/authz.server";

/* ENROLLMENTS */
export async function getAllActiveEnrollmentsServer(endOfWeek: string): Promise<Enrollment[]> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    // Fetch meeting details from Supabase
    const { data, error } = await supabase
      .from(Table.Enrollments)
      .select(
        `
        id,
        created_at,
        summary,
        student_id,
        tutor_id,
        start_date,
        end_date,
        day,
        start_time,
        end_time,
        meetingId,
        paused,
        duration,
        frequency,
        student:Profiles!student_id(*),
        tutor:Profiles!tutor_id(*)
      `,
      )
      .eq("paused", false)
      .lte("start_date", endOfWeek);

    // Check for errors and log them
    if (error) {
      console.error("Error fetching event details:", error.message);
      await logError(
        error,
        { function: "getAllActiveEnrollmentsServer", end_of_week: endOfWeek },
        "enrollment_error",
      );
      throw error;
    }

    // Check if data exists
    if (!data) {
      throw new Error("No data fetched");
    }

    // Mapping the fetched data to the Notification object
    const enrollments: Enrollment[] = data.map((enrollment) =>
      tableToInterfaceEnrollments(enrollment),
    );

    return enrollments; // Return the array of enrollments
  } catch (error) {
    console.error("Error getting needed enrollment information:", error);
    await logError(
      error,
      { function: "getAllActiveEnrollmentsServer", end_of_week: endOfWeek },
      "enrollment_error",
    );
    throw error;
  }
}

export async function getAllEnrollments(): Promise<Enrollment[] | null> {
  await requireAdmin();
  const supabase = await createClient();
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
        day,
        start_time,
        end_time,
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
      await logError(error, { function: "getAllEnrollments" }, "enrollment_error");
      return null; // Returning null here is valid since the function returns Promise<Notification[] | null>
    }

    // Check if data exists
    if (!data) {
      return null; // Valid return
    }

    // Mapping the fetched data to the Notification object
    const enrollments: Enrollment[] = data
      .filter((enrollment) => enrollment.student && enrollment.tutor)
      .map((enrollment) => tableToInterfaceEnrollments(enrollment));

    return enrollments; // Return the array of enrollments
  } catch (error) {
    console.error("Unexpected error in getMeeting:", error);
    await logError(error, { function: "getAllEnrollments" }, "enrollment_error");
    return null;
  }
}

export async function getAllActiveEnrollments(endOfWeek?: string): Promise<Enrollment[]> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    // Fetch meeting details from Supabase
    let query = supabase
      .from(Table.Enrollments)
      .select(
        `
        id,
        created_at,
        summary,
        student_id,
        tutor_id,
        start_date,
        end_date,
        day,
        start_time,
        end_time,
        meetingId,
        paused,
        duration,
        frequency,
        student:Profiles!student_id(*),
        tutor:Profiles!tutor_id(*)
      `,
      )
      .eq("paused", false);

    if (endOfWeek) query = query.lte("start_date", endOfWeek);

    const { data, error } = await query;

    // Check for errors and log them
    if (error) {
      console.error("Error fetching event details:", error.message);
      await logError(
        error,
        { function: "getAllActiveEnrollments", end_of_week: endOfWeek },
        "enrollment_error",
      );
      throw error;
    }

    // Check if data exists
    if (!data) {
      throw new Error("No data fetched");
    }

    // Mapping the fetched data to the Notification object
    const enrollments: Enrollment[] = data.map((enrollment) =>
      tableToInterfaceEnrollments(enrollment),
    );

    return enrollments; // Return the array of enrollments
  } catch (error) {
    console.error("Error getting needed enrollment information:", error);
    await logError(
      error,
      { function: "getAllActiveEnrollments", end_of_week: endOfWeek },
      "enrollment_error",
    );
    throw error;
  }
}

export async function getAllActiveEnrollmentsForCron(
  startDateOnOrBefore?: string,
): Promise<Enrollment[]> {
  try {
    const supabase = await createAdminClient();
    let query = supabase
      .from(Table.Enrollments)
      .select(
        `
        id,
        created_at,
        summary,
        student_id,
        tutor_id,
        start_date,
        end_date,
        day,
        start_time,
        end_time,
        meetingId,
        paused,
        duration,
        frequency,
        student:Profiles!student_id(*),
        tutor:Profiles!tutor_id(*)
      `,
      )
      .eq("paused", false);

    if (startDateOnOrBefore) {
      query = query.lte("start_date", startDateOnOrBefore);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching active enrollments for cron:", error.message);
      await logError(error, { function: "getAllActiveEnrollmentsForCron" }, "enrollment_error");
      throw error;
    }

    if (!data) {
      throw new Error("No data fetched");
    }

    return data
      .filter((enrollment) => enrollment.student && enrollment.tutor)
      .map((enrollment: any) => tableToInterfaceEnrollments(enrollment));
  } catch (error) {
    console.error("Error getting active enrollments for cron:", error);
    await logError(error, { function: "getAllActiveEnrollmentsForCron" }, "enrollment_error");
    throw error;
  }
}

export async function getEnrollments(tutorId: string): Promise<Enrollment[] | null> {
  try {
    await requireTutorProfileAccess(tutorId);
    const supabase = await createClient();
    // Fetch meeting details from Supabase
    const { data, error } = await supabase
      .from(Table.Enrollments)
      .select(
        `
        id,
        created_at,
        summary,
        student_id,
        tutor_id,
        start_date,
        end_date,
        day,
        start_time,
        end_time,
        meetingId,
        paused,
        duration,
        student:Profiles!student_id(*),
        tutor:Profiles!tutor_id(*)
      `,
      )
      .eq("tutor_id", tutorId);

    // Check for errors and log them
    if (error) {
      console.error("Error fetching event details:", error.message);
      await logError(error, { function: "getEnrollments", tutor_id: tutorId }, "enrollment_error");
      return null; // Returning null here is valid since the function returns Promise<Notification[] | null>
    }

    // Check if data exists

    // Mapping the fetched data to the Notification object
    const enrollments: Enrollment[] = data.map((enrollment) =>
      tableToInterfaceEnrollments(enrollment),
    );

    return enrollments; // Return the array of enrollments
  } catch (error) {
    console.error("Unexpected error in getMeeting:", error);
    await logError(error, { function: "getEnrollments", tutor_id: tutorId }, "enrollment_error");
    return null;
  }
}

export const cachedGetEnrollments = cache(getEnrollments);

// Call before deleting enrollments. Sessions.enrollment_id is ON DELETE SET NULL, so
// skipping this leaves the future sessions Active with no enrollment: they keep their
// Zoom room, send reminders and turn Unconfirmed.
export const removeFutureSessions = async (enrollmentIds: string | string[], supabase: any) => {
  const ids = Array.isArray(enrollmentIds) ? enrollmentIds : [enrollmentIds];
  if (ids.length === 0) return;
  try {
    const now: string = new Date().toISOString();
    const { data: sessions } = await supabase
      .from(Table.Sessions)
      .select("id")
      .in("enrollment_id", ids)
      .not("status", "in", '(Complete,"Student Did Not Attend")')
      .gte("date", now)
      .throwOnError();

    const sessionIds: string[] = (sessions ?? []).map((session: { id: string }) => session.id);
    if (sessionIds.length === 0) return;

    // zoom_participant_events.session_id has no ON DELETE action, so an early Zoom join
    // would block the delete. Keep the events, as removeSessionServer does.
    await supabase
      .from("zoom_participant_events")
      .update({ session_id: null })
      .in("session_id", sessionIds)
      .throwOnError();

    await supabase.from(Table.Sessions).delete().in("id", sessionIds).throwOnError();
  } catch (error) {
    console.error("Unable to remove future sessions", error);
    await logError(
      error,
      { function: "removeFutureSessions", enrollment_ids: ids },
      "enrollment_error",
    );
    throw error;
  }
};
// before, it used createClient() which respects Supabase RLS
// now tho it uses createAdminCLient() to bypass RLS and guarentee deletion succeeds
export const removeEnrollment = async (enrollmentId: string) => {
  await requireEnrollmentAccess(enrollmentId);
  const adminSupabase = await createAdminClient();
  await removeFutureSessions(enrollmentId, adminSupabase);

  const supabase = await createClient();

  const { data: deleteEnrollmentData, error: deleteEnrollmentError } = await supabase
    .from("Enrollments")
    .delete()
    .eq("id", enrollmentId);

  if (deleteEnrollmentError) {
    console.error("Error removing enrollment:", deleteEnrollmentError);
    await logError(
      deleteEnrollmentError,
      { function: "removeEnrollment", enrollment_id: enrollmentId },
      "enrollment_error",
    );
    throw deleteEnrollmentError;
  }
};

const DUPLICATE_ENROLLMENT_MESSAGE =
  "An enrollment already exists for this student and tutor at the same day and time. Please edit the existing enrollment instead.";

/**
 * Rejects a second enrollment for the same student, tutor, day and start time. The
 * enrollments_unique_slot index enforces this too (it also catches concurrent requests
 * that both pass this check); this check just gives the friendly message up front.
 */
async function assertNoDuplicateEnrollment(
  supabase: any,
  slot: { studentId: string; tutorId: string; day: string; startTime: string },
  excludeEnrollmentId?: string,
) {
  let query = supabase
    .from(Table.Enrollments)
    .select("id")
    .eq("student_id", slot.studentId)
    .eq("tutor_id", slot.tutorId)
    .eq("day", slot.day)
    .eq("start_time", slot.startTime)
    .limit(1);
  if (excludeEnrollmentId) query = query.neq("id", excludeEnrollmentId);

  const { data: existing, error } = await query;

  if (error) {
    console.error("Error checking for duplicate enrollment:", error);
    await logError(error, { function: "assertNoDuplicateEnrollment" }, "enrollment_error");
    throw error;
  }

  if (existing && existing.length > 0) {
    throw new Error(DUPLICATE_ENROLLMENT_MESSAGE);
  }
}

/** Maps a unique-violation from enrollments_unique_slot to the duplicate message. */
const duplicateSlotError = (error: { code?: string }) =>
  error.code === "23505" ? new Error(DUPLICATE_ENROLLMENT_MESSAGE) : error;

export const updateEnrollment = async (enrollment: Enrollment) => {
  await requireEnrollmentAccess(enrollment.id);
  const supabase = await createClient();
  try {
    const schedule = getEnrollmentSchedule(enrollment);

    if (!schedule.day || !schedule.startTime || !schedule.endTime) {
      throw new Error("Please add an enrollment schedule");
    }

    if (enrollment.student?.id && enrollment.tutor?.id) {
      await assertNoDuplicateEnrollment(
        supabase,
        {
          studentId: enrollment.student.id,
          tutorId: enrollment.tutor.id,
          day: schedule.day,
          startTime: schedule.startTime,
        },
        enrollment.id,
      );
    }

    if (enrollment.meetingId) {
      await assertRoomFreeForEnrollment(
        {
          meetingId: enrollment.meetingId,
          day: schedule.day,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        },
        enrollment.id,
      );
    }

    enrollment.duration = await handleCalculateDuration(schedule.startTime, schedule.endTime);

    const { data: updateEnrollmentData, error: updateEnrollmentError } = await supabase
      .from(Table.Enrollments)
      .update({
        student_id: enrollment.student?.id,
        tutor_id: enrollment.tutor?.id,
        summary: enrollment.summary,
        start_date: enrollment.startDate,
        end_date: enrollment.endDate,
        day: schedule.day,
        start_time: schedule.startTime,
        end_time: schedule.endTime,
        meetingId: enrollment.meetingId,
        duration: enrollment.duration,
        frequency: enrollment.frequency,
      })
      .eq("id", enrollment.id)
      .select("*")
      .single();

    if (updateEnrollmentError) {
      console.error("Error updating enrollment: ", updateEnrollmentError);
      await logError(
        updateEnrollmentError,
        { function: "updateEnrollment", enrollment_id: enrollment.id },
        "enrollment_error",
      );
      throw duplicateSlotError(updateEnrollmentError);
    }

    await updateFutureSessions(enrollment);
    return updateEnrollmentData;
  } catch (error) {
    console.error("Unable to update Enrollment", error);
    await logError(
      error,
      { function: "updateEnrollment", enrollment_id: enrollment.id },
      "enrollment_error",
    );
    throw error;
  }
};

const updateFutureSessions = async (enrollment: Enrollment) => {
  const now = new Date().toISOString();
  const supabase = await createAdminClient();

  const schedule = getEnrollmentSchedule(enrollment);
  if (!schedule.day || !schedule.startTime) {
    throw new Error("Please add an enrollment schedule");
  }

  const { data: futureSessions, error: fetchError } = await supabase
    .from(Table.Sessions)
    .select("id, date")
    .eq("enrollment_id", enrollment.id)
    .gte("date", now)
    .not("status", "in", '(Cancelled,Rescheduled,"Student Did Not Attend")');

  if (fetchError) throw fetchError;
  if (!futureSessions || futureSessions.length === 0) return;

  const rows = futureSessions
    .filter((session): session is { id: string; date: string } => Boolean(session.date))
    .map((session) => ({
      id: session.id,
      student_id: enrollment.student?.id,
      tutor_id: enrollment.tutor?.id,
      meeting_id: enrollment.meetingId,
      duration: enrollment.duration,
      date: computeSessionDateForSchedule(session.date, schedule.day!, schedule.startTime!),
    }));

  const { error: updateError } = await supabase.from(Table.Sessions).upsert(rows);
  if (updateError) throw updateError;
};

/**
 * Distinct America/New_York weeks that have an Unconfirmed session. The thresholds are in
 * weeks, so a moved or duplicated session in the same week must not count twice.
 */
const countMissedWeeks = (sessions: { date: string | null }[]) =>
  new Set(
    sessions
      .filter((session) => session.date)
      .map((session) => getEasternWeekBounds(new Date(session.date!)).weekStart.toISOString()),
  ).size;

export const getEnrollmentsWithMissingSEF = async (timeProvided: Date, weeksMissingSEF: number) => {
  const supabase = await createAdminClient();
  try {
    const now = new Date().toISOString();
    const { data: enrollments } = await supabase
      .from("Enrollments")
      .select(
        `
        id,
        sessions:Sessions!enrollment_id!inner(
          id,
          date,
          status
        )
        `,
      )
      // Unconfirmed is exactly "the tutor never submitted an exit form", so it is the only
      // status that counts toward inactivity. Cancelled means the session was called off
      // deliberately and must not push an enrollment toward deletion.
      .in("sessions.status", ["Unconfirmed"])
      .gte("sessions.date", timeProvided.toISOString())
      .lte("sessions.date", now)
      .throwOnError();

    const enrollmentsWithTwoMissingSessions = enrollments.filter(
      (enrollment) => countMissedWeeks(enrollment.sessions) >= weeksMissingSEF,
    );

    return enrollmentsWithTwoMissingSessions;
  } catch (error) {
    console.error("Unable to filter ", error);
    await logError(
      error,
      { function: "getEnrollmentsWithMissingSEF", weeks_missing_sef: weeksMissingSEF },
      "enrollment_error",
    );
    throw error;
  }
};

export const getTutorEnrollmentsMissingSEF = async (
  tutorId: string,
  weeksMissingSEF: number = 3,
) => {
  await requireTutorProfileAccess(tutorId);
  const supabase = await createAdminClient();
  const deadline = subWeeks(new Date(), weeksMissingSEF);
  try {
    const now = new Date().toISOString();
    const { data: enrollments } = await supabase
      .from("Enrollments")
      .select(
        `
        id,
        student:Profiles!student_id(first_name, last_name),
        sessions:Sessions!enrollment_id!inner(
          id,
          date,
          status
        )
        `,
      )
      .eq("tutor_id", tutorId)
      .in("sessions.status", ["Unconfirmed"])
      .gte("sessions.date", deadline.toISOString())
      .lte("sessions.date", now)
      .throwOnError();

    return (enrollments ?? []).filter(
      (enrollment) => countMissedWeeks(enrollment.sessions) >= weeksMissingSEF,
    );
  } catch (error) {
    await logError(
      error,
      { function: "getTutorEnrollmentsMissingSEF", tutorId, weeks_missing_sef: weeksMissingSEF },
      "enrollment_error",
    );
    throw error;
  }
};

export const addEnrollment = async (
  enrollment: Omit<Enrollment, "id" | "createdAt">,
  sendEmail?: boolean,
) => {
  const tutorId = enrollment.tutor?.id;
  const auth = tutorId
    ? await requireTutorProfileAccess(tutorId)
    : await requireAuthenticatedProfile();
  const enrollmentTutorId = tutorId || (auth.profile.role === "Tutor" ? auth.profile.id : "");

  if (!enrollmentTutorId) throw new Error("Please select a Tutor");

  const supabase = await createClient();
  try {
    const schedule = getEnrollmentSchedule(enrollment);

    if (!schedule.day || !schedule.startTime || !schedule.endTime) {
      throw new Error("Please add an enrollment schedule");
    }

    const duration = await handleCalculateDuration(schedule.startTime, schedule.endTime);

    const studentId = enrollment.student?.id;
    if (!studentId) {
      throw new Error("Student ID is required to create an enrollment");
    }

    await assertNoDuplicateEnrollment(supabase, {
      studentId,
      tutorId: enrollmentTutorId,
      day: schedule.day,
      startTime: schedule.startTime,
    });

    if (enrollment.duration <= 0) throw new Error("Duration should be a positive amount");

    if (!enrollment.student) throw new Error("Please select a Student");

    if (enrollment.meetingId && !isValidUUID(enrollment.meetingId)) {
      throw new Error("Invalid or no meeting link");
    }

    if (enrollment.meetingId) {
      await assertRoomFreeForEnrollment({
        meetingId: enrollment.meetingId,
        day: schedule.day,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      });
    }

    const { data, error } = await supabase
      .from(Table.Enrollments)
      .insert({
        student_id: enrollment.student?.id,
        tutor_id: enrollmentTutorId,
        summary: enrollment.summary,
        start_date: enrollment.startDate,
        end_date: enrollment.endDate,
        day: schedule.day,
        start_time: schedule.startTime,
        end_time: schedule.endTime,
        meetingId: enrollment.meetingId,
        duration: duration, //default
        frequency: enrollment.frequency,
      })
      .select(
        `*,
        student:Profiles!student_id(*),
        tutor:Profiles!tutor_id(*),
        meeting:Meetings!meetingId(*)
        `,
      )
      .single();

    if (error) {
      console.error("Error adding enrollment:", error);
      await logError(
        error,
        {
          function: "addEnrollment",
          tutor_id: enrollmentTutorId,
          student_id: enrollment.student?.id,
        },
        "enrollment_error",
      );
      throw duplicateSlotError(error);
    }

    if (data) {
      const tutor = tableToInterfaceProfiles(data.tutor);
      const student = tableToInterfaceProfiles(data.student);
      const meeting = tableToInterfaceMeetings(data.meeting);
      const date = await sessionTimeFromEnrollment(
        schedule,
        data.start_date ?? enrollment.startDate,
      );

      const firstSession: Session = {
        id: "",
        enrollmentId: data.id,
        createdAt: new Date().toISOString(),
        date: date,
        summary: data.summary ?? enrollment.summary,
        student: student,
        tutor: tutor,
        meeting: meeting,
        status: (enrollment as any).status || "Active",
        session_exit_form: "",
        isQuestionOrConcern: false,
        isFirstSession: true,
        isStandalone: false,
        duration: data.duration,
      };

      await addStandaloneSession(firstSession, sendEmail, {
        meeting: meeting,
        tutor: tutor,
        student: student,
      });
    }

    return tableToInterfaceEnrollments(data);
  } catch (error) {
    throw error;
  }
};

export const sessionTimeFromEnrollment = async (
  schedule: Availability,
  start: string,
): Promise<string> => {
  const dayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  try {
    const startDate: Date = new Date(start);
    const startDateWeekDay: number = startDate.getDay();
    const firstSessionWeekDay: number = dayMap[schedule.day.toLowerCase()];

    const additionalDays = firstSessionWeekDay >= startDateWeekDay ? 0 : 7;
    const currentDate: Date = addDays(
      startDate,
      firstSessionWeekDay - startDateWeekDay + additionalDays,
    );
    const dateString = `${format(currentDate, "yyyy-MM-dd")}T${schedule.startTime}:00`;
    return fromZonedTime(dateString, "America/New_York").toISOString();
  } catch (error) {
    console.error("Unable to calculate session from enrollment");
    await logError(
      error,
      { function: "sessionTimeFromEnrollment", day: schedule.day, start },
      "enrollment_error",
    );
    throw error;
  }
};

export async function deleteInactiveEnrollments() {
  const fiveWeeksAgo = subWeeks(new Date(), 5);

  const enrollments = await inactiveEnrollmentsHelper({
    deadline: fiveWeeksAgo,
    weeksMissing: 5,
    emailFn: sendDeleteEnrollmentEmail,
  });

  if (enrollments.length === 0) {
    return { success: true, error: undefined, deleted: 0 };
  }

  const enrollmentIds = enrollments.map((e) => e.id);
  const supabase = await createAdminClient();

  try {
    await removeFutureSessions(enrollmentIds, supabase);
  } catch (error) {
    return { success: false, error: (error as Error).message, deleted: 0 };
  }

  const { error: deleteError } = await supabase
    .from(Table.Enrollments)
    .delete()
    .in("id", enrollmentIds);

  if (deleteError) {
    return { success: false, error: deleteError.message, deleted: 0 };
  }

  const tutors = new Map<string, Profile>();
  enrollments.forEach((e) => {
    if (e.tutor) tutors.set(e.tutor.id, e.tutor);
  });

  await Promise.all(
    Array.from(tutors.values()).map(async (tutor) => {
      try {
        await sendTutorProbationEmail(
          tutor,
          "not submitted Session Exit Forms (SEFs) for 5 consecutive weeks, resulting in the deactivation of your enrollment",
        );
      } catch (error) {
        await logError(
          error,
          { function: "deleteInactiveEnrollments", tutorId: tutor.id },
          "enrollment_error",
        );
      }
    }),
  );

  return { success: true, error: undefined, deleted: enrollmentIds.length };
}

export async function warnInactiveEnrollments() {
  const fourWeeksAgo = subWeeks(new Date(), 4);
  return await inactiveEnrollmentsHelper({
    deadline: fourWeeksAgo,
    weeksMissing: 4,
    emailFn: sendInactiveEnrollmentWarning,
    claimWarning: true,
  });
}

export async function warnInactiveEnrollmentsEarly() {
  const threeWeeksAgo = subWeeks(new Date(), 3);
  return await inactiveEnrollmentsHelper({
    deadline: threeWeeksAgo,
    weeksMissing: 3,
    emailFn: sendInactiveEnrollmentEarlyWarning,
    claimWarning: true,
  });
}

// Short of the week between the 3-week and 4-week warnings, so both still go out once
// each, with a day of slack for cron timing.
const INACTIVITY_WARNING_COOLDOWN_DAYS = 6;

/**
 * Stamps inactivity_warning_sent_at on the enrollments not warned within the cooldown and
 * returns only those ids. The conditional UPDATE is the claim, so overlapping or retried
 * cron runs cannot both email the same tutor.
 */
async function claimInactivityWarnings(enrollmentIds: string[], supabase: any): Promise<string[]> {
  const now = new Date();
  const stamp = now.toISOString();
  const cooldownStart = subDays(now, INACTIVITY_WARNING_COOLDOWN_DAYS).toISOString();

  // No .select() here: PostgREST re-applies .or() filters to the returned rows, which
  // would drop every row this UPDATE just stamped. Read the claim back by its stamp instead.
  await supabase
    .from(Table.Enrollments)
    .update({ inactivity_warning_sent_at: stamp })
    .in("id", enrollmentIds)
    .or(`inactivity_warning_sent_at.is.null,inactivity_warning_sent_at.lt.${cooldownStart}`)
    .throwOnError();

  const { data } = await supabase
    .from(Table.Enrollments)
    .select("id")
    .in("id", enrollmentIds)
    .eq("inactivity_warning_sent_at", stamp)
    .throwOnError();

  return (data ?? []).map((row: { id: string }) => row.id);
}

async function inactiveEnrollmentsHelper(params: {
  deadline: Date;
  weeksMissing: number;
  emailFn: (params: { tutor: Profile; student: Profile; enrollment: Enrollment }) => Promise<void>;
  // Warnings are throttled per enrollment; the deletion notice is not.
  claimWarning?: boolean;
}) {
  const supabase = await createAdminClient();
  const { deadline, weeksMissing, emailFn, claimWarning = false } = params;
  const targetEnrollments = await getEnrollmentsWithMissingSEF(deadline, weeksMissing);

  if (!targetEnrollments || targetEnrollments.length === 0) {
    return [];
  }

  let enrollmentIds = targetEnrollments.map((e) => e.id);

  if (claimWarning) {
    enrollmentIds = await claimInactivityWarnings(enrollmentIds, supabase);
    if (enrollmentIds.length === 0) return [];
  }

  const { data } = await supabase
    .from(Table.Enrollments)
    .select(
      `
        id,
        created_at,
        summary,
        student_id,
        tutor_id,
        start_date,
        end_date,
        day,
        start_time,
        end_time,
        meetingId,
        paused,
        duration,
        student:Profiles!student_id(*),
        tutor:Profiles!tutor_id(*)
    `,
    )
    .in("id", enrollmentIds)
    .throwOnError();

  const enrollments: Enrollment[] =
    data?.map((enrollment: any) => tableToInterfaceEnrollments(enrollment)) ?? [];

  await Promise.all(
    enrollments
      .filter((enrollment) => enrollment.tutor && enrollment.student)
      .map(async (enrollment) => {
        try {
          await emailFn({
            tutor: enrollment.tutor!,
            student: enrollment.student!,
            enrollment: enrollment,
          });
        } catch (error) {
          // Release the claim so the next nightly run retries this warning.
          if (claimWarning) {
            await supabase
              .from(Table.Enrollments)
              .update({ inactivity_warning_sent_at: null })
              .eq("id", enrollment.id);
          }
          throw error;
        }
      }),
  );
  return enrollments;
}

export async function sendInactiveEnrollmentWarning(params: {
  tutor: Profile;
  student: Profile;
  enrollment: Enrollment;
}) {
  await sendEmailHelper(params, InactiveEnrollmentWarning);
}

export async function sendInactiveEnrollmentEarlyWarning(params: {
  tutor: Profile;
  student: Profile;
  enrollment: Enrollment;
}) {
  await sendEmailHelper(params, InactiveEnrollmentEarlyWarning);
}

export async function sendDeleteEnrollmentEmail(params: {
  tutor: Profile;
  student: Profile;
  enrollment: Enrollment;
}) {
  await sendEmailHelper(params, InactiveEnrollmentDeletion);
}

async function sendTutorProbationEmail(tutor: Profile, reason: string) {
  await sendMail({
    from: "Connect Me Free Tutoring & mentoring <reminder@connectmego.app>",
    to: tutor.email,
    cc: [process.env.OPERATIONS_EMAIL!],
    // Sent from an unmonitored address; route replies to operations.
    replyTo: process.env.OPERATIONS_EMAIL!,
    subject: "Connect Me Membership Status: Probation",
    react: TutorProbationEmail({ tutor, reason }),
  });
}

async function sendEmailHelper(
  params: {
    tutor: Profile;
    student: Profile;
    enrollment: Enrollment;
  },
  msgTemplate: (params: { tutor: Profile; student: Profile; enrollment: Enrollment }) => string,
) {
  const { tutor } = params;
  const { error } = await sendMail({
    from: "Connect Me Free Tutoring & mentoring <reminder@connectmego.app>",
    to: tutor.email,
    cc: [process.env.OPERATIONS_EMAIL!],
    // Sent from an unmonitored address; route replies to operations.
    replyTo: process.env.OPERATIONS_EMAIL!,
    subject: "Inactivating Connect Me Enrollment",
    html: msgTemplate(params),
  });
  // Resend reports failures in the result rather than throwing; surface them so a
  // claimed warning is released and retried instead of silently skipped.
  if (error) throw error;
}
