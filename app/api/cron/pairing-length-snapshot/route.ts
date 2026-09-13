import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { isCronRequestAuthorized } from "@/lib/security/cron";
import { logError, logEvent } from "@/lib/posthog";
import { logUnauthorizedAccess } from "@/lib/security/log-unauthorized-access";

export const dynamic = "force-dynamic";

/**
 * Records one pairing-length data point per population (active / ended / all).
 *
 * Runs weekly. The capture is idempotent on (captured_on, population), so a retry
 * or a duplicate fire overwrites the day's point rather than duplicating it.
 *
 * This history cannot be rebuilt after the fact-->unpairing hard-deletes the
 * Pairings row-->so a week the job does not run is a week permanently missing
 * from the chart.
 */
export async function GET(req: NextRequest) {
  if (!isCronRequestAuthorized(req)) {
    await logUnauthorizedAccess(req, "cron/pairing-length-snapshot");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase.rpc("capture_pairing_length_snapshot");

    if (error) throw error;

    const rows = data ?? 0;
    await logEvent("pairing_length_snapshot_captured", { rows });

    return NextResponse.json(
      { message: "Pairing length snapshot captured", rows },
      { status: 200 },
    );
  } catch (error) {
    console.error("Cron job pairing-length-snapshot failed:", error);
    await logError(error, {}, "cron_pairing_length_snapshot_error");
    return NextResponse.json(
      { message: "Snapshot failed", error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
