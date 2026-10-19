"use server";
import { Enrollment } from "@/types";
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
import { z } from "zod";
import { formatInTimeZone } from "date-fns-tz";
import { requireAdmin, requireSessionAccess, requireSessionAccessById } from "../auth/authz.server";
import { getQstashClient, removeSessionReminders } from "@/lib/email/session-reminders";
import { logError } from "@/lib/posthog";

export const fetchScheduledMessages = async () => {
  await requireAdmin();
  const qstash = getQstashClient();

  const messages = await withRetry(() => qstash.schedules.list(), {
    onRetry: async (error, attempt) => {
      console.error(`fetchScheduledMessages attempt ${attempt + 1} failed:`, error);
      await logError(error, { attempt }, "email_error");
    },
  });
  return messages;
};

/**
 * Cancels the reminder state for a moved session. The send-session-reminders cron re-sends
 * for the new time once it falls inside the reminder window, so nothing is scheduled here.
 *
 * Access is checked against the session stored under `sessionId`, never the caller's copy.
 *
 * @param sessionId - The ID of the session whose reminders are to be cancelled.
 * @throws Will throw if the caller can't access the session or a reminder can't be cancelled.
 */
export async function updateScheduledEmailBeforeSessions(sessionId: string) {
  try {
    await requireSessionAccessById(sessionId);
    await removeSessionReminders(sessionId);
  } catch (error) {
    console.error("Unable to update scheduled message");
    await logError(error, { session_id: sessionId }, "email_error");
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

const EMAIL_LOG_PAGE_SIZES = [10, 25, 50, 100] as const;

const emailLogQuerySchema = z.object({
  page: z.number().int().min(1).max(100_000),
  pageSize: z
    .number()
    .int()
    .refine((n) => (EMAIL_LOG_PAGE_SIZES as readonly number[]).includes(n)),
  search: z.string().max(200).default(""),
});

export type EmailLogRow = {
  id: string;
  created_at: string;
  recipient_email: string;
  subject: string | null;
};

/**
 * One page of the emails log for the admin Email Manager. Paging and search
 * run in the database so the list isn't cut off at PostgREST's max_rows, and
 * the rendered HTML is left out (see getEmailLogContent).
 * Uses the cookie-bound client so RLS (emails_log_admin_all) checks admin too.
 */
export async function getEmailLogs(
  query: z.input<typeof emailLogQuerySchema>,
): Promise<{ rows: EmailLogRow[]; total: number }> {
  await requireAdmin();
  const { page, pageSize, search } = emailLogQuerySchema.parse(query);
  const supabase = await createClient();

  const from = (page - 1) * pageSize;
  let request = supabase
    .from(Table.Emails)
    .select("id, created_at, recipient_email, subject", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  // Characters that would break out of a PostgREST or() filter or act as wildcards.
  const term = search.replace(/[,()*%\\"]/g, " ").trim();
  if (term) {
    request = request.or(`recipient_email.ilike.%${term}%,subject.ilike.%${term}%`);
  }

  const { data, error, count } = await request;
  if (error) {
    console.error("Error fetching email logs:", error);
    await logError(error, {}, "email_error");
    throw new Error("Unable to load email logs");
  }

  return { rows: data ?? [], total: count ?? 0 };
}

/** Rendered HTML of one logged email, loaded only when an admin opens its preview. */
export async function getEmailLogContent(id: string): Promise<string | null> {
  await requireAdmin();
  const emailId = z.string().uuid().parse(id);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(Table.Emails)
    .select("content")
    .eq("id", emailId)
    .maybeSingle();

  if (error) {
    await logError(error, { emailId }, "email_error");
    throw new Error("Unable to load email content");
  }
  return data?.content ?? null;
}
