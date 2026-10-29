"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { Profile, CreatedProfileData, Availability } from "@/types";
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
import { provisionUser } from "@/lib/auth/provision-user.server";
import { removeFutureSessions } from "../enrollment/server.actions";
import {
  countLegacyPendingConsentRequests,
  provisionLegacyPendingConsentRequests,
} from "@/lib/consent/parental-consent.server";

/**
 * Creates a new user through an email invite. Parental consent for students under
 * 13 is collected at intake, outside the portal, before an admin adds them.
 */
export const createUser = async (newProfileData: CreatedProfileData): Promise<Profile> => {
  await verifyAdmin();
  return provisionUser(newProfileData);
};

/** Students still waiting on the retired parent-approval email link. */
export const countLegacyPendingParentalConsents = async (): Promise<number> => {
  await verifyAdmin();
  return countLegacyPendingConsentRequests();
};

/** Creates the accounts for those students; their consent is on file from intake. */
export const provisionLegacyPendingParentalConsents = async () => {
  await verifyAdmin();
  return provisionLegacyPendingConsentRequests();
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

    // Deleting the profile cascades to its Enrollments, which leaves their future
    // sessions behind unless they are removed first.
    const { data: enrollments } = await adminSupabase
      .from(Table.Enrollments)
      .select("id")
      .or(`tutor_id.eq.${profileId},student_id.eq.${profileId}`)
      .throwOnError();
    await removeFutureSessions(
      enrollments.map((enrollment) => enrollment.id),
      adminSupabase,
    );

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
