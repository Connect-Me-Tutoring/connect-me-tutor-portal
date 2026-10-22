import "server-only";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/actions/auth/authz.server";
import { logError } from "@/lib/posthog";
import { tutorDeletionConfirmationSchema, type TutorDeletionConfirmation } from "./tutor-deletion";
import { z } from "zod";

export async function deleteOnboardingTutor(
  profileId: string,
  confirmation: TutorDeletionConfirmation,
) {
  const { user } = await requireAdmin();
  z.string().uuid().parse(profileId);
  const input = tutorDeletionConfirmationSchema.parse(confirmation);
  const client = await createClient();
  // Cookie-bound RPC: the DB verifies auth.uid() is an admin independently.
  const { data: attempt, error: prepareError } = await client.rpc(
    "prepare_tutor_onboarding_deletion",
    {
      p_profile_id: profileId,
      p_email: input.email,
      p_reason: input.reason,
      p_recovery_attempted: input.recoveryAttempted,
      p_first_access_failure: input.firstAccessFailure,
    },
  );
  if (prepareError || !attempt) {
    await logError(
      prepareError ?? new Error("Missing deletion audit"),
      { action: "deleteUser.prepare", profileId, actorId: user.id },
      "auth_error",
    );
    throw new Error("Unable to validate deletion eligibility. No deletion was started.");
  }
  if (attempt.status !== "pending" || !attempt.auth_user_id) {
    return {
      success: false as const,
      message:
        attempt.failure ??
        "This tutor is not eligible for onboarding recovery deletion. Use Deactivate Tutor.",
    };
  }

  const admin = await createAdminClient();
  let deletionError: unknown;
  try {
    // Never delete Profiles separately. The auth transaction owns the guard,
    // permitted cleanup, cascades and success audit; any failure rolls it back.
    const { error } = await admin.auth.admin.deleteUser(attempt.auth_user_id);
    deletionError = error;
  } catch (error) {
    deletionError = error;
  }
  // Reconcile even a lost HTTP response: committed success is authoritative.
  const { data: outcome, error: outcomeError } = await admin
    .from("tutor_deletion_audit")
    .select("status")
    .eq("id", attempt.id)
    .single();
  if (outcome?.status === "succeeded") {
    return { success: true as const, email: attempt.email ?? input.email };
  }
  if (outcomeError || !outcome) {
    await logError(
      outcomeError ?? new Error("Missing deletion outcome"),
      { action: "deleteUser.reconcile", profileId, auditId: attempt.id, actorId: user.id },
      "auth_error",
    );
    return {
      success: false as const,
      message:
        "Deletion status could not be verified. Refresh All Tutors and check the audit before retrying or reinviting.",
    };
  }
  // This update competes with the trigger's row lock: it cannot overwrite a
  // committed success, and invalidates an outstanding/failed request safely.
  const { error: auditError } = await admin
    .from("tutor_deletion_audit")
    .update({
      status: "failed",
      failure: "Authentication deletion failed or was blocked by the database guard.",
      completed_at: new Date().toISOString(),
    })
    .eq("id", attempt.id)
    .eq("status", "pending");
  // A delayed auth transaction may have committed while the failed-only update
  // waited on its row lock. Re-read before reporting an outcome to the admin.
  const { data: finalOutcome, error: finalOutcomeError } = await admin
    .from("tutor_deletion_audit")
    .select("status")
    .eq("id", attempt.id)
    .single();
  if (finalOutcome?.status === "succeeded") {
    return { success: true as const, email: attempt.email ?? input.email };
  }
  if (auditError || finalOutcomeError || !finalOutcome || finalOutcome.status === "pending") {
    await logError(
      auditError ?? finalOutcomeError ?? new Error("Unresolved deletion outcome"),
      { action: "deleteUser.reconcile", profileId, auditId: attempt.id, actorId: user.id },
      "auth_error",
    );
    return {
      success: false as const,
      message:
        "Deletion status could not be verified. Refresh All Tutors and check the audit before retrying or reinviting.",
    };
  }
  await logError(
    deletionError ?? new Error("Deletion was not committed"),
    { action: "deleteUser", profileId, actorId: user.id, auditId: attempt.id, auditError },
    "auth_error",
  );
  return {
    success: false as const,
    message:
      "Deletion failed or was blocked by protected history. Refresh All Tutors before retrying; use Deactivate Tutor for accounts with activity.",
  };
}
