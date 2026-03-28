"use server";
import { Profile, Session } from "@/types";
import { Client } from "@upstash/qstash";
import StudentPairingConfirmationEmail from "@/components/emails/student-confirmation-email";
import { render } from "@react-email/components";
import React from "react";
import { Resend } from "resend";
import PairingRequestNotificationEmail from "@/components/emails/pairing-request-notification";
import TutorPairingConfirmationEmail from "@/components/emails/tutor-confirmation-email";
import {
  PairingConfirmationEmailProps,
  PairingRequestNotificationEmailProps,
} from "@/types/email";
import { createClient } from "../supabase/server";
import { parseISO, subMinutes } from "date-fns";
import StudentRescheduleNotificationEmail, {
  SessionRescheduleEmailProps,
} from "@/components/emails/student-reschedule-notification";

export const fetchScheduledMessages = async () => {
  const qstash = new Client({ token: process.env.EU_CENTRAL_1_QSTASH_TOKEN });

  const messages = await qstash.schedules.list();
  return messages;
};

/**
 * Sends requests to an API endpoint to schedule reminder emails for a list of sessions.
 *
 * @param sessions - An array of Session objects for which to schedule emails.
 * @returns A promise that resolves when all scheduling requests have been attempted.
 * @throws Will throw an error if any API request fails and is not caught internally.
 */
export async function sendScheduledEmailsBeforeSessions(
  sessions: Session[],
): Promise<void> {
  try {
    // Use Promise.all for parallel execution or for...of for sequential
    await Promise.all(
      sessions.map(async (session) => {
        // Check if session has a tutor
        if (!session.tutor) {
          console.warn(`Session ${session.id} has no tutor assigned`);
          return;
        }

        if (!session.student) {
          console.warn(`Session ${session.id} has no student assigned`);
          return;
        }

        try {
          await scheduleReminder({ session: session, type: "Tutor" });
          await scheduleReminder({ session: session, type: "Student" });
        } catch (error) {
          console.error("Error processing session %s:", session.id, error);
        }
      }),
    );
  } catch (error) {
    console.error("Error scheduling session emails", error);
    throw error;
  }
}

/**
 * Updates a scheduled reminder email for a session by deleting the old one and scheduling a new one.
 *
 * @param session - The Session object with updated details.
 * @returns A promise that resolves when the update process is complete.
 * @throws Will throw an error if deletion or scheduling fails.
 */
export async function updateScheduledEmailBeforeSessions(session: Session) {
  try {
    await deleteScheduledEmailBeforeSessions(session.id);
    await sendScheduledEmailsBeforeSessions([session]);
  } catch (error) {
    console.error("Unable to update scheduled message");
    throw error;
  }
}

/**
 * Sends a request to an API endpoint to delete a scheduled reminder email for a specific session.
 *
 * @param sessionId - The ID of the session whose scheduled email is to be deleted.
 * @returns A promise that resolves when the deletion request has been attempted.
 * @throws Will throw an error if the API request fails.
 */
export async function deleteScheduledEmailBeforeSessions(sessionId: string) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL}/api/admin/email/before-sessions/delete-reminder`,
      {
        method: "POST",
        body: JSON.stringify({ sessionId }),
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error("Unable to delete scheduled email");
    }
  } catch (error) {
    console.error("Unable to delete message");
    // throw error;
  }
}

export async function deleteMsg(messageId: string) {
  const qstash = new Client({ token: process.env.EU_CENTRAL_1_QSTASH_TOKEN });
  try {
    await qstash.messages.delete(messageId);
  } catch (qstashError: any) {
    console.warn("Failed to delete message from QStash");
  }
}

export async function scheduleEmail({
  notBefore,
  to,
  subject,
  body,
  sessionId,
}: {
  notBefore: number;
  to: string;
  subject: string;
  body: string;
  sessionId: string;
}) {
  try {
    const qstash = new Client({ token: process.env.EU_CENTRAL_1_QSTASH_TOKEN });
    const result = await qstash.publishJSON({
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/admin/email/send-email-reminder`,
      notBefore: notBefore,
      body: {
        to: to,
        subject: subject,
        body: body,
        sessionId: sessionId,
      },
      headers: {
        authorization: `Bearer ${process.env.BEARER_TOKEN}`,
      },
    });

    if (result && result.messageId) {
    }
    return result;
  } catch (error) {
    console.error("Unable to schedule email");
    throw error;
  }
}

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendStudentPairingConfirmationEmail(
  data: PairingConfirmationEmailProps,
  emailTo: string,
) {
  const emailHtml = await render(
    React.createElement(StudentPairingConfirmationEmail, data),
  );
  const emailResult = await resend.emails.send({
    from: "Connect Me Free Tutoring & Mentoring <pairings@connectmego.app>",
    to: "ahu@connectmego.org",
    cc: ["ahu@connectmego.org"],
    subject: "You Have Been Matched!",
    html: emailHtml,
  });

  return emailResult;
}

export async function sendPairingRequestEmail(
  data: PairingRequestNotificationEmailProps,
  emailTo: string,
) {
  const emailHtml = await render(
    React.createElement(PairingRequestNotificationEmail, data),
  );

  const emailResult = await resend.emails.send({
    from: "reminder@connectmego.app",
    to: "ahu@connectmego.org",
    cc: ["ahu@connectmego.org", "aaronmarsh755@gmail.com"],
    subject: "Connect Me Pairing Request",
    html: emailHtml,
  });
  return emailResult;
}

export async function sendTutorPairingConfirmationEmail(
  data: PairingConfirmationEmailProps,
  emailTo: string,
) {
  const emailHtml = await render(
    React.createElement(TutorPairingConfirmationEmail, data),
  );
  const emailResult = await resend.emails.send({
    from: "Connect Me Free Tutoring & Mentoring <confirmation@connectmego.app>",
    to: "ahu@connectmego.org",
    cc: ["", "ahu@connectmego.org"],
    subject: "Confirmed for Tutoring",
    html: emailHtml,
  });

  return emailResult;
}

export async function sendSessionRescheduleEmail(
  data: SessionRescheduleEmailProps,
  emailTo: string,
) {
  const emailHtml = await render(
    React.createElement(StudentRescheduleNotificationEmail, data),
  );

  const emailResult = await resend.emails.send({
    from: "Connect Me Free Tutoring & Mentoring <notifications@connectmego.app>",
    to: emailTo,
    cc: ["ahu@connectmego.org"], // keeping consistent with other email methods for visibility
    subject: "Your Tutoring Session Has Been Rescheduled",
    html: emailHtml,
  });

  return emailResult;
}

export const sendEmail = async (
  from: string,
  to: string,
  subject: string,
  body: string,
) => {
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    await resend.emails.send({
      from: from,
      to: to,
      subject: subject,
      html: body,
    });
  } catch (error) {
    console.error("Unable to send email", error);
    throw error;
  }
};

export const sendEmailTest = async (
  from: string,
  to: string,
  subject: string,
  body: string,
) => {
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    await resend.emails.send({
      from: from,
      to: ["amansreejesh9@gmail.com", "ahu@connectmego.org"],
      subject: subject,
      html: body,
    });
  } catch (error) {
    console.error("Unable to send email", error);
    throw error;
  }
};

export const scheduleReminder = async (data: {
  session: Session;
  type: "Tutor" | "Student";
}) => {
  try {
    const supabase = await createClient();

    const session: Session = data.session;
    const tutor: Profile | null = session.tutor;
    const student: Profile | null = session.student;
    const type: "Tutor" | "Student" = data.type;

    if (!tutor || !student) {
      throw new Error("No identified tutor or student");
    }

    //* Uncomment in production
    const sessionDate = parseISO(session.date);
    const scheduledTime = subMinutes(sessionDate, 15);
    const message = createSessionNotification(session, tutor, student, type);
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

    return {
      status: 200,
      message: "Email reminder scheduled successfully",
      messageId: result.messageId,
    };
  } catch (error) {
    console.error("Error scheduling reminder", error);
    throw error;
  }
};

/**
 * @param session Session Details
 * @param tutor Details about the tutor
 * @param student Details about the student
 *
 *
 * @returns email notification message
 */

const createSessionNotification = (
  session: Session,
  tutor: Profile,
  student: Profile,
  type: "Tutor" | "Student",
) => {
  const tutorName: string = tutor
    ? ` ${tutor.firstName} ${tutor.lastName}`
    : "";
  const studentName: string = student
    ? `${student.firstName} ${student.lastName}`
    : "your student";

  if (type === "Tutor") {
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
  }

  return `
      <p>Hi ${studentName},<br><br>
  
      This is a reminder that your tutoring session with ${tutorName} starts in <strong>15 minutes</strong>!<br><br>
  
      Here's the Zoom link to the meeting:<br>
      <a href="${session.meeting?.link}">Join Zoom Meeting</a><br><br>
  
      If you have any questions, feel free to reach out to your Tutor!<br><br>
  
      Best,<br>
      The Connect Me Free Tutoring & Mentoring Team
      </p>
      `;
};
