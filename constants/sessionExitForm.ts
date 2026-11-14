import { SessionExitFormCategory } from "@/types/sessionExitForm";

export const SESSION_SUBJECTS = [
  "Math",
  "Science",
  "English/ELA",
  "Social Studies",
  "World Languages",
  "Computer Science",
  "Other",
] as const;

export const CATEGORY_LABELS: Record<SessionExitFormCategory, string> = {
  attendance: "Attendance & Engagement",
  technical: "Technical and Portal Issues",
  behavior: "Student Behavior and Support",
  urgent: "Urgent Escalation",
};
