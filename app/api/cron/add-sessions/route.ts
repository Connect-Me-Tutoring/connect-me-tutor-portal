import { NextResponse } from "next/server";
import { startOfWeek, endOfWeek } from "date-fns";
import {
  addSessionsServer,
  getAllSessionsServer,
} from "@/lib/actions/session.server.actions";
import { getAllActiveEnrollmentsServer } from "@/lib/actions/enrollment.server.actions";
import { isCronRequestAuthorized } from "@/lib/security/cron";

export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const now = new Date();
    const weekStartString = startOfWeek(now, { weekStartsOn: 0 }).toISOString();
    const weekEndString = endOfWeek(now, { weekStartsOn: 0 }).toISOString();

    const enrollments = await getAllActiveEnrollmentsServer(weekEndString);
    const sessions = await getAllSessionsServer(weekStartString, weekEndString);

    const createdSessions = await addSessionsServer(
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
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
