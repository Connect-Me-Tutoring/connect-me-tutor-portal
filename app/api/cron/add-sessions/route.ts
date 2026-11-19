import { NextResponse } from "next/server";
import { addDays } from "date-fns";
import { addSessionsForCron, getAllSessionsForCron } from "@/lib/actions/session/server.actions";
import { getAllActiveEnrollmentsForCron } from "@/lib/actions/enrollment/server.actions";
import { isCronRequestAuthorized } from "@/lib/security/cron";
import { getEasternWeekBounds } from "@/lib/utils";
import { logError } from "@/lib/posthog";
import { logUnauthorizedAccess } from "@/lib/security/log-unauthorized-access";

export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    await logUnauthorizedAccess(request, "cron/add-sessions");
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    // vercel.json fires this Sunday 00:00 UTC, which is still Saturday evening in
    // New York, so "now" falls in the week that is ending. Build the coming week instead.
    const { weekStart, weekEnd } = getEasternWeekBounds(addDays(new Date(), 1));
    const weekStartString = weekStart.toISOString();
    const weekEndString = weekEnd.toISOString();

    const enrollments = await getAllActiveEnrollmentsForCron(weekEndString);
    const sessions = await getAllSessionsForCron(weekStartString, weekEndString);

    const createdSessions = await addSessionsForCron(
      weekStartString,
      weekEndString,
      enrollments,
      sessions,
    );

    return NextResponse.json({
      success: true,
      createdCount: createdSessions.length,
    });
  } catch (error) {
    console.error("Cron job add-sessions failed:", error);
    await logError(error, {}, "cron_add_sessions_error");
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
