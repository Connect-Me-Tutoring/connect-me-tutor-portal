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
    // 1 = Monday, in UTC to match the database's current_date. A write on any other
    // day means the week's earlier run(s) failed and this one recovered the point,
    // which is worth seeing in PostHog.
    const dayOfWeek = new Date().getUTCDay();

    // Exception: the very first capture after deploy. It lands on whatever day the
    // deploy happened, and that is not a recovery. It is the first point in the series.
    let isFirstSnapshot = false;
    if (captured) {
      const { count, error: countError } = await supabase
        .from("pairing_length_snapshots")
        .select("captured_on", { count: "exact", head: true });
      // Telemetry only: the snapshot is already written, so a failed count must not
      // turn a successful run into a 500. Fall back to the plain day-of-week rule.
      if (countError) {
        await logError(countError, {}, "cron_pairing_length_snapshot_count_error");
      } else {
        // If the table holds no more rows than this run just wrote, this run is the
        // whole series.
        isFirstSnapshot = (count ?? 0) <= rows;
      }
    }

    const recoveredMissedRun = captured && dayOfWeek !== 1 && !isFirstSnapshot;

    await logEvent("pairing_length_snapshot_run", {
      rows,
      captured,
      recoveredMissedRun,
      isFirstSnapshot,
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
