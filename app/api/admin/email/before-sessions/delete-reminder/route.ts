import { NextRequest, NextResponse } from "next/server";
// import { createClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { deleteMsg } from "@/lib/actions/email/server.actions";
import { verifyAdmin } from "@/lib/actions/auth/server.actions";
import { logError } from "@/lib/posthog";
import { Table } from "@/lib/supabase/tables";

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

    const { data: reminders, error: fetchError } = await supabase
      .from(Table.SessionReminders)
      .select("id, message_id")
      .eq("session_id", sessionId)
      .eq("description", "Session Reminder");

    if (fetchError) {
      console.error("Error fetching messageIds", fetchError);
      await logError(fetchError, { sessionId }, "email_delete_reminder_error");
      throw fetchError;
    }

    if (!reminders || reminders.length === 0) {
      return NextResponse.json({ message: "No scheduled email found" }, { status: 200 });
    }

    await Promise.all(
      reminders.flatMap((reminder) =>
        reminder.message_id ? [deleteMsg(reminder.message_id)] : [],
      ),
    );

    const { error: deleteDbError } = await supabase
      .from(Table.SessionReminders)
      .delete()
      .in(
        "id",
        reminders.map((reminder) => reminder.id),
      );

    if (deleteDbError) {
      console.error("Error deleting reminder records from Supabase:", deleteDbError);
      await logError(deleteDbError, { sessionId }, "email_delete_reminder_error");
      throw deleteDbError;
    }

    return NextResponse.json({
      status: 200,
      message: "Email reminders deleted successfully",
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
