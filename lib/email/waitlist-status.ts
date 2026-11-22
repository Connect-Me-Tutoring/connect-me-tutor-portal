import "server-only";
import React from "react";
import { createAdminClient } from "@/lib/supabase/server";
import { Table } from "@/lib/supabase/tables";
import { sendMail } from "@/lib/email/mailer";
import { logError } from "@/lib/posthog";
import StudentWaitlistStatusEmail, {
  STUDENT_WAITLIST_STATUS_SUBJECT,
} from "@/components/emails/enrollments/student-waitlist-status-email";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Students become due this many days after their profile is created. */
export const WAITLIST_EMAIL_DELAY_DAYS = 4;
/**
 * Students older than this are never emailed. The gap after the delay lets later daily
 * runs pick up a student a failed run missed, and keeps the first deploy from emailing
 * every unenrolled student already in the portal.
 */
export const WAITLIST_EMAIL_MAX_AGE_DAYS = 7;

const WAITLIST_CC = ["archives@connectmego.org", "admissions-archive@connectmego.org"];

/** Dedupe key in session_reminders: one waitlist email per student, ever. */
export const buildWaitlistStatusDescription = (studentId: string) =>
  `waitlist-status:${studentId}`;

type StudentRow = {
  id: string;
  first_name: string;
  last_name: string;
  parent_name: string | null;
  parent_email: string | null;
  email: string | null;
};

/**
 * Emails the parent of every active student added 4–7 days ago who still has no
 * enrollment, telling them they are on the waiting list.
 *
 * For crons only: uses the admin client and performs no auth check, so it must not be
 * exported from a "use server" module.
 */
export async function sendWaitlistStatusEmails(now = new Date()) {
  const supabase = await createAdminClient();
  const dueBefore = new Date(now.getTime() - WAITLIST_EMAIL_DELAY_DAYS * DAY_MS).toISOString();
  const notBefore = new Date(now.getTime() - WAITLIST_EMAIL_MAX_AGE_DAYS * DAY_MS).toISOString();

  const { data: students, error: studentsError } = await supabase
    .from(Table.Profiles)
    .select("id, first_name, last_name, parent_name, parent_email, email")
    .eq("role", "Student")
    .eq("status", "Active")
    .gte("created_at", notBefore)
    .lte("created_at", dueBefore);
  if (studentsError) throw studentsError;

  const candidates = (students ?? []) as StudentRow[];
  if (candidates.length === 0) return { checked: 0, sent: 0, skipped: 0, failed: 0 };

  const ids = candidates.map((s) => s.id);
  const descriptions = ids.map(buildWaitlistStatusDescription);

  const [enrollments, alreadySent] = await Promise.all([
    supabase.from(Table.Enrollments).select("student_id").in("student_id", ids),
    supabase.from(Table.SessionReminders).select("description").in("description", descriptions),
  ]);
  for (const result of [enrollments, alreadySent]) {
    if (result.error) throw result.error;
  }

  const enrolled = new Set((enrollments.data ?? []).map((row) => row.student_id));
  const sentDescriptions = new Set((alreadySent.data ?? []).map((row) => row.description));

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const student of candidates) {
    const description = buildWaitlistStatusDescription(student.id);
    const to = student.parent_email?.trim() || student.email?.trim();
    if (enrolled.has(student.id) || sentDescriptions.has(description) || !to) {
      skipped += 1;
      continue;
    }

    // Claim before sending so a send that succeeds is never repeated by a later run
    // just because recording it afterwards failed.
    const { data: claim, error: claimError } = await supabase
      .from(Table.SessionReminders)
      .insert({ recipient_id: student.id, session_id: null, message_id: null, description })
      .select("id")
      .single();
    if (claimError) {
      failed += 1;
      await logError(claimError, { studentId: student.id }, "waitlist_status_email_error");
      continue;
    }

    try {
      const { data, error } = await sendMail({
        from: "Connect Me Free Tutoring & Mentoring <reminder@connectmego.app>",
        to,
        cc: WAITLIST_CC,
        // Sent from an unmonitored address; route replies to operations.
        replyTo: process.env.OPERATIONS_EMAIL || undefined,
        subject: STUDENT_WAITLIST_STATUS_SUBJECT,
        react: React.createElement(StudentWaitlistStatusEmail, {
          parentName: student.parent_name,
          studentName: `${student.first_name} ${student.last_name}`.trim(),
        }),
      });
      // Resend reports failures in the result rather than throwing.
      if (error) throw error;

      await supabase
        .from(Table.SessionReminders)
        .update({ message_id: data?.id ?? null })
        .eq("id", claim.id);
      sent += 1;
    } catch (error) {
      failed += 1;
      // Release the claim so tomorrow's run retries this student.
      await supabase.from(Table.SessionReminders).delete().eq("id", claim.id);
      await logError(error, { studentId: student.id }, "waitlist_status_email_error");
    }
  }

  return { checked: candidates.length, sent, skipped, failed };
}
