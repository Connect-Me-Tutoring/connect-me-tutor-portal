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
import { addDays, format, subWeeks } from "date-fns";
import { addStandaloneSession } from "../session/server.actions";
import { getMeeting } from "../meeting/server.actions";
import { fromZonedTime } from "date-fns-tz";
import { Resend } from "resend";
import InactiveEnrollmentWarning from "@/components/emails/enrollments/inactve-enrollment-warning";
import InactiveEnrollmentDeletion from "@/components/emails/enrollments/inactive-enrollment-deletion";
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

// added this in order to remove future sessions on the SCHEDULE after an enrollment is deleted.
export const removeFutureSessions = async (enrollmentId: string, supabase: any) => {
  try {
    const now: string = new Date().toISOString();
    await supabase
      .from(Table.Sessions)
      .delete()
      .eq("enrollment_id", enrollmentId)
      .neq("status", "Complete")
      .gte("date", now)
      .throwOnError();
  } catch (error) {
    console.error("Unable to remove future sessions", error);
    await logError(
      error,
      { function: "removeFutureSessions", enrollment_id: enrollmentId },
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

export const updateEnrollment = async (enrollment: Enrollment) => {
  await requireEnrollmentAccess(enrollment.id);
  const supabase = await createClient();
  try {
    const schedule = getEnrollmentSchedule(enrollment);

    if (!schedule.day || !schedule.startTime || !schedule.endTime) {
      throw new Error("Please add an enrollment schedule");
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
      throw updateEnrollmentError;
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
  const { error } = await supabase
    .from("Sessions")
    .update({
      student_id: enrollment.student?.id,
      tutor_id: enrollment.tutor?.id,
      meeting_id: enrollment.meetingId,
      duration: enrollment.duration,
    })
    .eq("enrollment_id", enrollment.id)
    .gte("date", now);
  if (error) throw error;
};

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
      .in("sessions.status", ["Active", "Cancelled"])
      .gte("sessions.date", timeProvided.toISOString())
      .lte("sessions.date", now)
      .throwOnError();

    const enrollmentsWithTwoMissingSessions = enrollments.filter(
      (enrollment) => enrollment.sessions.length >= weeksMissingSEF,
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

    if (enrollment.duration <= 0) throw new Error("Duration should be a positive amount");

    if (!enrollment.student) throw new Error("Please select a Student");

    if (enrollment.meetingId && !isValidUUID(enrollment.meetingId)) {
      throw new Error("Invalid or no meeting link");
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
      throw error;
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
  const sixWeeksAgo = subWeeks(new Date(), 6);

  const enrollments = await inactiveEnrollmentsHelper({
    deadline: sixWeeksAgo,
    weeksMissing: 6,
    emailFn: sendDeleteEnrollmentEmail,
  });

  if (enrollments.length === 0) {
    return { success: true, error: undefined, deleted: 0 };
  }

  const enrollmentIds = enrollments.map((e) => e.id);
  const supabase = await createAdminClient();

  const { error: deleteError } = await supabase
    .from(Table.Enrollments)
    .delete()
    .in("id", enrollmentIds);

  if (deleteError) {
    return { success: false, error: deleteError.message, deleted: 0 };
  }

  return { success: true, error: undefined, deleted: enrollmentIds.length };
}

export async function warnInactiveEnrollments() {
  const fiveWeeksAgo = subWeeks(new Date(), 5);
  return await inactiveEnrollmentsHelper({
    deadline: fiveWeeksAgo,
    weeksMissing: 5,
    emailFn: sendInactiveEnrollmentWarning,
  });
}

async function inactiveEnrollmentsHelper(params: {
  deadline: Date;
  weeksMissing: number;
  emailFn: (params: { tutor: Profile; student: Profile; enrollment: Enrollment }) => Promise<void>;
}) {
  const supabase = await createAdminClient();
  const { deadline, weeksMissing, emailFn } = params;
  const targetEnrollments = await getEnrollmentsWithMissingSEF(deadline, weeksMissing);

  if (!targetEnrollments || targetEnrollments.length === 0) {
    return [];
  }

  const enrollmentIds = targetEnrollments.map((e) => e.id);

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
      .map((enrollment) =>
        emailFn({
          tutor: enrollment.tutor!,
          student: enrollment.student!,
          enrollment: enrollment,
        }),
      ),
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

export async function sendDeleteEnrollmentEmail(params: {
  tutor: Profile;
  student: Profile;
  enrollment: Enrollment;
}) {
  await sendEmailHelper(params, InactiveEnrollmentDeletion);
}

async function sendEmailHelper(
  params: {
    tutor: Profile;
    student: Profile;
    enrollment: Enrollment;
  },
  msgTemplate: (params: { tutor: Profile; student: Profile; enrollment: Enrollment }) => string,
) {
  try {
    const { tutor } = params;
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "Connect Me Free Tutoring & mentoring <reminder@connectmego.app>",
      to: tutor.email,
      cc: [process.env.OPERATIONS_EMAIL!],
      subject: "Inactivating Connect Me Enrollment",
      html: msgTemplate(params),
    });
  } catch (error) {
    throw error;
  }
}
