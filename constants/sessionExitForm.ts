import type { SessionExitFormCategory } from "@/types/sessionExitForm";

export const SESSION_SUBJECTS = [
  "Math",
  "Science",
  "English/ELA",
  "Social Studies",
  "World Languages",
  "Computer Science",
  "Test Prep",
  "Other",
] as const;

export type SessionSubject = (typeof SESSION_SUBJECTS)[number];

export const isSessionSubject = (value: unknown): value is SessionSubject =>
  typeof value === "string" && SESSION_SUBJECTS.some((subject) => subject === value);

export const CATEGORY_LABELS: Record<SessionExitFormCategory, string> = {
  attendance: "Attendance & Engagement",
  technical: "Technical and Portal Issues",
  behavior: "Student Behavior and Support",
  urgent: "Urgent Escalation",
};
