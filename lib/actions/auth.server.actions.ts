"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { Profile, CreatedProfileData, Availability } from "@/types";
import { User } from "@supabase/supabase-js";
import { Table } from "../supabase/tables";
import { admin } from "googleapis/build/src/apis/admin";
import { profile } from "console";
import { tableToInterfaceProfiles } from "../type-utils";
import { createPassword } from "../utils";
import { cachedGetUser } from "./user.server.actions";
import { cachedGetProfile } from "./cache";

interface UserMetadata {
  email: string;
  role: "Student" | "Tutor" | "Admin";
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  age: string;
  grade: string;
  gender: string;
  start_date: string;
  availability: Availability[];
  parent_name: string;
  parent_phone: string;
  parent_email: string;
  phone_number: string;
  timezone: string;
  subjects_of_interest: string[];
  status: "Active";
  student_number: string;
  languages_spoken: string[];
}

export const isAuthorized = async (request: NextRequest) => {
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${process.env.BEARER_TOKEN}`;
};

export const verifyAdmin = async () => {
  const user = await cachedGetUser();
  if (!user) throw new Error("Unauthenticated access");
  const profile = await cachedGetProfile(user.id);
  if (!profile || profile.role !== "Admin")
    throw new Error("Unauthorized Access");
};

export const getUser = async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
};

const inviteUser = async (newProfileData: CreatedProfileData) => {
  const supabase = await createAdminClient();

  const { data: authData, error: authError } =
    await supabase.auth.admin.inviteUserByEmail(newProfileData.email, {
      data: {
        first_name: newProfileData.firstName,
        last_name: newProfileData.lastName,
      },
    });

  // await supabase.auth.admin.createUser({
  //   email: newProfileData.email,
  //   password: newProfileData.password,
  // });

  // if (authError) {
  //   console.log("Unable to invite user " + authError.message);
  //   throw new Error("Unable to invite user " + authError.message);
  // }

  const newUserId = authData?.user?.id;
  return { newUserId, authError };
};

/**
 * Creates a new user through an email invite
 * @param newProfileData
 * @returns
 */

export const createUser = async (newProfileData: CreatedProfileData) => {
  const supabase = await createAdminClient();
  try {
    const { data: prevProfile } = await supabase
      .from("Profiles")
      .select("user_id, role")
      .eq("email", newProfileData.email)
      .limit(1)
      .maybeSingle()
      .throwOnError();

    if (prevProfile?.role === "Admin") {
      throw new Error("Multiple profiles prohibited for provided email");
    }

    let userId = prevProfile?.user_id;
    if (!userId) {
      const { newUserId, authError } = await inviteUser(newProfileData);
      if (!newUserId || authError) {
        const { data } = await supabase.rpc("get_user_by_email", {
          email: newProfileData.email,
        });
        if (data) await supabase.auth.admin.deleteUser(data.id);
        throw authError;
      }
      userId = newUserId;
    }

    const userMetadata: UserMetadata = {
      email: newProfileData.email,
      role: newProfileData.role,
      user_id: userId,
      first_name: newProfileData.firstName,
      last_name: newProfileData.lastName,
      age: newProfileData.age,
      grade: newProfileData.grade,
      gender: newProfileData.gender,
      start_date: newProfileData.startDate,
      availability: newProfileData.availability,
      parent_name: newProfileData.parentName,
      parent_phone: newProfileData.parentPhone,
      parent_email: newProfileData.parentEmail,
      phone_number: newProfileData.phoneNumber,
      timezone: newProfileData.timezone,
      subjects_of_interest: newProfileData.subjects_of_interest,
      status: newProfileData.status,
      student_number: newProfileData.studentNumber,
      languages_spoken: newProfileData.languages_spoken,
    };

    const { data: createdProfile, error: profileError } = await supabase
      .from("Profiles")
      .insert(userMetadata)
      .select()
      .single();

    /*
     * Should only delete if we do not already have another profile under the same email
     * and we encounter an error inserting a Profile record to the table
     */
    if (!prevProfile && profileError) {
      console.error("Unable to create profile", profileError);
      await supabase.auth.admin.deleteUser(userId);
      throw profileError;
    }

    const createdProfileData: Profile =
      tableToInterfaceProfiles(createdProfile);

    return createdProfileData;
  } catch (error) {
    console.error("Error creating user:", error);
    throw error;
  }
};

const replaceLastActiveProfile = async (
  userId: string,
  lastActiveProfileId: string,
  userProfileIds: { id: string }[],
) => {
  const supabase = await createClient();
  try {
    const availableProfile = userProfileIds.find(
      (profile) => profile.id != lastActiveProfileId,
    );
    if (availableProfile === undefined)
      throw new Error(
        "Called replaceLastActiveProfile with only one or zero profileIds attached to userId",
      );

    await supabase
      .from("user_settings")
      .update({ last_active_profile_id: availableProfile.id })
      .eq("user_id", userId)
      .throwOnError();
  } catch (error) {
    console.error("Unable to replace last active profile", error);
    throw error;
  }
};

export const deleteUser = async (profileId: string) => {
  const adminSupabase = await createAdminClient();

  try {
    const { data: profile } = await adminSupabase
      .from(Table.Profiles)
      .select("user_id")
      .eq("id", profileId)
      .single()
      .throwOnError();

    const [res1, res2] = await Promise.all([
      adminSupabase
        .from(Table.Profiles)
        .select("id, user_id")
        .eq("user_id", profile.user_id)
        .throwOnError(),
      adminSupabase
        .from("user_settings")
        .select(
          `
        user_id,
        last_active_profile_id
        `,
        )
        .eq("last_active_profile_id", profileId)
        .eq("user_id", profile.user_id)
        .maybeSingle()
        .throwOnError(),
    ]);

    const relatedProfiles = res1.data;
    const userSettings = res2.data;

    if (relatedProfiles.length == 1) {
      const { error: authError } = await adminSupabase.auth.admin.deleteUser(
        relatedProfiles[0].user_id,
      );

      if (authError) throw authError;
    } else if (
      userSettings &&
      userSettings.last_active_profile_id == profileId
    ) {
      replaceLastActiveProfile(
        userSettings.user_id,
        userSettings.last_active_profile_id,
        relatedProfiles,
      );
    }

    await adminSupabase
      .from(Table.Profiles)
      .delete()
      .eq("id", profileId)
      .throwOnError();
  } catch (error: any) {
    console.error("Failed to delete user", error);
    throw error;
  }
};

export const createUserWithTempPassword = async (tutor: Partial<Profile>) => {
  try {
    const tempPassword = await createPassword();
    const supabase = await createClient();
    const { data, error } = await supabase.auth.admin.createUser({
      email: tutor.email || "",
      password: tempPassword,
      email_confirm: true,
    });
    return tutor as Profile;
  } catch (error) {
    console.error("Unable to create user", error);
  }
};
