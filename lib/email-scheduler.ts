import schedule from "node-schedule";
import { format, parseISO } from "date-fns";
import { userAgent } from "next/server";
import { Profile, Session } from "@/types";

/**
 * Formats date to a user-friendly string (e.g., "May 6, 2025")
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string
 */

export const formatDate = (date: Date) => {
  return format(new Date(date), "MMMM d, yyyy");
};

/**
 * Formats time to a user-friendly string (e.g., "3:00 PM")
 * @param {Date} date - The date containing the time to format
 * @returns {string} Formatted time string
 */

export const formatTime = (date: Date) => {
  return format(new Date(date), "h:mm a");
};

/**
 * Schedules an email to be sent before a session
 * @param {Object} session - The session details
 * @param {Object} user - The user data
 * @param {number} hoursBeforeSession - Hours before the session to send the email
 */

export const schedulePreSessionEmail = async (
  session: Session,
  user: Profile,
  hoursBeforeSession: number,
) => {
  const notificationTime = new Date(parseISO(session.date));
  notificationTime.setHours(notificationTime.getHours() - hoursBeforeSession);

  if (notificationTime < new Date()) {
    return;
  }

  const job = schedule.scheduleJob(notificationTime, async function () {
    await sendSessionReminderEmail(session, user);
  });

  return job;
};

async function sendSessionReminderEmail(session: Session, user: Profile) {
  try {
    const sessionDate = parseISO(session.date);

    const sessionDetails = {
      date: formatDate(sessionDate),
      time: formatTime(sessionDate),
      student: session.student,
    };

    const response = await fetch("/api/admin/email/send-session-reminder", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user, sessionDetails }),
    });
    if (!response.ok) {
      throw new Error("Failed to send email");
    }
    return await response.json();
  } catch (error) {
    console.error("Error sending session reminder:", error);
    throw error;
  }
}
