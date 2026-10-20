import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { provisionUser } from "@/lib/auth/provision-user.server";
import { logError } from "@/lib/posthog";
import type { CreatedProfileData } from "@/types";

// Holds requests from the retired parent-approval email link. Parental consent is
// now collected at intake, outside the portal, so no new rows are written here.
const TABLE = "parental_consents";

/** Requests from the retired email-link flow that are still waiting on a parent. */
export async function countLegacyPendingConsentRequests(): Promise<number> {
  const supabase = await createAdminClient();
  const { count, error } = await supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}

/**
 * Creates the accounts for students left waiting by the retired email-link flow.
 * Their consent was collected at intake, so the parent's approval isn't needed.
 */
export async function provisionLegacyPendingConsentRequests(): Promise<{
  provisioned: number;
  failed: number;
}> {
  const supabase = await createAdminClient();
  const { data: rows, error } = await supabase.from(TABLE).select("id").eq("status", "pending");
  if (error) throw error;

  let provisioned = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    // The conditional update claims the request so a concurrent run can't provision it twice.
    const { data: claimed, error: claimError } = await supabase
      .from(TABLE)
      .update({ status: "processing" })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("pending_profile")
      .maybeSingle();
    if (claimError || !claimed) continue;

    const profileData = claimed.pending_profile as CreatedProfileData | null;
    if (!profileData) {
      await supabase.from(TABLE).update({ status: "expired" }).eq("id", row.id);
      failed++;
      continue;
    }

    try {
      // The temp password was dropped when the request was parked; the student sets their own.
      const profile = await provisionUser({ ...profileData, password: "" });
      await supabase
        .from(TABLE)
        .update({
          status: "approved",
          pending_profile: null,
          profile_id: profile.id,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      provisioned++;
    } catch (provisionError) {
      await supabase.from(TABLE).update({ status: "pending" }).eq("id", row.id);
      await logError(
        provisionError,
        { action: "provisionLegacyPendingConsentRequests", consentId: row.id },
        "consent_error",
      );
      failed++;
    }
  }

  return { provisioned, failed };
}
