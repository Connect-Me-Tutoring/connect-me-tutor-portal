import { NextRequest, NextResponse } from "next/server";
// import { createClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { deleteMsg } from "@/lib/actions/email.server.actions";
import { verifyAdmin } from "@/lib/actions/auth.server.actions";
import { logError } from "@/lib/posthog";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await verifyAdmin();
    const supabase = await createClient();

    const data = await request.json();
    const sessionId = data.sessionId;

    if (!sessionId) {
      return NextResponse.json(
        {
          message: "SessionId is required",
        },
        { status: 400 },
      );
    }

    const { data: emailData, error: fetchError } = await supabase
      .from("Emails")
      .select("id, message_id")
      .eq("session_id", sessionId)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return NextResponse.json(
          {
            message: "No scheduled email found",
          },
          {
            status: 200,
          },
        );
      }
      console.error("Error fetching messageId", fetchError);
      await logError(fetchError, { sessionId }, "email_delete_reminder_error");
      throw fetchError;
    }

    if (!emailData || !emailData.message_id) {
      console.error("No Scheduled Email found");
      await logError(
        new Error("No scheduled email found"),
        { sessionId },
        "email_delete_reminder_error",
      );
      return NextResponse.json(
        { message: "Scheduled email found but no message_id" },
        { status: 404 },
      );
    }

    await deleteMsg(emailData.message_id);

    const { error: deleteDbError } = await supabase.from("Emails").delete().eq("id", emailData.id);

    if (deleteDbError) {
      console.error("Error deleting email record from Supabase:", deleteDbError);
      await logError(
        deleteDbError,
        { sessionId, emailId: emailData.id },
        "email_delete_reminder_error",
      );
      throw deleteDbError; // Let the generic catch handle it
    }

    return NextResponse.json({
      status: 200,
      message: "Email reminder scheduled successfully",
    });
  } catch (error) {
    console.error("Error deleting scheduled reminder");
    await logError(error, {}, "email_delete_reminder_error");
    return NextResponse.json({
      status: 500,
      message: "Unable to delete reminder",
    });
  }
}
