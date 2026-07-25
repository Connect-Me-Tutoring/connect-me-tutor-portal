import { Session } from "@/types";
import { toast } from "react-hot-toast";
import { Client } from "@upstash/qstash";
import { Profile } from "@/types";
import { getProfileWithProfileId } from "./user.actions";

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
          console.warn(`Session ${session.id} has no tutor assigned`);
          return;
        }

        try {
          const response = await fetch("/api/admin/email/before-sessions/schedule-reminder", {
            method: "POST",
            body: JSON.stringify({ session }),
            headers: {
              "Content-Type": "application/json", // Fixed typo
            },
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
            throw new Error(
              errorData.message || `HTTP ${response.status}: Unable to schedule email`,
            );
          }

          const data = await response.json();
        } catch (sessionError) {
          console.error(`Error processing session ${session.id}:`, sessionError);
          // Continue processing other sessions instead of failing entirely
        }
      }),
    );
  } catch (error) {
    console.error("Error scheduling session emails", error);
    toast.error("Failed to schedule some session emails");
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
    toast.success("Successfully updated scheduled reminder");
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
    const response = await fetch("/api/admin/email/before-sessions/delete-reminder", {
      method: "POST",
      body: JSON.stringify({ sessionId }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Unable to delete scheduled email");
    }

    toast.success("Deleted Scheduled Email");
  } catch (error) {
    console.error("Unable to delete message");
    // throw error;
  }
}
