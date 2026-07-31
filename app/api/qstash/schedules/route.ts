import { NextRequest, NextResponse } from "next/server";
import { fetchScheduledMessages } from "@/lib/actions/email/server.actions";
import { verifyAdmin } from "@/lib/actions/auth/server.actions";
import { logError } from "@/lib/posthog";

export async function GET(request: NextRequest) {
  try {
    await verifyAdmin();
    const messages = await fetchScheduledMessages();

    return NextResponse.json({
      success: true,
      messages: messages,
      count: messages.length,
    });
  } catch (error) {
    console.error("Error fetching scheduled messages:", error);
    await logError(error, {}, "qstash_schedules_error");
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch scheduled messages",
      },
      { status: 500 },
    );
  }
}
