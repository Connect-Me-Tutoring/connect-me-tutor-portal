import { createAdminClient } from "@/lib/supabase/server";
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
  scheduledFor: z.string().trim().optional(),
});

export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthorized(request))) {
      await logUnauthorizedAccess(request, "admin/email/send-email-reminder");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // QStash calls this with only a bearer token, no user session. A cookie-bound client runs
    // as anon, which RLS denies on Sessions, user_settings and user_notification_settings
    // (20260911000001_rls_enable_policies), so every lookup 401'd and no reminder was sent.
    const supabase = await createAdminClient();

    const data = await request.json();
    const { to, subject, body, sessionId, scheduledFor } = emailSchema.parse(data);

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

    // The session was moved after this reminder was queued; a replacement was (or will be)
    // scheduled for the new time, so this one is stale.
    if (
      scheduledFor &&
      session.date &&
      new Date(session.date).getTime() !== new Date(scheduledFor).getTime()
    ) {
      return NextResponse.json({
        status: 200,
        message: "Session time changed since reminder was scheduled",
      });
    }

    // Messages queued before scheduledFor existed can't be checked against the session time.
    // Their duplicates were dropped from session_reminders (never cancelled in QStash), so
    // only deliver if this message is still tracked.
    const messageId = request.headers.get("upstash-message-id");
    if (!scheduledFor && messageId) {
      const { data: tracked, error: trackedError } = await supabase
        .from(Table.SessionReminders)
        .select("id")
        .eq("message_id", messageId)
        .limit(1);
      if (trackedError) throw trackedError;
      if (!tracked || tracked.length === 0) {
        return NextResponse.json({
          status: 200,
          message: "Reminder is no longer tracked; skipping",
        });
      }
    }

    const { data: userSettings, error: userSettingsError } = await supabase
      .from("user_settings")
      .select("profile:Profiles!last_active_profile_id(settings_id)")
      .eq("email", to)
      .single();

    if (userSettingsError) throw userSettingsError;
    const settingsId = (userSettings?.profile as { settings_id: string | null } | null)
      ?.settings_id;
    if (!settingsId) throw new Error("Unable to get recipient details");

    const { data: notification_settings, error } = await supabase
      .from(Table.UserNotificationSettings)
      .select("email_tutoring_session_notifications_enabled")
      .eq("id", settingsId)
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
    // A real 500 lets QStash retry the delivery and shows the failure in its logs.
    return NextResponse.json(
      { message: "Unable to send email or fetch email settings" },
      { status: 500 },
    );
  }
}
