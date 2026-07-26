"use client";
import { Profile, Session } from "@/types";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../../supabase/client";
import { Table } from "../../supabase/tables";
import type { Database } from "@/types/database.types";

// export async function getProfileWithProfileId(
//   profileId: string
// ): Promise<Profile | null> {
//   try {
//     const { data, error } = await supabase
//       .from(Table.Profiles)
//       .select(
//         `
//         id,
//         created_at,
//         role,
//         user_id,
//         first_name,
//         last_name,
//         date_of_birth,
//         start_date,
//         availability,
//         email,
//         phone_number,
//         parent_name,
//         parent_phone,
//         parent_email,
//         tutor_ids,
//         timezone,
//         subjects_of_interest,
//         status,
//         student_number,
//         languages_spoken,
//         settings_id
//       `
//       )
//       .eq("id", profileId)
//       .single();

//     if (error) {
//       console.error(
//         "Error fetching profile in getProfileWithProfileId:",
//         error.message
//       );
//       console.error("Error details:", error);
//       return null;
//     }

//     if (!data) {
//       return null;
//     }

//     console.log(data);

//     // Mapping the fetched data to the Profile object
//     const userProfile: Profile = {
//       id: data.id,
//       createdAt: data.created_at,
//       role: data.role,
//       userId: data.user_id,
//       firstName: data.first_name,
//       lastName: data.last_name,
//       // dateOfsBirth: data.date_of_birth,
//       startDate: data.start_date,
//       availability: data.availability,
//       email: data.email,
//       phoneNumber: data.phone_number,
//       parentName: data.parent_name,
//       parentPhone: data.parent_phone,
//       tutorIds: data.tutor_ids,
//       parentEmail: data.parent_email,
//       timeZone: data.timezone,
//       subjects_of_interest: data.subjects_of_interest,
//       languages_spoken: data.languages_spoken,
//       status: data.status,
//       studentNumber: data.student_number,
//       settingsId: data.settings_id,
//     };

//     return userProfile;
//   } catch (error) {
//     console.error("Unexpected error in getProfile:", error);
//     return null;
//   }
// }

interface UpdateProfileInput {
  userId: string;
  availability?: { day: string; startTime: string; endTime: string }[];
  subjectsOfInterest?: string[];
  languagesSpoken?: string[]; // Make sure this exists in your DB
}

export type ProfilePairingMetadata = UpdateProfileInput;

export async function updateProfileDetails({
  userId,
  availability,
  subjectsOfInterest,
  languagesSpoken,
}: UpdateProfileInput): Promise<{ success: boolean; error?: string }> {
  const updates: Record<string, any> = {};
  if (availability !== undefined) updates.availability = availability;
  if (subjectsOfInterest !== undefined) updates.subjects_of_interest = subjectsOfInterest;
  if (languagesSpoken !== undefined) updates.languages_spoken = languagesSpoken;

  const { error } = await supabase
    .from(Table.Profiles)
    .update(updates as Database["public"]["Tables"]["Profiles"]["Update"])
    .eq("user_id", userId);

  if (error) {
    console.error("Error updating profile:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export const switchAndGetProfileInfo = async () => {};

export function getStudentFromSession(session: Session): {
  studentName: string;
  studentEmail: string;
  studentUserId: string;
} {
  const student = session.student;

  if (!student) {
    throw new Error("Session has no student assigned");
  }

  return {
    studentName: `${student.firstName} ${student.lastName}`.trim(),
    studentEmail: student.email,
    studentUserId: student.userId,
  };
}
