import { getProfileByEmail } from "@/lib/actions/user/client.actions";
import { Profile } from "@/types";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { sendMail } from "@/lib/email/mailer";
import { Table } from "@/lib/supabase/tables";
import { isAuthorized } from "@/lib/actions/auth/server.actions";
import { logError } from "@/lib/posthog";
import { logUnauthorizedAccess } from "@/lib/security/log-unauthorized-access";
import { z } from "zod";

export const dynamic = "force-dynamic";

const emailSchema = z.object({
  to: z.string().trim(),
  subject: z.string().trim(),
  body: z.string().trim(),
  sessionId: z.string().trim(),
});

export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthorized(request))) {
      await logUnauthorizedAccess(request, "admin/email/send-email-reminder");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    const data = await request.json();
    const { to, subject, body, sessionId } = emailSchema.parse(data);

    const { data: session, error: sessionError } = await supabase
      .from(Table.Sessions)
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({
        status: 404,
        message: "Session no longer exists",
      });
    }

    if (session.status === "Cancelled") {
      return NextResponse.json({
        status: 400,
        message: "Session no longer active",
      });
    }

    const recipient: Profile | null = await getProfileByEmail(to);

    if (!recipient) throw new Error("Unable to get recipient details");

    const { data: notification_settings, error } = await supabase
      .from("user_notification_settings")
      .select("email_tutoring_session_notifications_enabled")
      .eq("id", recipient.settingsId)
      .single();

    if (error) throw error;
    if (!notification_settings) throw new Error("No Notification Settings");

    if (notification_settings.email_tutoring_session_notifications_enabled) {
      await sendMail({
        from: "Connect Me Free Tutoring & Mentoring <reminder@connectmego.app>",
        to: to,
        cc: [process.env.OPERATIONS_EMAIL!],
        subject: subject,
        html: body,
      });
      return NextResponse.json({
        status: 200,
        message: "Email sent successfully",
      });
    }
    return NextResponse.json({
      status: 200,
      message: "Email setting turned off",
    });
  } catch (error) {
    console.error("Error sending email:", error);
    await logError(error, {}, "email_send_reminder_error");
    return NextResponse.json({
      status: 500,
      error: error,
      message: "Unable to send email or fetch email settings",
    });
  }
}
