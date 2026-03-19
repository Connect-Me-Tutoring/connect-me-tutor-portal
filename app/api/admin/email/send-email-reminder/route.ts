import { getProfileByEmail } from "@/lib/actions/user.actions";
import { Profile } from "@/types";
import { SupabaseAuthClient } from "@supabase/supabase-js/dist/module/lib/SupabaseAuthClient";
import { request } from "http";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { ideahub } from "googleapis/build/src/apis/ideahub";
import { getSupabase } from "@/lib/supabase-server/serverClient";
import { Table } from "@/lib/supabase/tables";
import { isAuthorized, verifyAdmin } from "@/lib/actions/auth.server.actions";
import { z } from "zod";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

const emailSchema = z.object({
  to: z.string().trim(),
  subject: z.string().trim(),
  body: z.string().trim(),
  sessionId: z.string().trim(),
});

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) return;

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
      await resend.emails.send({
        from: "Connect Me Free Tutoring & Mentoring <reminder@connectmego.app>",
        to: to,
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
    return NextResponse.json({
      status: 500,
      error: error,
      message: "Unable to send email or fetch email settings",
    });
  }
}
