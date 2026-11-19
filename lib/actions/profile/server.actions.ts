"use server";

import { Profile } from "@/types";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { Table } from "../../supabase/tables";

import axios from "axios";
import { revalidatePath } from "next/cache";
import { tableToInterfaceProfiles } from "../../utils/type-utils";
import {
  assertProfileBelongsToUser,
  requireAdmin,
  requireAuthenticatedProfile,
  requireSelfOrAdmin,
  requireTutorProfileAccess,
} from "../auth/authz.server";
import { logError } from "@/lib/posthog";
import { z } from "zod";

export const switchProfile = async (userId: string, profileId: string) => {
  try {
    await requireSelfOrAdmin(userId);
    await assertProfileBelongsToUser(userId, profileId);
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
    await requireSelfOrAdmin(userId);
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
    await logError(error, { action: "getUserProfiles", userId }, "profile_error");
    throw error;
  }
};

export async function getAllProfiles(
  role: "Student" | "Tutor" | "Admin",
  orderBy?: string | null,
  ascending?: boolean | null,
  status?: NonNullable<"Active" | "Inactive">,
): Promise<Profile[] | null> {
  await requireAdmin();
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
    let query = supabase.from(Table.Profiles).select(profileFields).eq("role", role);

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
      await logError(
        error,
        { action: "getAllProfiles", role, orderBy, ascending, status },
        "profile_error",
      );
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    // Map database fields to camelCase Profile model
    const userProfiles: Profile[] = data.map(tableToInterfaceProfiles);

    return userProfiles;
  } catch (error) {
    console.error("Unexpected error in getProfile:", error);
    await logError(
      error,
      { action: "getAllProfiles", role, orderBy, ascending, status },
      "profile_error",
    );
    return null;
  }
}

export const getProfileFromUserSettings = async (userId: string): Promise<Profile | null> => {
  try {
    await requireSelfOrAdmin(userId);
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
          languages_spoken,
          orientation_completed_at
        )
      `,
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile in getProfile:", error.message);
      console.error("Error details:", error);
      await logError(error, { action: "getProfileFromUserSettings", userId }, "profile_error");
      throw error;
    }

    if (!data?.profile) {
      return null;
    }

    return tableToInterfaceProfiles(data.profile as any);
  } catch (error) {
    throw error;
  }
};

export async function getProfile(userId: string) {
  if (!userId) {
    console.error("User ID is required to fetch profile data");
    await logError(
      new Error("User ID is required to fetch profile data"),
      {
        action: "getProfile",
      },
      "profile_error",
    );
    return null;
  }
  try {
    return await getProfileFromUserSettings(userId);
  } catch (error) {
    console.error("Unexpected error in getProfile:", error);
    await logError(error, { action: "getProfile", userId }, "profile_error");
    return null;
  }
}

export const getProfileUncached = async (userId: string) => {
  return getProfile(userId);
};

export const getTutorStudents = async (tutorId: string) => {
  try {
    await requireTutorProfileAccess(tutorId);
    const supabase = await createClient();
    const { data: pairings, error: pairingsError } = await supabase
      .from(Table.Pairings)
      .select("student_id")
      .eq("tutor_id", tutorId);

    if (pairingsError) {
      console.error("Error fetching enrollments:", pairingsError);
      await logError(pairingsError, { action: "getTutorStudents", tutorId }, "profile_error");
      return null;
    }

    const studentIds = pairings.map((pairing) => pairing.student_id);

    // parallel fetch - saves a round trip
    const [{ data: studentProfiles, error: profileError }, { data: enrollments }] =
      await Promise.all([
        supabase.from(Table.Profiles).select("*").in("id", studentIds),
        supabase
          .from(Table.Enrollments)
          .select("student_id")
          .eq("tutor_id", tutorId)
          .eq("paused", false), // only active enrollments matter for sorting
      ]);

    if (profileError) {
      console.error("Error fetching student profile", profileError);
      await logError(profileError, { action: "getTutorStudents", tutorId }, "profile_error");
      return null;
    }

    // set of student ids w/ an active enrollment - used to sort below
    const enrolledIds = new Set((enrollments ?? []).map((e: any) => e.student_id));

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

    // enrolled students first, rest after
    userProfiles.sort((a, b) => {
      const aEnrolled = enrolledIds.has(a.id) ? 0 : 1;
      const bEnrolled = enrolledIds.has(b.id) ? 0 : 1;
      return aEnrolled - bEnrolled;
    });

    return userProfiles;
  } catch (error) {
    console.error("Unexpected error in getProfile:", error);
    await logError(error, { action: "getTutorStudents", tutorId }, "profile_error");
    return null;
  }
};

export async function editProfile(profile: Profile) {
  const { profile: actor } = await requireAuthenticatedProfile();
  if (actor.role !== "Admin" && actor.id !== profile.id) {
    throw new Error("Unauthorized");
  }
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
  } = profile;
  try {
    const { data: current } = await supabase
      .from(Table.Profiles)
      .select("email, user_id")
      .eq("id", id)
      .single()
      .throwOnError();

    // The login email lives on the auth user, not the profile row.
    // supabase.auth.updateUser() would change the *signed-in* user's email
    // (the admin's, when an admin edits someone else), so it isn't used here:
    // admins go through the admin API for the target account, and users
    // change their own email with requestEmailChange().
    const nextEmail = email?.trim().toLowerCase() ?? "";
    if (nextEmail && nextEmail !== current.email?.trim().toLowerCase()) {
      if (actor.role !== "Admin") {
        throw new Error("Use requestEmailChange to change your own email");
      }
      const { error: emailError } = await updateAccountEmail(current.user_id, id, nextEmail);
      if (emailError) throw new Error(emailError);
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
      })
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error updating user", error);
    await logError(error, { action: "editProfile", profileId: id }, "profile_error");
    throw new Error("Unable to edit User");
  }
}

/*
 * #807: deactivate instead of delete.
 *
 * Deliberately uses the cookie-bound client, NOT createAdminClient():
 * guard_profile_columns only allows status changes when private.is_admin()
 * is true, and is_admin() depends on auth.uid(), which is NULL for the
 * service-role client. The admin's own session is what makes this pass.
 *
 * deactivated_at, the profile_status_changes history row, and removing the
 * profile from the pairing queue are all handled by DB triggers
 * (20260926000000_profile_deactivation.sql), so a self-pause from Settings
 * gets the same behavior without going through this function. This is the
 * only admin path for status; editProfile deliberately doesn't write it.
 */
export async function setProfileStatus(
  profileId: string,
  status: "Active" | "Inactive",
): Promise<Profile> {
  await requireAdmin();
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from(Table.Profiles)
      .update({ status })
      .eq("id", profileId)
      .select("*")
      .single();
    if (error) throw error;
    return tableToInterfaceProfiles(data) as Profile;
  } catch (error) {
    await logError(error, { action: "setProfileStatus", profileId, status }, "profile_error");
    throw new Error(`Unable to set profile status to ${status}`);
  }
}

export async function deactivateProfile(profileId: string) {
  return setProfileStatus(profileId, "Inactive");
}

export async function reactivateProfile(profileId: string) {
  return setProfileStatus(profileId, "Active");
}

const emailSchema = z.string().trim().toLowerCase().email().max(254);

/*
 * Admin-only: change the login email of the account that owns profileId and
 * copy it to every profile under that account (profiles share one login, see
 * createUser). Confirmed immediately since an admin made the change. The
 * profile rows are only touched once auth accepts the new address.
 */
async function updateAccountEmail(
  userId: string | null,
  profileId: string,
  email: string,
): Promise<{ error: string | null }> {
  const admin = await createAdminClient();
  if (userId) {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      email,
      email_confirm: true,
    });
    if (error) {
      await logError(error, { action: "updateAccountEmail", profileId }, "profile_error");
      return { error: error.message };
    }
  }

  const query = admin.from(Table.Profiles).update({ email });
  const { error: syncError } = await (userId
    ? query.eq("user_id", userId)
    : query.eq("id", profileId));
  if (syncError) {
    await logError(syncError, { action: "updateAccountEmail", profileId }, "email_sync_error");
    return { error: "Login email changed, but the profile could not be updated" };
  }
  return { error: null };
}

/*
 * Starts a self-service email change. Supabase Auth emails confirmation
 * links to the old and new addresses (double_confirm_changes); Profiles.email
 * is NOT touched here and is synced in /auth/confirm once both are confirmed.
 * Returns the error instead of throwing because Next.js hides thrown
 * server-action messages in production ("already registered", rate limits).
 */
export async function requestEmailChange(newEmail: string): Promise<{ error: string | null }> {
  const { user } = await requireAuthenticatedProfile();
  const parsed = emailSchema.safeParse(newEmail);
  if (!parsed.success) return { error: "Enter a valid email address" };
  const email = parsed.data;
  if (email === user.email?.toLowerCase()) {
    return { error: "That's already your current email address" };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.connectmego.app";
  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: `${siteUrl}/auth/confirm?next=/dashboard/settings` },
  );
  if (error) {
    await logError(error, { action: "requestEmailChange" }, "profile_error");
    return { error: error.message };
  }
  return { error: null };
}
