import { getAllActiveEnrollmentsForCron } from "@/lib/actions/enrollment.server.actions";
import { NextRequest, NextResponse } from "next/server";
import { addSessionsForCron, getAllSessionsForCron } from "@/lib/actions/session.server.actions";
import { Session } from "@/types";
import { getEasternWeekBounds } from "@/lib/utils";
import { isCronRequestAuthorized } from "@/lib/security/cron";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const newSessions = await handleUpdateWeek();

    return NextResponse.json({ newSessions: newSessions }, { status: 200 });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: `Update Week error ${err.message}` }, { status: 500 });
  }
}

const handleUpdateWeek = async (): Promise<Session[]> => {
  try {
    const today = new Date();

    const weekBounds = getEasternWeekBounds(today);
    const weekStart = weekBounds.weekStart.toISOString();
    const weekEnd = weekBounds.weekEnd.toISOString();

    const enrollments = await getAllActiveEnrollmentsForCron(weekEnd);
    const sessions: Session[] = await getAllSessionsForCron(weekStart, weekEnd, "date", true);

    const newSessions = await addSessionsForCron(weekStart, weekEnd, enrollments, sessions);
    if (!newSessions) {
      throw new Error("No sessions were created");
    }
    return newSessions;
  } catch (error: any) {
    console.error("Failed to add sessions:", error);
    throw error;
  }
};
