import { NextResponse } from "next/server";
import { sendMail } from "@/lib/email/mailer";
import FeedbackEmail from "@/components/emails/feedback/student-feedback-email";
import { verifyAdmin } from "@/lib/actions/auth/server.actions";
import { requireSelfOrAdmin } from "@/lib/actions/auth/authz.server";
import { logError } from "@/lib/posthog";

export async function POST(request: Request) {
  try {
    const { studentEmail, studentName, userId } = await request.json();

    await requireSelfOrAdmin(userId);

    if (!studentEmail) {
      return NextResponse.json({ error: "Student email is required" }, { status: 400 });
    }

    await sendMail({
      from: "Connect Me Free Tutoring & Mentoring <notifications@connectmego.app>",
      to: studentEmail,
      cc: [process.env.OPERATIONS_EMAIL!],
      subject: "Please provide feedback for your recent session",
      react: FeedbackEmail({ studentName }),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending email:", error);
    await logError(error, {}, "email_student_sef_feedback_error");
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
