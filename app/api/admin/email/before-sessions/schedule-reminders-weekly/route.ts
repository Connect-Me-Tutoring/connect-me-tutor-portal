import { NextRequest, NextResponse } from "next/server";
import { Session } from "@/types";
import { sendScheduledEmailsBeforeSessions } from "@/lib/actions/email/server.actions";
import { getSessions } from "@/lib/actions/session/server.actions";
import { addDays } from "date-fns";
import { isCronRequestAuthorized } from "@/lib/security/cron";
import { logError } from "@/lib/posthog";
import { logUnauthorizedAccess } from "@/lib/security/log-unauthorized-access";

export const dynamic = "force-dynamic";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    await logUnauthorizedAccess(request, "admin/email/before-sessions/schedule-reminders-weekly");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const now = new Date();
    const weekLater = addDays(now, 7);
    const sessionsNextWeek: Session[] = await getSessions(
      now.toISOString(),
      weekLater.toISOString(),
    );
    const batchSize = 50;
    const delayBetweenBatches = 1000;
    for (let i = 0; i < sessionsNextWeek.length; i += batchSize) {
      const batch = sessionsNextWeek.slice(i, i + batchSize);
      await sendScheduledEmailsBeforeSessions(batch);
      if (i + batchSize < sessionsNextWeek.length) {
        await delay(delayBetweenBatches);
      }
    }
    return NextResponse.json({
      status: 200,
      message: "weekly email notifications scheduled successfully",
    });
  } catch (error) {
    console.error("Cron job schedule-reminders-weekly failed:", error);
    await logError(error, {}, "cron_schedule_reminders_weekly_error");
    return NextResponse.json({
      status: 500,
      message: "weekly email notifications failed",
    });
  }
}
