"use server";
import { Availability, Enrollment, Profile, Session } from "@/types";
import { createAdminClient, createClient } from "../supabase/server";
import { Table } from "../supabase/tables";
import {
  tableToInterfaceEnrollments,
  tableToInterfaceMeetings,
  tableToInterfaceProfiles,
} from "../type-utils";
import { cache } from "react";
import { handleCalculateDuration, isValidUUID } from "../utils";
import { addDays, format, subWeeks } from "date-fns";
import { addOneSession } from "./session.server.actions";
import { getMeeting } from "./meeting.server.actions";
import { fromZonedTime } from "date-fns-tz";
import { Resend } from "resend";
import RescheduleConfirmationEmail from "@/components/emails/inactve-enrollment-warning";

/* ENROLLMENTS */
export async function getAllActiveEnrollmentsServer(
  endOfWeek: string,
): Promise<Enrollment[]> {
  try {
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
        availability,
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
      throw error;
    }

    // Check if data exists
    if (!data) {
      throw new Error("No data fetched");
    }

    // Mapping the fetched data to the Notification object
    const enrollments: Enrollment[] = data.map((enrollment: any) => ({
      createdAt: enrollment.created_at,
      id: enrollment.id,
      summary: enrollment.summary,
      student: enrollment.student,
      tutor: enrollment.tutor,
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
    console.error("Error getting needed enrollment information:", error);
    throw error;
  }
}

export async function getAllEnrollments(): Promise<Enrollment[] | null> {
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

export async function getAllActiveEnrollments(
  endOfWeek?: string,
): Promise<Enrollment[]> {
  try {
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
        availability,
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
      throw error;
    }

    // Check if data exists
    if (!data) {
      throw new Error("No data fetched");
    }

    // Mapping the fetched data to the Notification object
    const enrollments: Enrollment[] = data.map((enrollment: any) => ({
      createdAt: enrollment.created_at,
      id: enrollment.id,
      summary: enrollment.summary,
      student: enrollment.student,
      tutor: enrollment.tutor,
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
    console.error("Error getting needed enrollment information:", error);
    throw error;
  }
}

export async function getEnrollments(
  tutorId: string,
): Promise<Enrollment[] | null> {
  try {
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
        availability,
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
      return null; // Returning null here is valid since the function returns Promise<Notification[] | null>
    }

    // Check if data exists

    // Mapping the fetched data to the Notification object
    const enrollments: Enrollment[] = data.map((enrollment: any) => ({
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

export const cachedGetEnrollments = cache(getEnrollments);

// added this in order to remove future sessions on the SCHEDULE after an enrollment is deleted.
export const removeFutureSessions = async (
  enrollmentId: string,
  supabase: any,
) => {
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
    throw error;
  }
};
// before, it used createClient() which respects Supabase RLS
// now tho it uses createAdminCLient() to bypass RLS and guarentee deletion succeeds
export const removeEnrollment = async (enrollmentId: string) => {
  const adminSupabase = await createAdminClient();
  await removeFutureSessions(enrollmentId, adminSupabase);

  const supabase = await createClient();

  const { data: deleteEnrollmentData, error: deleteEnrollmentError } =
    await supabase.from("Enrollments").delete().eq("id", enrollmentId);

  if (deleteEnrollmentError) {
    console.error("Error removing enrollment:", deleteEnrollmentError);
    throw deleteEnrollmentError;
  }
};

export const updateEnrollment = async (enrollment: Enrollment) => {
  const supabase = await createClient();
  try {
    const now = new Date().toISOString();

    const duration = await handleCalculateDuration(
      enrollment.availability[0].startTime,
      enrollment.availability[0].endTime,
    );

    const { data: updateEnrollmentData, error: updateEnrollmentError } =
      await supabase
        .from(Table.Enrollments)
        .update({
          student_id: enrollment.student?.id,
          tutor_id: enrollment.tutor?.id,
          summary: enrollment.summary,
          start_date: enrollment.startDate,
          end_date: enrollment.endDate,
          availability: enrollment.availability,
          meetingId: enrollment.meetingId,
          duration: duration,
          frequency: enrollment.frequency,
        })
        .eq("id", enrollment.id)
        .select("*") // Ensure it selects all columns
        .single(); // Ensure only one object is returned

    if (updateEnrollmentError) {
      console.error("Error updating enrollment: ", updateEnrollmentError);
      throw updateEnrollmentError;
    }

    // update related sessions
    if (enrollment.student && enrollment.tutor) {
      const { data: updateSessionData, error: updateSessionError } =
        await supabase
          .from(Table.Sessions)
          .update({
            student_id: enrollment.student?.id,
            tutor_id: enrollment.tutor?.id,
            meeting_id: enrollment.meetingId,
          })
          .eq("enrollment_id", enrollment.id)
          .gte("date", now);

      if (updateSessionError) {
        console.error("Error updating sessions: ", updateSessionError);
        throw updateSessionError;
      }
    }

    //remove future sessions
    const adminSupabase = await createAdminClient();
    await removeFutureSessions(enrollment.id, adminSupabase);

    return updateEnrollmentData;
  } catch (error) {
    console.error("Unable to update Enrollment", error);
    throw error;
  }
};

export const getEnrollmentsWithMissingSEF = async (
  timeProvided: Date,
  weeksMissingSEF: number,
) => {
  const supabase = await createClient();
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
      .eq("sessions.status", "Active")
      .gte("sessions.date", timeProvided)
      .lte("sessions.date", now)
      .throwOnError();

    const enrollmentsWithTwoMissingSessions = enrollments.filter(
      (enrollment) => enrollment.sessions.length >= weeksMissingSEF,
    );

    return enrollmentsWithTwoMissingSessions;
  } catch (error) {
    console.error("Unable to filter ", error);
    throw error;
  }
};

export const addEnrollment = async (
  enrollment: Omit<Enrollment, "id" | "createdAt">,
  sendEmail?: boolean,
) => {
  const supabase = await createClient();
  try {
    if (enrollment.availability.length == 0) {
      throw new Error("Please add an availability");
    }

    const duration = await handleCalculateDuration(
      enrollment.availability[0].startTime,
      enrollment.availability[0].endTime,
    );

    if (enrollment.duration <= 0)
      throw new Error("Duration should be a positive amount");

    if (!enrollment.student) throw new Error("Please select a Student");

    if (enrollment.meetingId && !isValidUUID(enrollment.meetingId)) {
      throw new Error("Invalid or no meeting link");
    }

    const { data, error } = await supabase
      .from(Table.Enrollments)
      .insert({
        student_id: enrollment.student?.id,
        tutor_id: enrollment.tutor?.id,
        summary: enrollment.summary,
        start_date: enrollment.startDate,
        end_date: enrollment.endDate,
        availability: enrollment.availability,
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
      throw error;
    }

    if (data) {
      const tutor = tableToInterfaceProfiles(data.tutor);
      const student = tableToInterfaceProfiles(data.student);
      const meeting = tableToInterfaceMeetings(data.meeting);
      const date = await sessionTimeFromEnrollment(
        data.availability[0],
        data.start_date,
      );

      const firstSession: Session = {
        id: "",
        enrollmentId: data.id,
        createdAt: new Date().toISOString(),
        date: date,
        summary: data.summary,
        student: student,
        tutor: tutor,
        meeting: meeting,
        status: (enrollment as any).status || "Active",
        session_exit_form: "",
        isQuestionOrConcern: false,
        isFirstSession: true,
        duration: data.duration,
        environment: (enrollment as any).environment || "Virtual",
      };

      await addOneSession(firstSession, sendEmail, {
        meeting: meeting,
        tutor: tutor,
        student: student,
      });
    }

    return {
      createdAt: data.created_at,
      id: data.id,
      summary: data.summary,
      student: tableToInterfaceProfiles(data.student),
      tutor: tableToInterfaceProfiles(data.tutor),
      startDate: data.start_date,
      endDate: data.end_date,
      availability: data.availability,
      meetingId: data.meetingId,
      duration: data.duration,
      frequency: data.frequency,
    };
  } catch (error) {
    throw error;
  }
};

export const sessionTimeFromEnrollment = (
  availability: Availability,
  start: string,
): string => {
  console.log(availability);
  console.log(start);

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
    console.log("Start Date", startDate);
    const startDateWeekDay: number = startDate.getDay();
    const firstSessionWeekDay: number = dayMap[availability.day.toLowerCase()];

    console.log("Start Date Week Day", startDate.getUTCDay());
    console.log("First session week day", firstSessionWeekDay);
    const additionalDays = firstSessionWeekDay >= startDateWeekDay ? 0 : 7;
    const currentDate: Date = addDays(
      startDate,
      firstSessionWeekDay - startDateWeekDay + additionalDays,
    );
    const dateString = `${format(currentDate, "yyyy-MM-dd")}T${availability.startTime}:00`;
    return fromZonedTime(dateString, "America/New_York").toISOString();
  } catch (error) {
    console.error("Unable to calculate session from enrollment");
    throw error;
  }
};

export async function deleteInactiveEnrollments() {
  const supabase = await createClient();
  const fourWeeksAgo = subWeeks(new Date(), 4);

  const targetEnrollments = await getEnrollmentsWithMissingSEF(fourWeeksAgo, 4);

  if (!targetEnrollments || targetEnrollments.length === 0) {
    return { success: true, error: undefined, deleted: 0 };
  }

  const enrollmentIds = targetEnrollments.map((e) => e.id);

  const { error: deleteError } = await supabase
    .from("Enrollments")
    .delete()
    .in("id", enrollmentIds);

  if (deleteError) {
    return { success: false, error: deleteError.message, deleted: 0 };
  }

  return { success: true, error: undefined, deleted: enrollmentIds.length };
}

export async function warnInactiveEnrollments() {
  const supabase = await createClient();
  const threeWeeksAgo = subWeeks(new Date(), 3);
  const targetEnrollments = await getEnrollmentsWithMissingSEF(
    threeWeeksAgo,
    3,
  );

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
        availability,
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
    data?.map((enrollment: any) => tableToInterfaceEnrollments(enrollment)) ??
    [];

  await Promise.all(
    enrollments
      .filter((enrollment) => enrollment.tutor && enrollment.student)
      .map((enrollment) =>
        sendInactiveEnrollmentWarning({
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
  try {
    const { tutor, student, enrollment } = params;
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "Connect Me Free Tutoring & Mentoring <reminder@connectmego.app>",
      to: tutor.email,
      subject: "Connect Me Inactive Enrollment",
      html: RescheduleConfirmationEmail(params),
    });
  } catch (error) {
    throw error;
  }
}
