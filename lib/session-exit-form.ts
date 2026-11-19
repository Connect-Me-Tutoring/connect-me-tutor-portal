import { submitSessionExitForm } from "@/lib/actions/tutor/actions";
import type { Session } from "@/types";

export interface SessionExitFormSubmission {
  session: Session;
  notes: string;
  isQuestionOrConcern: boolean;
  isFirstSession: boolean;
  category?: string;
}

/**
 * What the form gets back. `ok: true` is only returned once the server has confirmed the
 * write (or reports the form was already submitted); everything else carries one message
 * the form shows inline while staying open.
 */
export type SessionExitFormOutcome =
  { ok: true; session: Session; alreadySubmitted: boolean } | { ok: false; error: string };

const GENERIC_SAVE_ERROR =
  "We couldn't save your Session Exit Form. Your notes are still here. Please try again.";

/**
 * Shared submit flow for the tutor and student dashboards.
 *
 * Order matters: the question/concern goes out first, so if it fails nothing has been
 * saved and a retry starts clean. The session write comes second and is the only thing
 * that decides success. Nothing here touches dashboard state; callers update it from the
 * session the server returns.
 */
export async function submitSessionExitFormFlow({
  session,
  notes,
  isQuestionOrConcern,
  isFirstSession,
  category,
}: SessionExitFormSubmission): Promise<SessionExitFormOutcome> {
  if (isQuestionOrConcern) {
    try {
      const response = await fetch("/api/session-exit-form/questions-concerns", {
        headers: { "Content-Type": "application/json" },
        method: "POST",
        body: JSON.stringify({
          tutorFirstName: session.tutor?.firstName,
          tutorLastName: session.tutor?.lastName,
          studentFirstName: session.student?.firstName,
          studentLastName: session.student?.lastName,
          formContent: notes,
          tutorEmail: session.tutor?.email,
          studentEmail: session.student?.email,
          category,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? `HTTP ${response.status}`);
      }
    } catch (error) {
      console.error("Failed to record question or concern", error);
      return {
        ok: false,
        error: "We couldn't send your question or concern, so nothing was saved. Please try again.",
      };
    }
  }

  let result;
  try {
    result = await submitSessionExitForm({
      sessionId: session.id,
      notes,
      isQuestionOrConcern,
      isFirstSession,
    });
  } catch (error) {
    // Network failure or the server action itself blowing up.
    console.error("Failed to submit Session Exit Form", error);
    return { ok: false, error: GENERIC_SAVE_ERROR };
  }

  if (result.ok) {
    return { ok: true, session: result.session, alreadySubmitted: false };
  }

  switch (result.reason) {
    case "already_submitted":
      return { ok: true, session: result.session, alreadySubmitted: true };
    case "not_active":
      return {
        ok: false,
        error: "This session is no longer active, so a Session Exit Form can't be submitted.",
      };
    case "invalid":
      return { ok: false, error: "Please fill in the form before submitting." };
    default:
      return { ok: false, error: GENERIC_SAVE_ERROR };
  }
}
