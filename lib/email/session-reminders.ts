import "server-only";
import { Client } from "@upstash/qstash";
import { parseISO, subMinutes } from "date-fns";
import { Profile, Session } from "@/types";
import { createAdminClient } from "@/lib/supabase/server";
import { Table } from "@/lib/supabase/tables";
import { withRetry } from "@/lib/utils";
import { logError } from "@/lib/posthog";

// Unauthenticated internals for session reminders. This file is deliberately not a
// "use server" module: everything here trusts its arguments, so it must only be reached
// from code that has already authorized the caller (the reminder cron, or the authorized
// actions in lib/actions/email/server.actions.ts).

export const SESSION_REMINDER_DESCRIPTION = "Session Reminder";

export const getQstashClient = () => {
  const token = process.env.US_EAST_1_QSTASH_TOKEN;
  if (!token) throw new Error("US_EAST_1_QSTASH_TOKEN is not set");
  return new Client({ token });
};

const isNotFound = (error: unknown) => (error as { status?: number })?.status === 404;

/**
 * Cancels a queued QStash message. A message that no longer exists (already delivered or
 * cancelled) counts as cancelled. Throws if QStash could not be reached or refused, so
 * callers don't drop their tracking row for a message that may still fire.
 */
export async function deleteMsg(messageId: string) {
  try {
    await withRetry(() => getQstashClient().messages.delete(messageId), {
      isRetryable: (error) => !isNotFound(error),
      onRetry: async (error, attempt) => {
        console.error(`deleteMsg attempt ${attempt + 1} failed:`, error);
        await logError(error, { message_id: messageId, attempt }, "email_error");
      },
    });
  } catch (error) {
    if (isNotFound(error)) return;
    await logError(error, { message_id: messageId }, "email_error");
    throw error;
  }
}

export async function scheduleEmail({
  notBefore,
  to,
  subject,
  body,
  sessionId,
  scheduledFor,
}: {
  notBefore: number;
  to: string;
  subject: string;
  body: string;
  sessionId: string;
  /** ISO session start this reminder was scheduled for; the send route drops it if the session has since moved. */
  scheduledFor?: string;
}) {
  try {
    return await getQstashClient().publishJSON({
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/admin/email/send-email-reminder`,
      notBefore: notBefore,
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
  } catch (error) {
    console.error("Unable to schedule email");
    await logError(error, { to, subject, sessionId }, "email_error");
    throw error;
  }
}

/**
 * Cancels every pending reminder for a session: deletes the QStash messages and the
 * session_reminders rows (one per recipient). A row is only removed once its message is
 * confirmed cancelled, and this throws if any message could not be, so callers that
 * reschedule don't stack new reminders on ones that may still fire.
 */
export async function removeSessionReminders(sessionId: string) {
  const supabase = await createAdminClient();

  const { data: reminders, error } = await supabase
    .from(Table.SessionReminders)
    .select("id, message_id")
    .eq("session_id", sessionId)
    .eq("description", SESSION_REMINDER_DESCRIPTION);

  if (error) throw error;
  if (!reminders || reminders.length === 0) return;

  const results = await Promise.allSettled(
    reminders.map(async (reminder) => {
      if (reminder.message_id) await deleteMsg(reminder.message_id);
      return reminder.id;
    }),
  );
  const cancelledIds = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );

  if (cancelledIds.length > 0) {
    const { error: deleteError } = await supabase
      .from(Table.SessionReminders)
      .delete()
      .in("id", cancelledIds);
    if (deleteError) throw deleteError;
  }

  if (cancelledIds.length < reminders.length) {
    throw new Error(
      `Unable to cancel ${reminders.length - cancelledIds.length} reminder(s) for session ${sessionId}`,
    );
  }
}

/**
 * Schedules one recipient's reminder. The session_reminders row is inserted first and acts
 * as the claim: the partial unique index lets exactly one concurrent caller proceed, so no
 * message is published for a recipient that already has one.
 */
export const scheduleReminder = async (data: { session: Session; type: "Tutor" | "Student" }) => {
  let claimedRowId: number | string | null = null;
  const supabase = await createAdminClient();
  try {
    const session: Session = data.session;
    const tutor: Profile | null = session.tutor;
    const student: Profile | null = session.student;
    const type: "Tutor" | "Student" = data.type;

    if (!tutor || !student) {
      throw new Error("No identified tutor or student");
    }

    const sessionDate = parseISO(session.date);
    const scheduledTime = subMinutes(sessionDate, 15);
    const message = createSessionNotification(session, tutor, student, type);
    const recipient = type === "Tutor" ? tutor : student;
    if (!recipient.email) {
      throw new Error(`No email on file for ${type.toLowerCase()} ${recipient.id}`);
    }

    const { data: claim, error: claimError } = await supabase
      .from(Table.SessionReminders)
      .insert({
        recipient_id: recipient.id,
        session_id: session.id,
        description: SESSION_REMINDER_DESCRIPTION,
      })
      .select("id")
      .single();

    // 23505: this recipient's reminder is already claimed (an earlier run, or a concurrent one).
    if (claimError?.code === "23505") {
      return { status: 200, message: "Reminder already scheduled", messageId: null };
    }
    if (claimError) throw claimError;
    claimedRowId = claim.id;

    const result = await scheduleEmail({
      // Sessions created or moved inside the 15 minute lead time send right away.
      notBefore: Math.floor(Math.max(scheduledTime.getTime(), Date.now()) / 1000),
      to: recipient.email,
      subject: "Upcoming Connect Me Session",
      body: message,
      sessionId: session.id,
      scheduledFor: session.date,
    });

    // Without the message id nothing can cancel it later, so drop the message and the claim.
    const { error: updateError } = await supabase
      .from(Table.SessionReminders)
      .update({ message_id: result.messageId })
      .eq("id", claim.id);
    if (updateError) {
      await deleteMsg(result.messageId);
      throw updateError;
    }

    return {
      status: 200,
      message: "Email reminder scheduled successfully",
      messageId: result.messageId,
    };
  } catch (error) {
    // Release the claim so the next cron run retries this recipient.
    if (claimedRowId !== null) {
      await supabase.from(Table.SessionReminders).delete().eq("id", claimedRowId);
    }
    console.error("Error scheduling reminder", error);
    await logError(error, { session_id: data.session.id, type: data.type }, "email_error");
    throw error;
  }
};

export type ReminderRunResult = { scheduled: number; skipped: number; failed: number };

/**
 * Schedules the Tutor and Student reminders for each session. Failures are counted rather
 * than thrown so one bad session doesn't stop the rest; callers decide how to report them.
 */
export async function sendScheduledEmailsBeforeSessions(
  sessions: Session[],
): Promise<ReminderRunResult> {
  const tally: ReminderRunResult = { scheduled: 0, skipped: 0, failed: 0 };

  await Promise.all(
    sessions.map(async (session) => {
      if (!session.tutor || !session.student) return;

      for (const type of ["Tutor", "Student"] as const) {
        try {
          const result = await scheduleReminder({ session, type });
          if (result.messageId) tally.scheduled++;
          else tally.skipped++;
        } catch (error) {
          tally.failed++;
          console.error("Error processing session %s:", session.id, error);
        }
      }
    }),
  );

  return tally;
}

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
