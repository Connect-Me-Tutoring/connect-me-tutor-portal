import { NextResponse } from "next/server";
import { sendMail } from "@/lib/email/mailer";
import FeedbackEmail from "@/components/emails/feedback/student-feedback-email";
import { requireSelfOrAdmin } from "@/lib/actions/auth/authz.server";
import { logError } from "@/lib/posthog";
import { createAdminClient } from "@/lib/supabase/server";
import { Table } from "@/lib/supabase/tables";
import { format } from "date-fns";

const FEEDBACK_THROTTLE_HOURS = 24;

export async function POST(request: Request) {
  try {
    const { studentEmail, studentName, userId, sessionDate } = await request.json();

    await requireSelfOrAdmin(userId);

    if (!studentEmail) {
      return NextResponse.json({ error: "Student email is required" }, { status: 400 });
    }

    const trimmedEmail = studentEmail.trim().toLowerCase();

    // Throttling: If the student was already sent a session feedback email within the
    // throttle window (e.g., when a tutor submits a backlog of SEFs in quick succession),
    // skip sending duplicate feedback emails to prevent spamming the student.
    const supabase = await createAdminClient();
    const cooldownStart = new Date(
      Date.now() - FEEDBACK_THROTTLE_HOURS * 60 * 60 * 1000,
    ).toISOString();

    const { data: recentFeedback, error: checkError } = await supabase
      .from(Table.Emails)
      .select("id")
      .ilike("recipient_email", trimmedEmail)
      .ilike("subject", "%feedback%")
      .gte("created_at", cooldownStart)
      .limit(1);

    if (checkError) {
      console.warn("Could not check recent feedback emails:", checkError);
    } else if (recentFeedback && recentFeedback.length > 0) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: "Feedback email already sent within the last 24 hours; throttled duplicate.",
      });
    }

    let subject = "Please provide feedback for your recent session";
    if (sessionDate) {
      try {
        const parsedDate = new Date(sessionDate);
        if (!Number.isNaN(parsedDate.getTime())) {
          subject = `Please provide feedback for your session on ${format(parsedDate, "MMM d, yyyy")}`;
        }
      } catch {
        // Fall back to default subject
      }
    }

    await sendMail({
      from: "Connect Me Free Tutoring & Mentoring <notifications@connectmego.app>",
      to: studentEmail,
      cc: [process.env.OPERATIONS_EMAIL!],
      subject,
      react: FeedbackEmail({ studentName }),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending email:", error);
    await logError(error, {}, "email_student_sef_feedback_error");
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
