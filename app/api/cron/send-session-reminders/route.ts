import { NextRequest, NextResponse } from "next/server";
import { addMinutes } from "date-fns";
import { createAdminClient } from "@/lib/supabase/server";
import { Table } from "@/lib/supabase/tables";
import { sendScheduledEmailsBeforeSessions } from "@/lib/actions/email/server.actions";
import { tableToInterfaceSessions } from "@/lib/utils/type-utils";
import { isCronRequestAuthorized } from "@/lib/security/cron";
import { logError } from "@/lib/posthog";
import { logUnauthorizedAccess } from "@/lib/security/log-unauthorized-access";

export const dynamic = "force-dynamic";

// Reminders go out 15 minutes before the session. Looking 20 minutes ahead with a 5 minute
// cron means every session is seen at least once; scheduleReminder skips recipients that
// already have a session_reminders row, so repeat sightings don't double-send.
const LOOKAHEAD_MINUTES = 20;

export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    await logUnauthorizedAccess(request, "cron/send-session-reminders");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createAdminClient();
    const now = new Date();

    const { data, error } = await supabase
      .from(Table.Sessions)
      .select(
        `*,
         meeting:Meetings!meeting_id(*),
         student:Profiles!student_id(*),
         tutor:Profiles!tutor_id(*)`,
      )
      .gt("date", now.toISOString())
      .lte("date", addMinutes(now, LOOKAHEAD_MINUTES).toISOString())
      .not("status", "in", "(Cancelled,Complete,Expired)");

    if (error) throw error;

    const sessions = (data ?? [])
      .filter((session: any) => session.student && session.tutor)
      .map((session: any) => tableToInterfaceSessions(session));

    await sendScheduledEmailsBeforeSessions(sessions);

    return NextResponse.json({
      message: "Session reminders processed successfully",
      checked: sessions.length,
    });
  } catch (error) {
    console.error("Cron job send-session-reminders failed:", error);
    await logError(error, {}, "cron_send_session_reminders_error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
