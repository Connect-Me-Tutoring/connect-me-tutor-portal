import { NextRequest, NextResponse } from "next/server";
import { cancelUnsubmittedSEFCron } from "@/lib/actions/session.server.actions";
import {
  deleteInactiveEnrollments,
  warnInactiveEnrollments,
} from "@/lib/actions/enrollment.server.actions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const results = {
    cancelUnsubmittedSEF: {
      success: false,
      cancelled: 0,
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

  // Task 1: Cancel unsubmitted SEFs
  const cancelResult = await cancelUnsubmittedSEFCron();
  results.cancelUnsubmittedSEF = cancelResult;

  // Task 2: Warn inactive enrollments (3+ weeks missing SEF)
  const warnResult = await warnInactiveEnrollments();
  results.warnInactiveEnrollments = {
    warned: warnResult.length,
    error: undefined,
  };

  // Task 3: Delete inactive enrollments (4+ weeks missing SEF)
  const deleteResult = await deleteInactiveEnrollments();
  results.deleteInactiveEnrollments = deleteResult;

  const hasErrors =
    !results.cancelUnsubmittedSEF.success ||
    !results.deleteInactiveEnrollments.success;

  return NextResponse.json(
    {
      message: hasErrors
        ? "Cleanup completed with errors"
        : "Cleanup completed successfully",
      results,
    },
    { status: hasErrors ? 207 : 200 },
  );
}
