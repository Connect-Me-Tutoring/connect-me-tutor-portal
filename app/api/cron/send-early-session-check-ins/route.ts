import { NextRequest, NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { sendEarlySessionCheckInEmails } from "@/lib/actions/email.server.actions";

export const dynamic = "force-dynamic";

const EASTERN_TIMEZONE = "America/New_York";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const easternHour = formatInTimeZone(new Date(), EASTERN_TIMEZONE, "H");
  if (easternHour !== "12") {
    return NextResponse.json({
      message: "Skipping early session check-in run outside noon Eastern",
      checked: 0,
      sent: 0,
      skipped: 0,
    });
  }

  try {
    const result = await sendEarlySessionCheckInEmails();

    return NextResponse.json({
      message: "Early session check-ins processed successfully",
      ...result,
    });
  } catch (error) {
    console.error("Unable to process early session check-ins:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
