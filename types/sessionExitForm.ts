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
