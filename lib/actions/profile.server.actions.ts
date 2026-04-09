"use server";

import { Profile } from "@/types";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { Table } from "../supabase/tables";

import axios from "axios";
import { getSupabase } from "../supabase-server/serverClient";
import { revalidatePath } from "next/cache";
import { tableToInterfaceProfiles } from "../type-utils";

export const switchProfile = async (userId: string, profileId: string) => {
  try {
    const supabase = await createClient();
    await supabase
      .from("user_settings")
      .update({ last_active_profile_id: profileId })
      .eq("user_id", userId)
      .throwOnError();

    // Invalidate cache to force refetch of profile data
    revalidatePath("/dashboard");
    revalidatePath("/");
    revalidatePath("/settings");
    revalidatePath("/profile");
  } catch (error) {
    throw error;
  }
};

export const getUserProfiles = async (userId: string) => {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("Profiles")
      .select(
        `
          id,
          first_name,
          last_name,
          email
          `,
      )
      .eq("user_id", userId)
      .throwOnError();

    const profiles: Partial<Profile>[] = data.map((profile) => ({
      id: profile.id,
      firstName: profile.first_name,
      lastName: profile.last_name,
    }));
    return profiles;
  } catch (error) {
    console.error("Unable to get user profiles", error);
    throw error;
  }
};

export async function getAllProfiles(
  role: "Student" | "Tutor" | "Admin",
  orderBy?: string | null,
  ascending?: boolean | null,
  status?: string | null,
): Promise<Profile[] | null> {
  const supabase = await createClient();

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

export const getProfileFromUserSettings = async (userId: string) => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("user_settings")
      .select(
        `
        profile:Profiles!last_active_profile_id(
          id,
          created_at,
          role,
          user_id,
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
          status,
          student_number,
          settings_id,
          languages_spoken
        )
      `,
      )
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Error fetching profile in getProfile:", error.message);
      console.error("Error details:", error);
      throw error;
    }

    // const profile = data as any;
    // if (profile.user_id !== userId) {
    //   throw new Error(
    //     `User_settings for user ${userId} points to profile owned by ${profile?.user_id}. Refusing to return profile.`,
    //   );
    // }
    return tableToInterfaceProfiles(data.profile as any);
  } catch (error) {
    throw error;
  }
};

export async function getProfile(userId: string) {
  if (!userId) {
    console.error("User ID is required to fetch profile data");
    return null;
  }
  try {
    return getProfileFromUserSettings(userId);
  } catch (error) {
    console.error("Unexpected error in getProfile:", error);
    return null;
  }
}

export const getProfileUncached = async (userId: string) => {
  return getProfile(userId);
};

export const getTutorStudents = async (tutorId: string) => {
  try {
    const supabase = await createClient();
    const { data: pairings, error: pairingsError } = await supabase
      .from(Table.Pairings)
      .select("student_id")
      .eq("tutor_id", tutorId);

    if (pairingsError) {
      console.error("Error fetching enrollments:", pairingsError);
      return null;
    }

    const studentIds = pairings.map((pairing) => pairing.student_id);

    const { data: studentProfiles, error: profileError } = await supabase
      .from(Table.Profiles)
      .select("*")
      .in("id", studentIds);

    if (profileError) {
      console.error("Error fetching student profile", profileError);
      return null;
    }

    // Mapping the fetched data to the Profile object
    const userProfiles: Profile[] = studentProfiles.map((profile: any) => ({
      id: profile.id,
      createdAt: profile.created_at,
      role: profile.role,
      userId: profile.user_id,
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
      subjects_of_interest: profile.subjects_of_interest,
      status: profile.status,
      studentNumber: profile.student_number,
      settingsId: profile.settings_id,
      languages_spoken: profile.languages_spoken || [],
    }));

    return userProfiles;
  } catch (error) {
    console.error("Unexpected error in getProfile:", error);
    return null;
  }
};

export async function editProfile(profile: Profile) {
  const supabase = await createClient();
  const {
    id,
    role,
    firstName,
    lastName,
    age,
    grade,
    gender,
    email,
    phoneNumber,
    startDate,
    parentName,
    parentPhone,
    parentEmail,
    timeZone,
    availability,
    subjects_of_interest,
    languages_spoken,
    studentNumber,
    status, // pull status out so we can actually persist it instead of just ignoring
  } = profile;
  try {
    const { data: emailData } = await supabase
      .from(Table.Profiles)
      .select("email")
      .eq("id", id)
      .single()
      .throwOnError();

    if (emailData.email != email) {
      await supabase.auth.updateUser({ email: email });
    }

    const { data, error } = await supabase
      .from(Table.Profiles)
      .update({
        role: role,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        age: age,
        grade: grade,
        gender: gender,
        email: email,
        phone_number: phoneNumber,
        start_date: startDate,
        parent_name: parentName,
        parent_email: parentEmail,
        parent_phone: parentPhone,
        timezone: timeZone,
        student_number: studentNumber,
        availability: availability,
        subjects_of_interest: subjects_of_interest,
        languages_spoken: languages_spoken,
        status: status, // without this, status changes from the edit form just get ignored and dont hit db
      })
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error updating user", error);
    throw new Error("Unable to edit User");
  }
}
