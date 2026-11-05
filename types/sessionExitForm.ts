import type { Session } from "@/types";

export type SessionExitFormCategory = "attendance" | "technical" | "behavior" | "urgent";

export interface SessionExitFormPayload {
  tutorFirstName?: string;
  tutorLastName?: string;
  studentFirstName?: string;
  studentLastName?: string;
  formContent: string;
  tutorEmail?: string;
  studentEmail?: string;
  category?: string;
}

export interface SubmitSessionExitFormInput {
  sessionId: string;
  notes: string;
  isQuestionOrConcern: boolean;
  isFirstSession: boolean;
}

/**
 * Outcome of the server-side SEF write. `already_submitted` means the conditional update
 * matched no row because the session was completed elsewhere (another tab, a double submit);
 * `session` then holds the row as it stands so the dashboard can catch up.
 */
export type SubmitSessionExitFormResult =
  | { ok: true; session: Session }
  | { ok: false; reason: "already_submitted"; session: Session }
  | { ok: false; reason: "not_active" | "invalid" | "error" };
