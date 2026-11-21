import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { Availability, CreatedProfileData, Profile } from "@/types";
import { tableToInterfaceProfiles } from "@/lib/utils/type-utils";
import { Table } from "@/lib/supabase/tables";
import { logError } from "@/lib/posthog";
import type { Database } from "@/types/database.types";

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

export type ProvisionUserResult = {
  profile: Profile;
  /** False when the email already had a login: the profile joins it and no invite is sent. */
  invited: boolean;
  /** Set when the profile was created but a follow-up step failed. Safe to show admins. */
  warning?: string;
};

/** A failure the admin can act on. Its message is safe to show them. */
export class ProvisionUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProvisionUserError";
  }
}

type ExistingProfile = {
  id: string;
  role: string | null;
  first_name: string | null;
  last_name: string | null;
  status: string | null;
};

const normalizeName = (name: string | null | undefined) =>
  (name ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Siblings can share a parent's login, so a second Student profile on one login is
 * normal. The same person with the same role twice is not: it is an admin re-adding
 * someone who already exists, which used to leave duplicates that only deletion fixed.
 */
const findSamePerson = (profiles: ExistingProfile[], input: CreatedProfileData) =>
  profiles.find(
    (p) =>
      p.role === input.role &&
      normalizeName(p.first_name) === normalizeName(input.firstName) &&
      normalizeName(p.last_name) === normalizeName(input.lastName),
  );

const samePersonMessage = (existing: ExistingProfile, input: CreatedProfileData) => {
  const name = `${input.firstName} ${input.lastName}`.trim();
  const role = input.role.toLowerCase();
  if (existing.status === "Inactive") {
    return `${name} already has an inactive ${role} profile under ${input.email}. Reactivate that profile instead of adding them again.`;
  }
  return `${name} already has a ${role} profile under ${input.email}, so nothing was added and no email was sent. If they can't sign in, ask them to use Forgot password on the login page to get a sign-in code.`;
};

/**
 * A login opens on its last active profile. When a new profile joins a login whose last
 * active profile is inactive (someone returning), open the new one instead, or they land
 * back on the profile that was deactivated. Active profiles are left alone; the profile
 * switcher covers siblings.
 */
const openNewProfileIfLastActiveIsInactive = async (
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string,
  newProfileId: string,
  existingProfiles: ExistingProfile[],
) => {
  const { data: settings } = await supabase
    .from("user_settings")
    .select("last_active_profile_id")
    .eq("user_id", userId)
    .maybeSingle()
    .throwOnError();
  const lastActiveId = settings?.last_active_profile_id;
  if (!lastActiveId || lastActiveId === newProfileId) return;

  const lastActive = existingProfiles.find((p) => p.id === lastActiveId);
  if (lastActive && lastActive.status !== "Inactive") return;

  await supabase
    .from("user_settings")
    .update({ last_active_profile_id: newProfileId })
    .eq("user_id", userId)
    .throwOnError();
};

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

const getAuthUserIdByEmail = async (
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  email: string,
): Promise<string | null> => {
  const { data, error } = await supabase.rpc("get_user_by_email", { email });
  if (error) throw error;
  return (data as { id?: string } | null)?.id ?? null;
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
 * Creates the auth user (via email invite), the Profiles row, and the pairing queue entry.
 * When the email already has a login, the profile joins that login and no invite is sent.
 * Re-adding the same person (same role and name on that login) is refused, so a repeated
 * call after a success can't leave a duplicate.
 * No authorization check: callers must have already verified an admin or a parental consent.
 */
export const provisionUser = async (input: CreatedProfileData): Promise<ProvisionUserResult> => {
  const supabase = await createAdminClient();
  // Auth stores emails lowercased; match it so the lookups below find the login.
  const newProfileData = { ...input, email: input.email.trim().toLowerCase() };
  try {
    // The login email (auth.users) is the source of truth for which account owns an
    // address; Profiles.email is a copy.
    const existingUserId = await getAuthUserIdByEmail(supabase, newProfileData.email);

    let userId = existingUserId;
    let existingProfiles: ExistingProfile[] = [];
    if (existingUserId) {
      const { data } = await supabase
        .from("Profiles")
        .select("id, role, first_name, last_name, status")
        .eq("user_id", existingUserId)
        .throwOnError();
      existingProfiles = data ?? [];
      if (existingProfiles.some((p) => p.role === "Admin")) {
        throw new ProvisionUserError(
          "Multiple profiles prohibited for provided email: it belongs to an admin account.",
        );
      }
      const samePerson = findSamePerson(existingProfiles, newProfileData);
      if (samePerson) {
        throw new ProvisionUserError(samePersonMessage(samePerson, newProfileData));
      }
    } else {
      const { newUserId, authError } = await inviteUser(newProfileData);
      if (!newUserId || authError) {
        // The invite can create the auth user and then fail (e.g. sending the email). Remove
        // only a user created by this call, and only if it has no profiles.
        const createdUserId = await getAuthUserIdByEmail(supabase, newProfileData.email);
        if (createdUserId) {
          const { count } = await supabase
            .from("Profiles")
            .select("id", { count: "exact", head: true })
            .eq("user_id", createdUserId)
            .throwOnError();
          if (!count) await supabase.auth.admin.deleteUser(createdUserId);
        }
        throw authError ?? new Error("Unable to invite user");
      }
      userId = newUserId;
    }
    if (!userId) throw new Error("Unable to resolve user for new profile");

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
      .insert(userMetadata as unknown as Database["public"]["Tables"]["Profiles"]["Insert"])
      .select()
      .single();

    if (profileError) {
      console.error("Unable to create profile", profileError);
      await logError(
        profileError,
        { action: "createUser", email: newProfileData.email },
        "auth_error",
      );
      // Only remove a login this call created; an existing login keeps its other profiles.
      if (!existingUserId) await supabase.auth.admin.deleteUser(userId);
      throw profileError;
    }

    const profile: Profile = tableToInterfaceProfiles(createdProfile);

    // The profile (and any invite) exists from here on. Report later failures as warnings:
    // an error here used to look like the whole add failed, so admins added them again.
    const warnings: string[] = [];

    if (existingUserId) {
      try {
        await openNewProfileIfLastActiveIsInactive(
          supabase,
          existingUserId,
          createdProfile.id,
          existingProfiles,
        );
      } catch (error) {
        await logError(
          error,
          { action: "createUser.openNewProfile", profileId: createdProfile.id },
          "auth_error",
        );
        warnings.push(
          "They may still open on their old profile and need to switch profiles from the menu.",
        );
      }
    }

    try {
      await ensurePairingQueueForNewProfile(supabase, {
        id: createdProfile.id,
        role: createdProfile.role ?? null,
      });
    } catch (error) {
      await logError(
        error,
        { action: "createUser.pairingQueue", profileId: createdProfile.id },
        "auth_error",
      );
      warnings.push("Adding them to the pairing queue failed, so they won't be matched yet.");
    }

    return {
      profile,
      invited: !existingUserId,
      warning: warnings.length ? warnings.join(" ") : undefined,
    };
  } catch (error) {
    // A refusal the admin can act on is not an error to report.
    if (!(error instanceof ProvisionUserError)) {
      console.error("Error creating user:", error);
      await logError(error, { action: "createUser", email: newProfileData.email }, "auth_error");
    }
    throw error;
  }
};
