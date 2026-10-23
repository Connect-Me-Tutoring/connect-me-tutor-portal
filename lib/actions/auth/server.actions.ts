"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { Profile, CreatedProfileData } from "@/types";
import { User } from "@supabase/supabase-js";
import { Table } from "../../supabase/tables";
import { admin } from "googleapis/build/src/apis/admin";
import { profile } from "console";
import { tableToInterfaceProfiles } from "../../utils/type-utils";
import { createPassword } from "../../utils";
import { cachedGetUser } from "../user/actions";
import { getProfileRole } from "../user/server.actions";
import { isCronRequestAuthorized } from "@/lib/security/cron";
import { logError } from "@/lib/posthog";
import type { Database } from "@/types/database.types";
import { buildUserMetadata } from "./profile-insert";

const ensurePairingQueueForNewProfile = async (
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  profile: { id: string; role: string | null },
) => {
  const normalizedRole = profile.role?.toLowerCase();
  if (normalizedRole !== "student" && normalizedRole !== "tutor") return;

  const { data: existing, error: existingError } = await supabase
    .from(Table.PairingRequests)
    .select("id, in_queue, priority")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing?.id) {
    if (existing.in_queue === false) {
      const { error: updateError } = await supabase
        .from(Table.PairingRequests)
        .update({
          in_queue: true,
          status: "pending",
          type: normalizedRole,
          priority: existing.priority ?? 1,
        })
        .eq("id", existing.id);
      if (updateError) throw updateError;
    }
    return;
  }

  const { error: insertError } = await supabase.from(Table.PairingRequests).insert([
    {
      user_id: profile.id,
      type: normalizedRole,
      status: "pending",
      priority: 1,
      in_queue: true,
      notes: "Auto-enqueued on account creation",
    },
  ]);
  if (insertError) throw insertError;
};

export const isAuthorized = async (request: NextRequest) => {
  const bearerToken = process.env.BEARER_TOKEN;
  if (!bearerToken) {
    await logError(
      new Error("BEARER_TOKEN is not configured"),
      { action: "isAuthorized" },
      "auth_error",
    );
    return false;
  }
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${bearerToken}`;
};

export const verifyAdmin = async () => {
  const user = await cachedGetUser();
  if (!user) throw new Error("Unauthenticated access");
  const role = await getProfileRole(user.id);
  if (role !== "Admin") throw new Error("Unauthorized Access");
};

/**
 * Double check whether or not the route handler is called by a cron job, if it is not then throw an error
 */

export const verifyCron = async (request: NextRequest) => {
  if (!isCronRequestAuthorized(request)) {
    throw new Error("Unauthorized cron access");
  }
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

  const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(
    newProfileData.email,
    {
      data: {
        first_name: newProfileData.firstName,
        last_name: newProfileData.lastName,
      },
    },
  );

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
  await verifyAdmin();
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
        const userRecord = data as unknown as { id: string } | null;
        if (userRecord) await supabase.auth.admin.deleteUser(userRecord.id);
        throw authError;
      }
      userId = newUserId;
    }

    const userMetadata = buildUserMetadata(newProfileData, userId);

    const { data: createdProfile, error: profileError } = await supabase
      .from("Profiles")
      .insert(userMetadata as unknown as Database["public"]["Tables"]["Profiles"]["Insert"])
      .select()
      .single();

    /*
     * Should only delete if we do not already have another profile under the same email
     * and we encounter an error inserting a Profile record to the table
     */
    if (!prevProfile && profileError) {
      console.error("Unable to create profile", profileError);
      await logError(
        profileError,
        { action: "createUser", email: newProfileData.email },
        "auth_error",
      );
      await supabase.auth.admin.deleteUser(userId);
      throw profileError;
    }

    const createdProfileData: Profile = tableToInterfaceProfiles(createdProfile);

    if (createdProfile?.id) {
      await ensurePairingQueueForNewProfile(supabase, {
        id: createdProfile.id,
        role: createdProfile.role ?? null,
      });
    }

    return createdProfileData;
  } catch (error) {
    console.error("Error creating user:", error);
    await logError(error, { action: "createUser", email: newProfileData.email }, "auth_error");
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
    const availableProfile = userProfileIds.find((profile) => profile.id != lastActiveProfileId);
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
    await logError(
      error,
      { action: "replaceLastActiveProfile", userId, lastActiveProfileId },
      "auth_error",
    );
    throw error;
  }
};

export const deleteUser = async (profileId: string) => {
  await verifyAdmin();
  const adminSupabase = await createAdminClient();

  try {
    const { data: profile } = await adminSupabase
      .from(Table.Profiles)
      .select("user_id")
      .eq("id", profileId)
      .single()
      .throwOnError();

    if (!profile.user_id) {
      throw new Error(`Profile ${profileId} has no associated user_id`);
    }
    const userId = profile.user_id;

    const [res1, res2] = await Promise.all([
      adminSupabase.from(Table.Profiles).select("id, user_id").eq("user_id", userId).throwOnError(),
      adminSupabase
        .from("user_settings")
        .select(
          `
        user_id,
        last_active_profile_id
        `,
        )
        .eq("last_active_profile_id", profileId)
        .eq("user_id", userId)
        .maybeSingle()
        .throwOnError(),
    ]);

    const relatedProfiles = res1.data;
    const userSettings = res2.data;

    if (relatedProfiles.length == 1) {
      const relatedUserId = relatedProfiles[0].user_id;
      if (!relatedUserId) {
        throw new Error(`Related profile ${relatedProfiles[0].id} has no associated user_id`);
      }
      const { error: authError } = await adminSupabase.auth.admin.deleteUser(relatedUserId);

      if (authError) throw authError;
    } else if (userSettings && userSettings.last_active_profile_id == profileId) {
      replaceLastActiveProfile(
        userSettings.user_id,
        userSettings.last_active_profile_id,
        relatedProfiles,
      );
    }

    await adminSupabase.from(Table.Profiles).delete().eq("id", profileId).throwOnError();
  } catch (error: any) {
    console.error("Failed to delete user", error);
    await logError(error, { action: "deleteUser", profileId }, "auth_error");
    throw error;
  }
};

export const createUserWithTempPassword = async (tutor: Partial<Profile>) => {
  await verifyAdmin();
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
    await logError(
      error,
      { action: "createUserWithTempPassword", email: tutor.email },
      "auth_error",
    );
  }
};
