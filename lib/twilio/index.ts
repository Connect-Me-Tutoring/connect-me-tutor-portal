import { Session } from "@/types";
import twilio from "twilio";

export interface Meeting {
  id: string;
  meeting_url?: string;
  meeting_id?: string;
  passcode?: string;
}

export interface ScheduledMessage {
  sid: string;
  messagingServiceSid?: string;
  status: string;
  sendAt: Date;
  to: string;
  body: string;
}

// Initialize Twilio client
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);

export function formatPhoneNumber(phoneNumber?: string): string | null {
  if (!phoneNumber) return null;

  const digits = phoneNumber.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (!phoneNumber.startsWith("+")) {
    return `+${digits}`;
  }

  return phoneNumber;
}

/**
 * Create reminder message for student

 */
export function createStudentReminderMessage(session: Session): string {
  // Validate required data exists
  if (!session.student) {
    throw new Error(`Session ${session.id}: Student data is missing`);
  }
  if (!session.tutor) {
    throw new Error(`Session ${session.id}: Tutor data is missing`);
  }
  if (!session.student.firstName) {
    throw new Error(`Session ${session.id}: Student first name is missing`);
  }
  if (!session.tutor.firstName || !session.tutor.lastName) {
    throw new Error(`Session ${session.id}: Tutor name is incomplete`);
  }

  const tutorName = `${session.tutor.firstName} ${session.tutor.lastName}`;
  const sessionDate = new Date(session.date).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return `Hi ${session.student.firstName}! Your tutoring session with ${tutorName} is starting in 30 minutes at ${sessionDate}. Please be ready to join. Good luck!`;
}

/**
 * Create reminder message for tutor
 * @param session - Session object
 * @returns Formatted reminder message
 * @throws Error if student or tutor data is missing
 */
export function createTutorReminderMessage(session: Session): string {
  // Validate required data exists
  if (!session.student) {
    throw new Error(`Session ${session.id}: Student data is missing`);
  }
  if (!session.tutor) {
    throw new Error(`Session ${session.id}: Tutor data is missing`);
  }
  if (!session.tutor.firstName) {
    throw new Error(`Session ${session.id}: Tutor first name is missing`);
  }
  if (!session.student.firstName || !session.student.lastName) {
    throw new Error(`Session ${session.id}: Student name is incomplete`);
  }

  const studentName = `${session.student.firstName} ${session.student.lastName}`;
  const sessionDate = new Date(session.date).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return `Hi ${session.tutor.firstName}! You have a tutoring session with ${studentName} starting in 30 minutes at ${sessionDate}. Please be prepared to join.`;
}

/**
 * Schedule SMS reminder using Twilio's scheduling feature
 */
export async function scheduleReminderSMS(
  phoneNumber: string,
  message: string,
  sendAt: Date,
  messagingServiceSid?: string,
): Promise<ScheduledMessage> {
  try {
    const messageOptions: any = {
      body: message,
      to: phoneNumber,
      scheduleType: "fixed",
      sendAt: sendAt,
    };

    // Use messaging service if provided, otherwise use phone number
    if (messagingServiceSid) {
      messageOptions.messagingServiceSid = messagingServiceSid;
    } else {
      messageOptions.from = process.env.TWILIO_PHONE_NUMBER!;
    }

    const scheduledMessage = await twilioClient.messages.create(messageOptions);

    return {
      sid: scheduledMessage.sid,
      messagingServiceSid: scheduledMessage.messagingServiceSid || undefined,
      status: scheduledMessage.status,
      sendAt: sendAt,
      to: phoneNumber,
      body: message,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Failed to schedule SMS to ${phoneNumber}:`, errorMessage);
    throw new Error(`SMS scheduling failed: ${errorMessage}`);
  }
}

/**
 * Schedule reminders for a single session (30 minutes before)
 * @param session - Session object
 * @param messagingServiceSid - Optional messaging service SID
 * @returns Promise with array of scheduled messages
 * @throws Error if required session data is missing
 */
export async function scheduleSessionReminders(
  session: Session,
  messagingServiceSid?: string,
): Promise<ScheduledMessage[]> {
  const scheduledMessages: ScheduledMessage[] = [];

  // Validate session has required data
  if (!session.student) {
    throw new Error(`Session ${session.id}: Student data is missing`);
  }
  if (!session.tutor) {
    throw new Error(`Session ${session.id}: Tutor data is missing`);
  }

  // Skip if session is cancelled or completed
  if (session.status === "Cancelled" || session.status === "Complete") {
    return scheduledMessages;
  }

  // Calculate send time (30 minutes before session)
  const sessionDate = new Date(session.date);
  const reminderTime = new Date(sessionDate.getTime() - 30 * 60 * 1000);

  // Don't schedule if reminder time is in the past
  const now = new Date();
  if (reminderTime <= now) {
    return scheduledMessages;
  }

  const errors: string[] = [];

  try {
    // Schedule reminder for student
    if (session.student.studentNumber) {
      const studentPhone = formatPhoneNumber(session.student.studentNumber!);
      if (studentPhone) {
        try {
          const studentMessage = createStudentReminderMessage(session);
          const scheduledStudentMessage = await scheduleReminderSMS(
            studentPhone,
            studentMessage,
            reminderTime,
            messagingServiceSid,
          );
          scheduledMessages.push(scheduledStudentMessage);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          errors.push(`Student reminder: ${errorMessage}`);
          console.error(
            `Failed to schedule student reminder for session ${session.id}:`,
            errorMessage,
          );
        }
      } else {
      }
    } else {
    }

    // Schedule reminder for tutor
    if (session.tutor.studentNumber) {
      const tutorPhone = formatPhoneNumber(session.tutor.studentNumber);
      if (tutorPhone) {
        try {
          const tutorMessage = createTutorReminderMessage(session);
          const scheduledTutorMessage = await scheduleReminderSMS(
            tutorPhone,
            tutorMessage,
            reminderTime,
            messagingServiceSid,
          );
          scheduledMessages.push(scheduledTutorMessage);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          errors.push(`Tutor reminder: ${errorMessage}`);
          console.error(
            `Failed to schedule tutor reminder for session ${session.id}:`,
            errorMessage,
          );
        }
      } else {
      }
    } else {
    }

    if (errors.length > 0) {
      console.warn(`Partial success for session ${session.id}. Errors:`, errors);
    }

    return scheduledMessages;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Error scheduling reminders for session ${session.id}:`, errorMessage);
    throw error;
  }
}

/**
 * Schedule reminders for multiple sessions
 * @param sessions - Array of session objects
 * @param messagingServiceSid - Optional messaging service SID
 * @returns Promise with results
 */
export async function scheduleMultipleSessionReminders(
  sessions: Session[],
  messagingServiceSid?: string,
): Promise<{
  scheduled: number;
  errors: string[];
  scheduledMessages: ScheduledMessage[];
  skipped: number;
}> {
  let scheduledCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];
  const allScheduledMessages: ScheduledMessage[] = [];

  for (const session of sessions) {
    try {
      // Validate session has basic required data
      if (!session.id) {
        errors.push("Session missing ID - skipping");
        skippedCount++;
        continue;
      }

      if (!session.student || !session.tutor) {
        errors.push(`Session ${session.id}: Missing student or tutor data - skipping`);
        skippedCount++;
        continue;
      }

      if (!session.date) {
        errors.push(`Session ${session.id}: Missing session date - skipping`);
        skippedCount++;
        continue;
      }

      const scheduledMessages = await scheduleSessionReminders(session, messagingServiceSid);
      scheduledCount += scheduledMessages.length;
      allScheduledMessages.push(...scheduledMessages);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Session ${session.id}: ${errorMessage}`);
      console.error(`Failed to schedule reminders for session ${session.id}:`, errorMessage);
    }
  }

  const summary = {
    scheduled: scheduledCount,
    errors,
    scheduledMessages: allScheduledMessages,
    skipped: skippedCount,
  };

  return summary;
}

/**
 * Cancel scheduled message
 * @param messageSid - SID of the scheduled message to cancel
 * @returns Promise with cancellation result
 */
export async function cancelScheduledReminder(messageSid: string): Promise<boolean> {
  try {
    await twilioClient.messages(messageSid).update({ status: "canceled" });
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Failed to cancel scheduled message ${messageSid}:`, errorMessage);
    return false;
  }
}

/**
 * Get status of scheduled message
 * @param messageSid - SID of the scheduled message
 * @returns Promise with message details
 */
export async function getScheduledMessageStatus(messageSid: string): Promise<any> {
  try {
    const message = await twilioClient.messages(messageSid).fetch();
    return {
      sid: message.sid,
      status: message.status,
      dateCreated: message.dateCreated,
      dateSent: message.dateSent,
      to: message.to,
      from: message.from,
      body: message.body,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Failed to fetch message status ${messageSid}:`, errorMessage);
    throw error;
  }
}
