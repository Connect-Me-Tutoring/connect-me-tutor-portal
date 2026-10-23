import "server-only";
import { buildUserMetadata } from "@/lib/actions/auth/profile-insert";
import { createAdminClient } from "@/lib/supabase/server";
import { CreatedProfileData, Profile } from "@/types";
import { tableToInterfaceProfiles } from "@/lib/utils/type-utils";
import { Table } from "@/lib/supabase/tables";
import { logError } from "@/lib/posthog";
import type { Database } from "@/types/database.types";

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
export const provisionUser = async (newProfileData: CreatedProfileData) => {
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
