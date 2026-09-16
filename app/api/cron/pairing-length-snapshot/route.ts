import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { isCronRequestAuthorized } from "@/lib/security/cron";
import { logError, logEvent } from "@/lib/posthog";
import { logUnauthorizedAccess } from "@/lib/security/log-unauthorized-access";

export const dynamic = "force-dynamic";

/**
 * Records one pairing-length data point per population (active / ended / all).
 *
 * Runs DAILY but writes WEEKLY: ensure_weekly_pairing_length_snapshot() inserts
 * only if the current week has no point yet. Vercel does not retry failed crons,
 * so a daily schedule lets Tuesday cover for a failed Monday and the week is
 * never lost. Returns rows written, so 0 is the normal expected result on every
 * day after the week's first successful run.
 *
 * This history cannot be rebuilt after the fact, since unpairing hard-deletes the
 * Pairings row, so a week in which no run succeeds is permanently missing.
 */
export async function GET(req: NextRequest) {
  if (!isCronRequestAuthorized(req)) {
    await logUnauthorizedAccess(req, "cron/pairing-length-snapshot");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase.rpc("ensure_weekly_pairing_length_snapshot");

    if (error) throw error;

    const rows = data ?? 0;
    const captured = rows > 0;
    // 1 = Monday. A write on any other day means the week's earlier run(s) failed
    // and this one recovered the point, which is worth seeing in PostHog.
    const dayOfWeek = new Date().getUTCDay();
    const recoveredMissedRun = captured && dayOfWeek !== 1;

    await logEvent("pairing_length_snapshot_run", {
      rows,
      captured,
      recoveredMissedRun,
      dayOfWeek,
    });

    return NextResponse.json(
      {
        message: captured
          ? "Pairing length snapshot captured"
          : "Pairing length snapshot already recorded for this week",
        rows,
        recoveredMissedRun,
      },
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
