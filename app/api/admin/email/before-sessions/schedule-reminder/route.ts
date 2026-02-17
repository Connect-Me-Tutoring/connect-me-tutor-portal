import { NextRequest, NextResponse } from "next/server";
import { Session } from "@/types";
import { Profile } from "@/types";
import { createClient } from "@/lib/supabase/server";
import { addMinutes, subMinutes, parseISO } from "date-fns";
import { scheduleEmail } from "@/lib/actions/email.server.actions";
import { getSupabase } from "@/lib/supabase-server/serverClient";
import { verifyAdmin } from "@/lib/actions/auth.server.actions";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await verifyAdmin();
    const supabase = await createClient();

    const data = await request.json();
    const session: Session = data.session;
    const tutor: Profile | null = session.tutor;
    const student: Profile | null = session.student;

    if (!tutor || !student) {
      throw new Error("No identified tutor or student");
    }

    //* Uncomment in production
    const sessionDate = parseISO(session.date);
    // const sessionDate = new Date();

    const scheduledTime = subMinutes(sessionDate, 15);

    const message = createMessage(session, tutor, student);

    const result = await scheduleEmail({
      notBefore: Math.floor(scheduledTime.getTime() / 1000),
      to: tutor.email,
      subject: "Upcoming Connect Me Session",
      body: message,
      sessionId: session.id,
    });

    if (result && result.messageId) {
      const { data, error } = await supabase
        .from("Emails")
        .insert({
          recipient_id: tutor?.id ?? null,
          session_id: session.id,
          message_id: result.messageId,
          description: "Session Reminder",
        })
        .select();

      if (error) {
        console.error("Supabase insert error", error);
        throw error;
      }
      if (!data) {
        throw new Error("Unable to record scheduled message");
      }
    }

    return NextResponse.json({
      status: 200,
      message: "Email reminder scheduled successfully",
      messageId: result.messageId,
    });
  } catch (error) {
    console.error("Error scheduling reminder", error);
    return NextResponse.json({
      status: 500,
      message: "Unable to reschedule email",
    });
  }
}

/**
 * @param session Session Details
 * @param tutor Details about the tutor
 * @param student Details about the student
 *
 *
 * @returns email notification message
 */

const createMessage = (session: Session, tutor: Profile, student: Profile) => {
  const tutorName: string = tutor
    ? ` ${tutor.firstName} ${tutor.lastName}`
    : "";
  const studentName: string = student
    ? `${student.firstName} ${student.lastName}`
    : "your student";

  return `
    <p>Hi ${tutorName},<br><br>

    This is a reminder that your tutoring session with ${studentName} starts in <strong>15 minutes</strong>!<br><br>

    Remember to visit the <a href="https://www.connectmego.app/">Connect Me Tutor Portal</a> and fill out a Session Exist Form (SEF) once the session is complete.<br><br>

    Here's the Zoom link to the meeting:<br>
    <a href="${session.meeting?.link}">Join Zoom Meeting</a><br><br>

    If you need to cancel, reschedule, or add additional sessions, you can do everything through the portal:<br>
    <a href="https://www.connectmego.app/">https://www.connectmego.app/</a><br><br>

    For more details, you can reference the Connect Me Guidebook:<br>
    <a href="https://drive.google.com/file/d/1vk9neT5FzDfk2ICpW6aeP5B_OL06te8i/view">
        Connect Me Guidebook
    </a><br><br>

    If you have any questions, feel free to reach out to us on Discord!<br><br>

    Best,<br>
    The Connect Me Free Tutoring & Mentoring Team
    </p>
    `;
};
