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
 * No authorization check: callers must have already verified an admin or a parental consent.
 */
export const provisionUser = async (input: CreatedProfileData) => {
  const supabase = await createAdminClient();
  // Auth stores emails lowercased; match it so the lookups below find the login.
  const newProfileData = { ...input, email: input.email.trim().toLowerCase() };
  try {
    // The login email (auth.users) is the source of truth for which account owns an
    // address; Profiles.email is a copy.
    const existingUserId = await getAuthUserIdByEmail(supabase, newProfileData.email);

    let userId = existingUserId;
    if (existingUserId) {
      const { data: existingProfiles } = await supabase
        .from("Profiles")
        .select("role")
        .eq("user_id", existingUserId)
        .throwOnError();
      if (existingProfiles?.some((p) => p.role === "Admin")) {
        throw new Error("Multiple profiles prohibited for provided email");
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
