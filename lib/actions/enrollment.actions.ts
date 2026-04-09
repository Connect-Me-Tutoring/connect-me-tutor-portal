"use client";
// lib/student.actions.ts
import { supabase } from "@/lib/supabase/client";
import { Enrollment, Availability } from "@/types";
import { Table } from "../supabase/tables";
import { tableToInterfaceProfiles } from "../type-utils";
import { SharedEnrollment } from "@/types/enrollment";

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

export async function getAccountEnrollments(
  userId: string,
): Promise<SharedEnrollment[] | null> {
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

  return (data as SharedEnrollment[]) ?? [];
}

// export async function getAccountEnrollmentsClient(
//   userId: string,
// ): Promise<SharedEnrollment[] | null> {
//   const { data: profile, error: profileError } = await supabase
//     .from("Profiles")
//     .select("id")
//     .eq("user_id", userId)
//     .single();

//   if (profileError || !profile) {
//     console.error("Error fetching profile:", profileError);
//     return null;
//   }

//   const { data, error } = await supabase
//     .from("Enrollments")
//     .select(
//       `
//       id,
//       created_at,
//       summary,
//       start_date,
//       end_date,
//       availability,
//       meetingId,
//       summer_paused,
//       duration,
//       student:Profiles!student_id(id, user_id, first_name, last_name, email),
//       tutor:Profiles!tutor_id(id, user_id, first_name, last_name, email)
//     `,
//     )
//     .or(`student_id.eq.${profile.id},tutor_id.eq.${profile.id}`)
//     .order("created_at", { ascending: false });

//   if (error) {
//     console.error("Error fetching enrollments:", error);
//     return null;
//   }

//   return (data as SharedEnrollment[]) ?? [];/
// }
