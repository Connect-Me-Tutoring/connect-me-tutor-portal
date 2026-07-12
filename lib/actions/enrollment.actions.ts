"use client";
// lib/student.actions.ts
import { supabase } from "@/lib/supabase/client";
import { Enrollment, Availability, Session } from "@/types";
import { Table } from "../supabase/tables";
import { tableToInterfaceProfiles, tableToInterfaceMeetings } from "../type-utils";
import { SharedEnrollment } from "@/types/enrollment";
import { addOneSession } from "./session.actions";
import { handleCalculateDuration, isValidUUID } from "../utils";
import { addDays, format } from "date-fns";
import { fromZonedTime } from "date-fns-tz";

export async function getEnrollments(
  tutorId: string,
): Promise<Enrollment[] | null> {
  try {
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

export const getHourInterval = async (availabilityList: Availability[]) => {
  try {
    let availabilityListHours: Availability[] = [];

    availabilityList.map((availability) => {
      availability.day;
      availability.startTime;
      availability.endTime;
    });
  } catch (error) {
    console.error("Unable to split into hours", error);
    throw error;
  }
};

export const getOverlappingAvailabilites = async (
  tutorAvailability: {
    day: string;
    startTime: string;
    endTime: string;
  }[],
  studentAvailability: {
    day: string;
    startTime: string;
    endTime: string;
  }[],
): Promise<Availability[]> => {
  try {
    const { data, error } = await supabase.rpc(
      "get_overlapping_availabilities_array",
      {
        a: tutorAvailability,
        b: studentAvailability,
      },
    );
    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Failed to get overlapping availabilities");
    throw error;
    return [];
  }
};

export async function getAllActiveEnrollments(
  endOfWeek: string,
): Promise<Enrollment[]> {
  try {
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

export async function getAccountEnrollments(userId: string) {
  const { data, error } = await supabase.rpc(
    "get_user_enrollments_with_profiles",
    {
      requestor_auth_id: userId,
    },
  );

  if (error) {
    console.error("Error fetching enrollments:", error);
    return null;
  }

  return (data as SharedEnrollment[]) || ([] as SharedEnrollment[]);
}

const sql = `
 SELECT * FROM ${Table.Enrollments} LEFT JOIN ${Table.Profiles} ON ${Table.Profiles}.user_id = some inputted ID  WHERE tutor_id = ${Table.Profiles}.id OR student_id = ${Table.Profiles}.id
 ORDER BY created_at DESC
`;

export const sessionTimeFromEnrollment = (
  availability: Availability,
  start: string,
): string => {
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
    const firstSessionWeekDay: number = dayMap[availability.day.toLowerCase()];

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

export const addEnrollment = async (
  enrollment: Omit<Enrollment, "id" | "createdAt">,
) => {
  try {
    if (enrollment.availability.length === 0) {
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
        duration: duration,
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
      const date = sessionTimeFromEnrollment(
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
        isStandalone: false,
        duration: data.duration,
      };

      await addOneSession(firstSession);
    }

    return {
      createdAt: data?.created_at,
      id: data?.id,
      summary: data?.summary,
      student: data?.student ? tableToInterfaceProfiles(data.student) : null,
      tutor: data?.tutor ? tableToInterfaceProfiles(data.tutor) : null,
      startDate: data?.start_date,
      endDate: data?.end_date,
      availability: data?.availability,
      meetingId: data?.meetingId,
      duration: data?.duration,
      frequency: data?.frequency,
    };
  } catch (error) {
    throw error;
  }
};
