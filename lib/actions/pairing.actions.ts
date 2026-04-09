"use client";

import { PairingLog, PairingRequest, SharedPairing } from "@/types/pairing";
import { createClient } from "@supabase/supabase-js";
import { getProfile, getProfileRole } from "./user.actions";
import { supabase } from "../supabase/client";
import { getAccountEnrollments, getEnrollments } from "./enrollment.actions";
import { Table } from "../supabase/tables";
import { PairingLogSchemaType } from "../pairing/types";
import { Person } from "@/types/enrollment";
import { Availability, Enrollment, Meeting, Profile } from "@/types";
import { ProfilePairingMetadata } from "@/types/profile";
import axios, { AxiosResponse } from "axios"; // Not used, can be removed
import { toast } from "react-hot-toast";
import { PairingConfirmationEmailProps } from "@/types/email";
import {
  sendStudentPairingConfirmationEmail,
  sendTutorPairingConfirmationEmail,
} from "./email.server.actions";
import { addEnrollment } from "./enrollment.server.actions";
import { getOverlappingAvailabilites } from "./enrollment.actions";
import { getSupabase } from "../supabase-server/serverClient";
import { number } from "zod";
import { getProfileWithProfileId } from "./user.actions";
import { getMeeting } from "./meeting.actions";
import { sendPairingAlertToWebhook } from "./pairing.server.actions";

export const getAllPairingRequests = async (
  profileType: "student" | "tutor",
) => {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    throw new Error("Missing Supabase environment variables");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const { data, error } = await supabase.rpc("get_all_pairing_requests", {
    p_type: profileType,
  });

  return { data: data as PairingRequest[], error };
};

export const createPairingRequest = async (userId: string, notes: string) => {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    throw new Error("Missing Supabase environment variables");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  // const [profile, enrollments] = await Promise.all([
  //   getProfile(userId),
  //   getAccountEnrollments(userId),
  // ]);

  const profile = await getProfile(userId);
  if (!profile) throw new Error("failed to validate profile role");
  const enrollments = await getEnrollments(profile.id);
  if (!enrollments) throw new Error("cannot locate account enrollments");

  const priority = enrollments.length < 1 ? 1 : 2;

  const result = await supabase.from(Table.PairingRequests).insert([
    {
      user_id: profile.id,
      type: profile.role.toLowerCase(),
      priority,
      notes,
    },
  ]);

  if (result.error) {
    console.error(result.error);
    throw result.error;
  }

  if (!result.error) {
    supabase.from("pairing_logs").insert([
      {
        type: "pairing-que-entered",
        message: `${profile.firstName} ${profile.lastName} has entered the queue.`,
        error: false,
        metadata: {
          profile_id: profile.id,
        },
      } as PairingLogSchemaType,
    ]);
  }
};

export const removePairingRequest = async (id: string) => {
  try {
    const { error } = await supabase
      .from("pairing_requests")
      .delete()
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Unable to remove pairing request", error);
    throw error;
  }
};

export const acceptStudentMatch = () => {};

export const getPairingLogs = async (
  start_time: string,
  end_time: string,
): Promise<PairingLog[]> => {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    throw new Error("Missing Supabase environment variables");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const { data: logs, error } = await supabase.rpc("get_pairing_logs", {
    start_time,
    end_time,
  });

  return logs;
};

export type IncomingPairingMatch = {
  tutor: Person & ProfilePairingMetadata;
  student: Person & ProfilePairingMetadata;
  // tutor: Profile;
  // student: Profile;
  tutor_id: string;
  pairing_match_id: string;
  created_at: string;
};

export const getIncomingPairingMatches = async (profileId: string) => {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    throw new Error("Missing Supabase environment variables");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const { data, error } = await supabase.rpc(
    "get_pairing_matches_with_profiles",
    {
      requestor: profileId,
    },
  );

  return data;
};

export const deletePairing = async (tutorId: string, studentId: string) => {
  try {
    const { data, error } = await supabase
      .from("Pairings")
      .delete()
      .eq("tutor_id", tutorId)
      .eq("student_id", studentId);

    if (error) throw error;
  } catch (error) {
    console.error("Failed to delete pairing", error);
    throw error;
  }
};

export const handleResolveQueues = () => {
  const promise = axios.post("/api/pairing");
  toast.promise(promise, {
    success: "Successfully ran pairing process",
    error: "Failed to run pairing process",
    loading: "Pairing...",
  });
};

export const findAvailableSessionTimes = async () => {
  try {
    for (let i = 0; i < 1000; ++i) {}
  } catch (error) {}
};

// Function to convert time string to minutes since midnight
function timeToMinutes(timeString: string): number {
  const [hours, minutes, seconds] = timeString.split(":").map(Number);
  return hours * 60 + minutes + seconds / 60;
}

// Function to convert minutes back to time string
function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  const seconds = Math.floor((totalMinutes % 1) * 60);

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

// Main function to get average time floored to hours with 1-hour duration
function getAverageTimeWithDuration(
  startTime: string,
  endTime: string,
  day: string,
): {
  startTime: string;
  endTime: string;
  day: string;
} {
  // Convert both times to minutes
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  // Calculate average
  const averageMinutes = (startMinutes + endMinutes) / 2;

  // Floor to nearest hour
  const flooredHour = Math.floor(averageMinutes / 60);
  const flooredStartMinutes = flooredHour * 60;

  // Add 1 hour for end time
  const flooredEndMinutes = flooredStartMinutes + 60;

  return {
    startTime: minutesToTime(flooredStartMinutes),
    endTime: minutesToTime(flooredEndMinutes),
    day: day,
  };
}

const isOverlap = (
  start1: number,
  end1: number,
  start2: number,
  end2: number,
) => {
  try {
    return start1 < end2 && start2 < end1;
  } catch (error) {
    throw error;
  }
};

export const getAvailableMeetingLink = async (
  start: string,
  end: string,
  day: string,
) => {
  try {
    // Get all enrollments since we can't easily filter JSON arrays in Supabase
    const { data: allEnrollments, error } = await supabase
      .from("Enrollments")
      .select("meetingId, availability");

    if (error) throw error;

    // Filter in JavaScript for arrays
    const availableMeetings =
      allEnrollments?.filter((enrollment) => {
        // Check if this enrollment has any availability slots for the requested day
        const daySlots = enrollment.availability.filter(
          (slot: { day: string }) => slot.day === day,
        );

        if (daySlots.length === 0) {
          // No availability for this day - consider it available
          return true;
        }

        // Check if ALL slots for this day have no overlap with requested time
        const hasConflict = daySlots.some(
          (slot: { startTime: string; endTime: string }) => {
            // Two ranges overlap if: slot.start < end AND slot.end > start
            const overlap = slot.startTime < end && slot.endTime > start;
            return overlap;
          },
        );

        // Return true if NO conflict (available)
        return !hasConflict;
      }) || [];

    return availableMeetings.length > 0 ? availableMeetings[0] : null;
  } catch (error) {
    console.error("Full error:", error);
    throw error;
  }
};

export const getAutoAvailableSessionTimes = async (
  start: string,
  end: string,
  day: string,
) => {
  try {
    let autoAvailability = null;
    let meetingId = null;

    for (let i = 0; i < 10; ++i) {
      autoAvailability = await getAverageTimeWithDuration(start, end, day);
      meetingId = await getAvailableMeetingLink(
        autoAvailability.startTime,
        autoAvailability.endTime,
        autoAvailability.day,
      );
      if (meetingId)
        return { availability: autoAvailability, meeting: meetingId };
    }
    return null;
  } catch (error) {}
};

export const getAutomaticEnrollment = async (
  tutor: Profile,
  student: Profile,
): Promise<Omit<Enrollment, "id" | "createdAt"> | null | undefined> => {
  try {
    const availabilities = await getOverlappingAvailabilites(
      tutor.availability!,
      student.availability!,
    );

    if (availabilities) {
      const firstAvailability = availabilities[0];
      if (!firstAvailability) throw new Error("No overlapping availabilities");

      const autoAvailability = await getAutoAvailableSessionTimes(
        firstAvailability.startTime,
        firstAvailability.endTime,
        firstAvailability.day,
      );

      if (!autoAvailability)
        throw new Error("Unable to automatically set availability");

      const autoEnrollment: Omit<Enrollment, "id" | "createdAt"> = {
        student: student,
        tutor: tutor,
        availability: [autoAvailability.availability],
        meetingId: autoAvailability.meeting.meetingId,
        paused: false,
        duration: 1,
        startDate: new Date().toISOString(),
        endDate: null,
        summary: "Automatically Created Enrollment",
        frequency: "weekly",
      };

      return autoEnrollment;
    } else {
      throw new Error("No overlapping availabilitites");
    }
  } catch (error) {
    console.error("Unable to set automatic enrollment");
  }
};

export const updatePairingMatchStatus = async (
  profileId: string,
  matchId: string,
  status: "accepted" | "rejected",
  enrollment: Enrollment | null = null,
) => {
  const updateResponse = await supabase
    .from("pairing_matches")
    .update({ tutor_status: status })
    .eq("id", matchId)
    .eq("tutor_id", profileId);
  if (updateResponse.error) {
  }

  let autoEnrollment: Omit<Enrollment, "id" | "createdAt"> | null | undefined =
    null;

  const { data, error } = await supabase
    .rpc("get_pairing_match", {
      match_id: matchId,
    })
    .single();

  if (error) return console.error(error);
  const pairingMatch = data as IncomingPairingMatch;
  const { student, tutor } = pairingMatch;

  if (status === "accepted") {
    const studentData: Profile | null = await getProfileWithProfileId(
      student.id,
    );
    const tutorData: Profile | null = await getProfileWithProfileId(tutor.id);

    if (!studentData) throw new Error("Unable to fetch student information");
    if (!tutorData) throw new Error("Unable to fetch tutorData");
    // create new unique student tutor pairing
    const createdPairingResult = await supabase.from("Pairings").insert([
      {
        student_id: student.id,
        tutor_id: tutor.id,
      },
    ]);

    const createdPairingError = createdPairingResult.error;
    if (createdPairingError) {
      if (createdPairingError?.code === "23505") {
        throw new Error("student - tutor pairing already exists");
      }
      console.error(createdPairingResult.error);
      throw new Error("failed to create pairings");
      return;
    }

    if (tutor.availability || student.availability) {
      autoEnrollment = await getAutomaticEnrollment(tutorData, studentData);

      if (autoEnrollment) {
        const result = await addEnrollment(autoEnrollment, true);
      } else {
        console.warn("failed to automatically create enrollment");
      }
    }

    //auto select first availability & create enrollment
    if (
      !autoEnrollment ||
      !autoEnrollment.availability ||
      autoEnrollment.availability.length <= 0
    ) {
      throw new Error("Unable to automatically find availability");
    }

    const meetingData: Meeting | null = await getMeeting(
      autoEnrollment.meetingId,
    );

    if (!meetingData) throw new Error("Unable to get meeting information");

    const emailData: PairingConfirmationEmailProps = {
      student: studentData,
      tutor: tutorData,
      startDate: autoEnrollment.startDate,
      availability: autoEnrollment.availability[0],
      meeting: meetingData,
    };

    try {
      await sendStudentPairingConfirmationEmail(emailData, studentData.email);
      await sendTutorPairingConfirmationEmail(emailData, tutorData.email);
    } catch (error) {
      //rollback if error
      await supabase
        .from("Enrollments")
        .delete()
        .eq("tutor_id", tutor.id)
        .eq("student_id", student.id);

      await supabase
        .from("Pairings")
        .delete()
        .eq("tutor_id", tutor.id)
        .eq("student_id", student.id);
    }
    // Replace the fetch with:

    const log = await supabase.from("pairing_logs").insert([
      {
        type: "pairing-match-accepted",
        message: `${tutor.first_name} ${tutor.last_name} has accepted ${student.first_name} ${student.last_name} as a student`,
        error: false,
        metadata: {
          profile_id: profileId,
        },
      } as PairingLogSchemaType,
    ]);

    await sendPairingAlertToWebhook(tutorData, studentData, autoEnrollment);
  }
  //reset tutor and student status to be auto placed in que
  else if (status === "rejected") {
    const { data, error } = await supabase
      .from("pairing_requests")
      .update({
        status: "pending",
      })
      .in("user_id", [student.id, tutor.id]);

    if (error) throw error;

    const { error: deleteMatchError } = await supabase
      .from("pairing_matches")
      .delete()
      .eq("id", matchId);

    if (deleteMatchError) throw deleteMatchError;

    await supabase.from("pairing_logs").insert([
      {
        type: "pairing-match-rejected",
        message: `${tutor.first_name} ${tutor.last_name} has declined ${student.first_name} ${student.last_name} as a student`,
        error: false,
        metadata: {
          profile_id: profileId,
        },
      } as PairingLogSchemaType,
    ]);
  }
};

// if (availabilities) {
//         const firstAvailability = availabilities[0];
//         if (!firstAvailability) return;

//         const startDate = "";
//         const endDate = "";

//         //auto select first availability & create enrollment
//         await addEnrollment(
//           {
//             student: student as unknown as Profile,
//             tutor: tutor as unknown as Profile,
//             availability: availabilities,
//             meetingId: "",
//             summerPaused: false,
//             duration: 60,
//             startDate,
//             endDate,
//             summary: "Automatically Created Enrollment",
//           },
//           true
//         );
//       }
//     } else {
//       console.warn("failed to automatically create enrollment");
//     }

//     const createdPairingError = createdPairingResult.error;
//     if (createdPairingError) {
//       if (createdPairingError?.code === "23505") {
//         throw new Error("student - tutor pairing already exists");
//       }
//       console.error(createdPairingResult.error);
//       throw new Error("failed to create pairings");
//     }

//     const emailData = {
//       studentName: `${student.first_name} ${student.last_name}`,
//       studentGender: student.gender ?? "male",
//       parentName: `Parent Name`,
//     } as TutorMatchingNotificationEmailProps;

//     //send respective pairing email to student and tutor
//     await axios.post(
//       "http://localhost:3000/api/email/pairing?type=match-accepted",
//       {
//         emailType: "match-accepted",
//         data: emailData,
//       }
//     );

//     const log = await supabase.from("pairing_logs").insert([
//       {
//         type: "pairing-match-accepted",
//         message: `${tutor.first_name} ${tutor.last_name} has accepted ${student.first_name} ${student.last_name} as a student`,
//         error: false,
//         metadata: {
//           profile_id: profileId,
//         },
//       } as PairingLogSchemaType,
//     ]);

//     console.log("LOG ", log);

//     //reset tutor and student status to be auto placed in que
//   } else if (status === "rejected") {
//     const { data, error } = await supabase
//       .from("pairing_requests")
//       .update({
//         status: "pending",
//       })
//       .in("user_id", [student.id, tutor.id]);

//     console.log(data, error);
//     if (!error)
//       await supabase.from("pairing_logs").insert([
//         {
//           type: "pairing-match-rejected",
//           message: `${tutor.first_name} ${tutor.last_name} has declined ${student.first_name} ${student.last_name} as a student`,
//           error: false,
//           metadata: {
//             profile_id: profileId,
//           },
//         } as PairingLogSchemaType,
//       ]);
//   }
