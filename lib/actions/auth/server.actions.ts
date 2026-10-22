"use server";

import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { Profile, CreatedProfileData } from "@/types";
import { createPassword } from "../../utils";
import { cachedGetUser } from "../user/actions";
import { getProfileRole } from "../user/server.actions";
import { isCronRequestAuthorized } from "@/lib/security/cron";
import { logError } from "@/lib/posthog";
import { deleteOnboardingTutor } from "@/lib/auth/delete-tutor.server";
import type { TutorDeletionConfirmation } from "@/lib/auth/tutor-deletion";
import { provisionUser } from "@/lib/auth/provision-user.server";
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

/** Last-resort first-access onboarding recovery. All confirmations are mandatory. */
export const deleteUser = async (profileId: string, confirmation: TutorDeletionConfirmation) => {
  return deleteOnboardingTutor(profileId, confirmation);
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
