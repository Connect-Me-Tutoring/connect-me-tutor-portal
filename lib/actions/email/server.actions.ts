"use server";
import { Enrollment, Profile, Session } from "@/types";
import { Client } from "@upstash/qstash";
import StudentPairingConfirmationEmail from "@/components/emails/pairing-request/student-confirmation-email";
import { render } from "@react-email/components";
import React from "react";
import { sendMail } from "@/lib/email/mailer";
import PairingRequestNotificationEmail from "@/components/emails/pairing-request/pairing-request-notification";
import TutorPairingConfirmationEmail from "@/components/emails/pairing-request/tutor-confirmation-email";
import {
  EarlySessionCheckInEmailProps,
  PairingConfirmationEmailProps,
  PairingRequestNotificationEmailProps,
} from "@/types/email";
import MonthlyCheckInEmail from "@/components/emails/check-in/monthly-check-in-email";
import { createAdminClient, createClient } from "../../supabase/server";
import { parseISO, subMinutes } from "date-fns";
import StudentRescheduleNotificationEmail, {
  SessionRescheduleEmailProps,
} from "@/components/emails/rescheduling/student-reschedule-notification";
import StudentSessionCancellationNotificationEmail, {
  StudentSessionCancellationEmailProps,
} from "@/components/emails/cancellation/student-session-cancellation-notification";
import TutorSessionCancellationNotificationEmail, {
  TutorSessionCancellationEmailProps,
} from "@/components/emails/cancellation/tutor-session-cancellation-notification";
import ChatMessageNotificationEmail, {
  type ChatMessageNotificationEmailProps,
} from "@/components/emails/chats/chat-message-notification";
import { withRetry } from "@/lib/utils";
import EarlySessionCheckInEmail from "@/components/emails/check-in/early-session-check-in-email";
import { getAllActiveEnrollmentsForCron } from "../enrollment/server.actions";
import { Table } from "../../supabase/tables";
import { formatInTimeZone } from "date-fns-tz";
import { requireAdmin, requireSessionAccess } from "../auth/authz.server";
import { logError } from "@/lib/posthog";

const SESSION_REMINDER_DESCRIPTION = "Session Reminder";

export const fetchScheduledMessages = async () => {
  await requireAdmin();
  const qstash = new Client({ token: process.env.US_EAST_1_QSTASH_TOKEN });

  const messages = await withRetry(() => qstash.schedules.list(), {
    onRetry: async (error, attempt) => {
      console.error(`fetchScheduledMessages attempt ${attempt + 1} failed:`, error);
      await logError(error, { attempt }, "email_error");
    },
  });
  return messages;
};

/**
 * Sends requests to an API endpoint to schedule reminder emails for a list of sessions.
 *
 * @param sessions - An array of Session objects for which to schedule emails.
 * @returns A promise that resolves when all scheduling requests have been attempted.
 * @throws Will throw an error if any API request fails and is not caught internally.
 */
export async function sendScheduledEmailsBeforeSessions(sessions: Session[]): Promise<void> {
  try {
    // Use Promise.all for parallel execution or for...of for sequential
    await Promise.all(
      sessions.map(async (session) => {
        // Check if session has a tutor
        if (!session.tutor) {
          // console.warn(`Session ${session.id} has no tutor assigned`);
          return;
        }

        if (!session.student) {
          // console.warn(`Session ${session.id} has no student assigned`);
          return;
        }

        try {
          await scheduleReminder({ session: session, type: "Tutor" });
          await scheduleReminder({ session: session, type: "Student" });
        } catch (error) {
          console.error("Error processing session %s:", session.id, error);
          await logError(error, { session_id: session.id }, "email_error");
        }
      }),
    );
  } catch (error) {
    console.error("Error scheduling session emails", error);
    await logError(error, { session_ids: sessions.map((s) => s.id) }, "email_error");
    throw error;
  }
}

/**
 * Cancels every pending reminder for a session: deletes the QStash messages and
 * the session_reminders rows (one per recipient). Throws if the lookup or row
 * delete fails so callers that reschedule don't stack new reminders on old ones.
 */
async function removeSessionReminders(sessionId: string) {
  const supabase = await createAdminClient();

  const { data: reminders, error } = await supabase
    .from(Table.SessionReminders)
    .select("id, message_id")
    .eq("session_id", sessionId)
    .eq("description", SESSION_REMINDER_DESCRIPTION);

  if (error) throw error;
  if (!reminders || reminders.length === 0) return;

  await Promise.all(
    reminders.flatMap((reminder) => (reminder.message_id ? [deleteMsg(reminder.message_id)] : [])),
  );

  const { error: deleteError } = await supabase
    .from(Table.SessionReminders)
    .delete()
    .in(
      "id",
      reminders.map((reminder) => reminder.id),
    );

  if (deleteError) throw deleteError;
}

/**
 * Cancels the reminder state for a moved session. The send-session-reminders cron re-sends
 * for the new time once it falls inside the reminder window, so nothing is scheduled here.
 *
 * @param session - The Session object with updated details.
 * @returns A promise that resolves when the update process is complete.
 * @throws Will throw an error if deletion or scheduling fails.
 */
export async function updateScheduledEmailBeforeSessions(session: Session) {
  try {
    await requireSessionAccess(session);
    await removeSessionReminders(session.id);
  } catch (error) {
    console.error("Unable to update scheduled message");
    await logError(error, { session_id: session.id }, "email_error");
    throw error;
  }
}

/**
 * Cancels the scheduled reminder emails for a session. Failures are logged, not thrown,
 * so a cancelled or deleted session isn't blocked on cleanup; the send route also
 * re-checks the session before sending.
 *
 * @param sessionId - The ID of the session whose scheduled emails are to be deleted.
 */
export async function deleteScheduledEmailBeforeSessions(sessionId: string) {
  try {
    // The session may already be deleted (callers remove it first), in which case there is
    // nothing to authorize against and only orphaned reminders are left to clean up.
    const supabase = await createAdminClient();
    const { data: session } = await supabase
      .from(Table.Sessions)
      .select("tutor_id, student_id")
      .eq("id", sessionId)
      .maybeSingle();
    if (session) await requireSessionAccess(session);

    await withRetry(() => removeSessionReminders(sessionId), {
      onRetry: async (error, attempt) => {
        console.error(`deleteScheduledEmailBeforeSessions attempt ${attempt + 1} failed:`, error);
        await logError(error, { session_id: sessionId, attempt }, "email_error");
      },
    });
  } catch (error) {
    console.error("Unable to delete message");
    await logError(error, { session_id: sessionId }, "email_error");
  }
}

export async function deleteMsg(messageId: string) {
  const qstash = new Client({ token: process.env.US_EAST_1_QSTASH_TOKEN });
  try {
    await withRetry(() => qstash.messages.delete(messageId), {
      onRetry: async (error, attempt) => {
        console.error(`deleteMsg attempt ${attempt + 1} failed:`, error);
        await logError(error, { message_id: messageId, attempt }, "email_error");
      },
    });
  } catch (qstashError: any) {
    console.warn("Failed to delete message from QStash");
    await logError(qstashError, { message_id: messageId }, "email_error");
  }
}

export async function scheduleEmail({
  notBefore,
  to,
  subject,
  body,
  sessionId,
  scheduledFor,
  deduplicationId,
}: {
  notBefore: number;
  to: string;
  subject: string;
  body: string;
  sessionId: string;
  /** ISO session start this reminder was scheduled for; the send route drops it if the session has since moved. */
  scheduledFor?: string;
  /** QStash drops a publish repeating an id within its dedup window, so overlapping cron runs can't double-queue. */
  deduplicationId?: string;
}) {
  try {
    const qstash = new Client({ token: process.env.US_EAST_1_QSTASH_TOKEN });
    const result = await qstash.publishJSON({
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/admin/email/send-email-reminder`,
      notBefore: notBefore,
      deduplicationId: deduplicationId,
      body: {
        to: to,
        subject: subject,
        body: body,
        sessionId: sessionId,
        scheduledFor: scheduledFor,
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
    await logError(error, { to, subject, sessionId }, "email_error");
    throw error;
  }
}

const EARLY_SESSION_CHECK_IN_SUBJECT = "Connect Me Early Session Check-In";
const EASTERN_TIMEZONE = "America/New_York";

export async function sendStudentPairingConfirmationEmail(
  data: PairingConfirmationEmailProps,
  emailTo: string,
) {
  const emailHtml = await render(React.createElement(StudentPairingConfirmationEmail, data));
  const emailResult = await withRetry(
    () =>
      sendMail({
        from: "Connect Me Free Tutoring & Mentoring <pairings@connectmego.app>",
        to: process.env.DEV_EMAIL!,
        cc: [process.env.OPERATIONS_EMAIL!],
        subject: "You Have Been Matched!",
        html: emailHtml,
      }),
    {
      onRetry: async (error, attempt) => {
        console.error(`sendStudentPairingConfirmationEmail attempt ${attempt + 1} failed:`, error);
        await logError(error, { email_to: emailTo, attempt }, "email_error");
      },
    },
  );

  return emailResult;
}

export async function sendPairingRequestEmail(
  data: PairingRequestNotificationEmailProps,
  emailTo: string,
) {
  const emailHtml = await render(React.createElement(PairingRequestNotificationEmail, data));

  const emailResult = await withRetry(
    () =>
      sendMail({
        from: "reminder@connectmego.app",
        to: process.env.DEV_EMAIL!,
        cc: [process.env.OPERATIONS_EMAIL!],
        subject: "Connect Me Pairing Request",
        html: emailHtml,
      }),
    {
      onRetry: async (error, attempt) => {
        console.error(`sendPairingRequestEmail attempt ${attempt + 1} failed:`, error);
        await logError(error, { email_to: emailTo, attempt }, "email_error");
      },
    },
  );
  return emailResult;
}

export async function sendTutorPairingConfirmationEmail(
  data: PairingConfirmationEmailProps,
  emailTo: string,
) {
  const emailHtml = await render(React.createElement(TutorPairingConfirmationEmail, data));
  const emailResult = await withRetry(
    () =>
      sendMail({
        from: "Connect Me Free Tutoring & Mentoring <confirmation@connectmego.app>",
        to: process.env.DEV_EMAIL!,
        cc: [process.env.OPERATIONS_EMAIL!],
        subject: "Confirmed for Tutoring",
        html: emailHtml,
      }),
    {
      onRetry: async (error, attempt) => {
        console.error(`sendTutorPairingConfirmationEmail attempt ${attempt + 1} failed:`, error);
        await logError(error, { email_to: emailTo, attempt }, "email_error");
      },
    },
  );

  return emailResult;
}

export async function sendSessionRescheduleEmail(
  data: SessionRescheduleEmailProps,
  emailTo: string,
) {
  const emailHtml = await render(React.createElement(StudentRescheduleNotificationEmail, data));

  const emailResult = await withRetry(
    () =>
      sendMail({
        from: "Connect Me Free Tutoring & Mentoring <notifications@connectmego.app>",
        to: emailTo,
        cc: [process.env.OPERATIONS_EMAIL!], // keeping consistent with other email methods for visibility
        subject: "Your Tutoring Session Has Been Rescheduled",
        html: emailHtml,
      }),
    {
      onRetry: async (error, attempt) => {
        console.error(`sendSessionRescheduleEmail attempt ${attempt + 1} failed:`, error);
        await logError(error, { email_to: emailTo, attempt }, "email_error");
      },
    },
  );

  return emailResult;
}

export async function sendStudentSessionCancellationEmail(
  data: StudentSessionCancellationEmailProps,
  emailTo: string,
) {
  const emailHtml = await render(
    React.createElement(StudentSessionCancellationNotificationEmail, data),
  );

  const emailResult = await withRetry(
    () =>
      sendMail({
        from: "Connect Me Free Tutoring & Mentoring <notifications@connectmego.app>",
        to: emailTo,
        cc: [process.env.OPERATIONS_EMAIL!], // keeping consistent with other email methods for visibility
        subject: "Your Tutoring Session Has Been Cancelled",
        html: emailHtml,
      }),
    {
      onRetry: async (error, attempt) => {
        console.error(`sendStudentSessionCancellationEmail attempt ${attempt + 1} failed:`, error);
        await logError(error, { email_to: emailTo, attempt }, "email_error");
      },
    },
  );

  return emailResult;
}

export async function sendTutorSessionCancellationEmail(
  data: TutorSessionCancellationEmailProps,
  emailTo: string,
) {
  const emailHtml = await render(
    React.createElement(TutorSessionCancellationNotificationEmail, data),
  );

  const emailResult = await withRetry(
    () =>
      sendMail({
        from: "Connect Me Free Tutoring & Mentoring <notifications@connectmego.app>",
        to: emailTo,
        cc: [process.env.OPERATIONS_EMAIL!], // keeping consistent with other email methods for visibility
        subject: "A Tutoring Session Has Been Cancelled",
        html: emailHtml,
      }),
    {
      onRetry: async (error, attempt) => {
        console.error(`sendTutorSessionCancellationEmail attempt ${attempt + 1} failed:`, error);
        await logError(error, { email_to: emailTo, attempt }, "email_error");
      },
    },
  );

  return emailResult;
}

/** Resend recipient plus props from {@link ChatMessageNotificationEmailProps}. */
export type SendChatMessageNotificationEmailParams = {
  to: string;
} & ChatMessageNotificationEmailProps;

export async function sendChatMessageNotificationEmail(
  params: SendChatMessageNotificationEmailParams,
) {
  const emailHtml = await render(
    React.createElement(ChatMessageNotificationEmail, {
      recipientName: params.recipientName,
      senderName: params.senderName,
      messagePreview: params.messagePreview,
      chatRoomUrl: params.chatRoomUrl,
      isPreview: params.isPreview,
    }),
  );

  const emailResult = await withRetry(
    () =>
      sendMail({
        from: "Connect Me Free Tutoring & Mentoring <notifications@connectmego.app>",
        to: params.to,
        subject: "New message on Connect Me",
        html: emailHtml,
      }),
    {
      onRetry: async (error, attempt) => {
        console.error(`sendChatMessageNotificationEmail attempt ${attempt + 1} failed:`, error);
        await logError(error, { email_to: params.to, attempt }, "email_error");
      },
    },
  );

  return emailResult;
}

/**
 * Sends the chat notification template to a test inbox with a sample message body.
 * Use for manual QA of `ChatMessageNotificationEmail` without sending a real chat.
 */
export async function sendChatMessageNotificationEmailTest(
  params: { messagePreview: string; to?: string } & Partial<
    Omit<ChatMessageNotificationEmailProps, "messagePreview">
  >,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.connectmego.app";
    const base = siteUrl.replace(/\/$/, "");

    await sendChatMessageNotificationEmail({
      to: params.to ?? process.env.CHAT_EMAIL_TEST_TO ?? "ahu@connectmego.org",
      recipientName: params.recipientName ?? "Test Recipient",
      senderName: params.senderName ?? "Sample Sender",
      messagePreview: params.messagePreview,
      chatRoomUrl: params.chatRoomUrl ?? `${base}/dashboard/announcements`,
      isPreview: params.isPreview ?? true,
    });

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error sending test email";
    console.error("sendChatMessageNotificationEmailTest", error);
    await logError(error, { to: params.to }, "email_error");
    return { ok: false, error: message };
  }
}

export async function sendEarlySessionCheckInEmails(now = new Date()) {
  const supabase = await createAdminClient();
  const targetStartDate = formatInTimeZone(
    new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
    EASTERN_TIMEZONE,
    "yyyy-MM-dd",
  );

  const enrollments = await getAllActiveEnrollmentsForCron();
  const dueEnrollments = enrollments.filter((enrollment) => {
    if (!enrollment.startDate || !enrollment.student || !enrollment.tutor) {
      return false;
    }

    return normalizeEnrollmentStartDate(enrollment.startDate) === targetStartDate;
  });

  const recipients = dueEnrollments.flatMap((enrollment) =>
    getEarlySessionCheckInRecipients(enrollment),
  );

  if (recipients.length === 0) {
    return {
      checked: dueEnrollments.length,
      sent: 0,
      skipped: 0,
    };
  }

  const descriptions = recipients.map(({ description }) => description);
  const { data: existingEmailLogs, error: existingEmailLogsError } = await supabase
    .from(Table.SessionReminders)
    .select("description")
    .in("description", descriptions);

  if (existingEmailLogsError) {
    console.error("Unable to fetch existing early session check-in logs", existingEmailLogsError);
    await logError(existingEmailLogsError, { target_start_date: targetStartDate }, "email_error");
    throw existingEmailLogsError;
  }

  const existingDescriptions = new Set(
    (existingEmailLogs ?? [])
      .map((emailLog) => emailLog.description)
      .filter((description): description is string => Boolean(description)),
  );

  let sent = 0;
  let skipped = 0;

  for (const recipient of recipients) {
    if (existingDescriptions.has(recipient.description)) {
      skipped += 1;
      continue;
    }

    const emailHtml = await render(
      React.createElement(EarlySessionCheckInEmail, recipient.templateProps),
    );

    const emailResult = await withRetry(
      () =>
        sendMail({
          from: "Connect Me Free Tutoring & Mentoring <reminder@connectmego.app>",
          to: recipient.email,
          cc: [process.env.OPERATIONS_EMAIL].filter((value): value is string => Boolean(value)),
          subject: EARLY_SESSION_CHECK_IN_SUBJECT,
          html: emailHtml,
        }),
      {
        onRetry: async (error, attempt) => {
          console.error(`sendEarlySessionCheckInEmails attempt ${attempt + 1} failed:`, error);
          await logError(error, { email_to: recipient.email, attempt }, "email_error");
        },
      },
    );

    const messageId = "data" in emailResult && emailResult.data?.id ? emailResult.data.id : null;

    const { error: insertEmailLogError } = await supabase.from(Table.SessionReminders).insert({
      recipient_id: recipient.recipientId,
      session_id: null,
      message_id: messageId,
      description: recipient.description,
    });

    if (insertEmailLogError) {
      console.error("Unable to record early session check-in email", insertEmailLogError);
      await logError(insertEmailLogError, { recipient_id: recipient.recipientId }, "email_error");
      throw insertEmailLogError;
    }

    existingDescriptions.add(recipient.description);
    sent += 1;
  }

  return {
    checked: dueEnrollments.length,
    sent,
    skipped,
  };
}

export async function sendMonthlyCheckInEmail(
  data: { firstName: string; role: "tutor" | "student" | "parent" },
  emailTo: string,
) {
  const emailHtml = await render(React.createElement(MonthlyCheckInEmail, data));

  const emailResult = await withRetry(
    () =>
      sendMail({
        from: "Connect Me Free Tutoring & Mentoring <notifications@connectmego.app>",
        to: emailTo,
        cc: [process.env.OPERATIONS_EMAIL!],
        subject: "Your Monthly Connect Me Check-In",
        html: emailHtml,
      }),
    {
      onRetry: async (error, attempt) => {
        console.error(`sendMonthlyCheckInEmail attempt ${attempt + 1} failed:`, error);
        await logError(error, { email_to: emailTo, attempt }, "email_error");
      },
    },
  );

  return emailResult;
}

export const sendEmail = async (from: string, to: string, subject: string, body: string) => {
  try {
    await withRetry(
      () =>
        sendMail({
          from: from,
          to: to,
          cc: [process.env.OPERATIONS_EMAIL!],
          subject: subject,
          html: body,
        }),
      {
        onRetry: async (error, attempt) => {
          console.error(`sendEmail attempt ${attempt + 1} failed:`, error);
          await logError(error, { to, subject, attempt }, "email_error");
        },
      },
    );
  } catch (error) {
    console.error("Unable to send email", error);
    await logError(error, { to, subject }, "email_error");
    throw error;
  }
};

export const sendEmailTest = async (from: string, to: string, subject: string, body: string) => {
  try {
    await withRetry(
      () =>
        sendMail({
          from: from,
          to: ["amansreejesh9@gmail.com", process.env.DEV_EMAIL!],
          cc: [process.env.OPERATIONS_EMAIL!],
          subject: subject,
          html: body,
        }),
      {
        onRetry: async (error, attempt) => {
          console.error(`sendEmailTest attempt ${attempt + 1} failed:`, error);
          await logError(error, { subject, attempt }, "email_error");
        },
      },
    );
  } catch (error) {
    console.error("Unable to send email", error);
    await logError(error, { subject }, "email_error");
    throw error;
  }
};

export const scheduleReminder = async (data: { session: Session; type: "Tutor" | "Student" }) => {
  try {
    const supabase = await createAdminClient();

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
    const recipient = type === "Tutor" ? tutor : student;
    if (!recipient.email) {
      throw new Error(`No email on file for ${type.toLowerCase()} ${recipient.id}`);
    }

    // Already scheduled for this recipient (weekly cron, session creation and
    // reschedules can all reach here for the same session) - don't double-send.
    const { data: existing, error: existingError } = await supabase
      .from(Table.SessionReminders)
      .select("id")
      .eq("session_id", session.id)
      .eq("recipient_id", recipient.id)
      .eq("description", SESSION_REMINDER_DESCRIPTION)
      .limit(1);
    if (existingError) throw existingError;
    if (existing && existing.length > 0) {
      return { status: 200, message: "Reminder already scheduled", messageId: null };
    }

    const result = await scheduleEmail({
      // Sessions created or moved inside the 15 minute lead time send right away.
      notBefore: Math.floor(Math.max(scheduledTime.getTime(), Date.now()) / 1000),
      deduplicationId: `session-reminder:${session.id}:${recipient.id}:${session.date}`,
      to: recipient.email,
      subject: "Upcoming Connect Me Session",
      body: message,
      sessionId: session.id,
      scheduledFor: session.date,
    });

    if (result && result.messageId) {
      const { data, error } = await supabase
        .from(Table.SessionReminders)
        .insert({
          recipient_id: recipient.id,
          session_id: session.id,
          message_id: result.messageId,
          description: SESSION_REMINDER_DESCRIPTION,
        })
        .select();

      // The message is already queued; without a row nothing can cancel it, so drop it.
      if (error) {
        await deleteMsg(result.messageId);
        // 23505: a concurrent caller recorded this recipient's reminder first.
        if (error.code === "23505") {
          return { status: 200, message: "Reminder already scheduled", messageId: null };
        }
        console.error("Supabase insert error", error);
        await logError(error, { session_id: session.id, type }, "email_error");
        throw error;
      }
      if (!data) {
        await deleteMsg(result.messageId);
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
    await logError(error, { session_id: data.session.id, type: data.type }, "email_error");
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
  const tutorName: string = tutor ? ` ${tutor.firstName} ${tutor.lastName}` : "";
  const studentName: string = student ? `${student.firstName} ${student.lastName}` : "your student";

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

function getEarlySessionCheckInRecipients(enrollment: Enrollment) {
  const tutor = enrollment.tutor;
  const student = enrollment.student;

  if (!tutor || !student) {
    return [];
  }

  const recipients: Array<{
    description: string;
    email: string;
    recipientId: string;
    templateProps: EarlySessionCheckInEmailProps;
  }> = [];

  if (tutor.email) {
    recipients.push({
      description: buildEarlySessionCheckInDescription(enrollment.id, "tutor"),
      email: tutor.email,
      recipientId: tutor.id,
      templateProps: {
        recipientRole: "tutor",
        tutor,
        student,
      },
    });
  }

  const parentEmail = student.parentEmail?.trim();
  if (parentEmail) {
    recipients.push({
      description: buildEarlySessionCheckInDescription(enrollment.id, "parent"),
      email: parentEmail,
      recipientId: student.id,
      templateProps: {
        recipientRole: "parent",
        tutor,
        student,
      },
    });
  }

  return recipients;
}

function buildEarlySessionCheckInDescription(
  enrollmentId: string,
  recipientRole: EarlySessionCheckInEmailProps["recipientRole"],
) {
  return `Early Session Check-In:${enrollmentId}:${recipientRole}`;
}

function normalizeEnrollmentStartDate(startDate: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return startDate;
  }
  return formatInTimeZone(startDate, EASTERN_TIMEZONE, "yyyy-MM-dd");
}
