import { NextRequest, NextResponse } from "next/server";
import { sendWaitlistStatusEmails } from "@/lib/email/waitlist-status";
import { isCronRequestAuthorized } from "@/lib/security/cron";
import { logError, logEvent } from "@/lib/posthog";
import { logUnauthorizedAccess } from "@/lib/security/log-unauthorized-access";

export const dynamic = "force-dynamic";

/** Daily: emails parents of students added 4 days ago who still have no tutor. */
export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    await logUnauthorizedAccess(request, "cron/send-waitlist-status-emails");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendWaitlistStatusEmails();
    await logEvent("waitlist_status_emails_run", result);
    return NextResponse.json({ message: "Waitlist status emails processed", ...result });
  } catch (error) {
    console.error("Unable to process waitlist status emails:", error);
    await logError(error, {}, "cron_waitlist_status_emails_error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
