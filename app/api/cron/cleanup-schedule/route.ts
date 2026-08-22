import { NextRequest, NextResponse } from "next/server";
import { markUnconfirmedSEFCron } from "@/lib/actions/session/server.actions";
import {
  deleteInactiveEnrollments,
  warnInactiveEnrollments,
} from "@/lib/actions/enrollment/server.actions";
import { isCronRequestAuthorized } from "@/lib/security/cron";

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

  // Task 1: Mark sessions with unsubmitted SEFs as Unconfirmed
  const unconfirmedResult = await markUnconfirmedSEFCron();
  results.markUnconfirmedSEF = unconfirmedResult;

  // Task 2: Warn inactive enrollments (5+ weeks missing SEF)
  const warnResult = await warnInactiveEnrollments();
  results.warnInactiveEnrollments = {
    warned: warnResult.length,
    error: undefined,
  };

  // Task 3: Delete inactive enrollments (6+ weeks missing SEF)
  const deleteResult = await deleteInactiveEnrollments();
  results.deleteInactiveEnrollments = deleteResult;

  const hasErrors =
    !results.markUnconfirmedSEF.success || !results.deleteInactiveEnrollments.success;

  return NextResponse.json(
    {
      message: hasErrors ? "Cleanup completed with errors" : "Cleanup completed successfully",
      results,
    },
    { status: hasErrors ? 207 : 200 },
  );
}
