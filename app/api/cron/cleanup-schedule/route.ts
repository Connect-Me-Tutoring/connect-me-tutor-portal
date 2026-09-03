import { NextRequest, NextResponse } from "next/server";
import { markUnconfirmedSEFCron } from "@/lib/actions/session/server.actions";
import {
  deleteInactiveEnrollments,
  warnInactiveEnrollments,
  warnInactiveEnrollmentsEarly,
} from "@/lib/actions/enrollment/server.actions";
import { isCronRequestAuthorized } from "@/lib/security/cron";
import { logError } from "@/lib/posthog";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isCronRequestAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.ENABLE_CLEANUP_SCHEDULE !== "TRUE") {
    return NextResponse.json({ message: "Cleanup schedule disabled" }, { status: 200 });
  }

  const results = {
    markUnconfirmedSEF: {
      success: false,
      unconfirmed: 0,
      error: undefined as string | undefined,
    },
    warnInactiveEnrollmentsEarly: {
      warned: 0,
      error: undefined as string | undefined,
    },
    warnInactiveEnrollments: {
      warned: 0,
      error: undefined as string | undefined,
    },
    deleteInactiveEnrollments: {
      success: false as boolean,
      deleted: 0,
      error: undefined as string | undefined,
    },
  };

  try {
    // Task 1: Mark sessions with unsubmitted SEFs as Unconfirmed
    const unconfirmedResult = await markUnconfirmedSEFCron();
    results.markUnconfirmedSEF = unconfirmedResult;

    // Task 2a: Early-warn inactive enrollments (3+ weeks missing SEF)
    const earlyWarnResult = await warnInactiveEnrollmentsEarly();
    results.warnInactiveEnrollmentsEarly = {
      warned: earlyWarnResult.length,
      error: undefined,
    };

    // Task 2b: Warn inactive enrollments (4+ weeks missing SEF)
    const warnResult = await warnInactiveEnrollments();
    results.warnInactiveEnrollments = {
      warned: warnResult.length,
      error: undefined,
    };

    // Task 3: Delete inactive enrollments (5+ weeks missing SEF)
    const deleteResult = await deleteInactiveEnrollments();
    results.deleteInactiveEnrollments = deleteResult;
  } catch (error) {
    console.error("Cron job cleanup-schedule failed:", error);
    await logError(error, { results }, "cron_cleanup_schedule_error");
    return NextResponse.json(
      { message: "Cleanup failed", error: "Internal Server Error", results },
      { status: 500 },
    );
  }

  const hasErrors =
    !results.markUnconfirmedSEF.success || !results.deleteInactiveEnrollments.success;

  if (hasErrors) {
    console.error("Cron job cleanup-schedule completed with errors:", results);
    await logError(
      new Error("cleanup-schedule cron completed with errors"),
      { results },
      "cron_cleanup_schedule_error",
    );
  }

  return NextResponse.json(
    {
      message: hasErrors ? "Cleanup completed with errors" : "Cleanup completed successfully",
      results,
    },
    { status: hasErrors ? 207 : 200 },
  );
}
