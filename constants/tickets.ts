import { z } from "zod";

export const SERIOUS_INCIDENT_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdWtwkfILDsd6o6skBhUoeEa0SprHxk4-B1ZjRpa3zPPiwTzw/viewform?usp=sharing";

export const TICKET_CATEGORIES = [
  "technical",
  "sessions",
  "account",
  "pairing",
  "hours",
  "feedback",
  "other",
] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  technical: "Bug or technical problem with the portal",
  sessions: "Sessions, scheduling, or Zoom links",
  account: "Account, login, or profile",
  pairing: "Tutor / student pairing",
  hours: "Volunteer hours",
  feedback: "Feedback or feature suggestion",
  other: "Something else",
};

export const TICKET_URGENCIES = ["low", "medium", "high"] as const;

export type TicketUrgency = (typeof TICKET_URGENCIES)[number];

export const TICKET_URGENCY_LABELS: Record<TicketUrgency, { label: string; description: string }> =
  {
    low: { label: "Low", description: "Minor annoyance or a question — no rush" },
    medium: { label: "Medium", description: "Something isn't working but I have a workaround" },
    high: { label: "High", description: "I'm blocked or can't attend/run a session" },
  };

export const ticketFormSchema = z.object({
  category: z.enum(TICKET_CATEGORIES, {
    required_error: "Please choose what this is about.",
  }),
  urgency: z.enum(TICKET_URGENCIES),
  subject: z
    .string()
    .trim()
    .min(1, "Please add a short summary.")
    .max(200, "Keep the summary under 200 characters."),
  description: z
    .string()
    .trim()
    .min(10, "Please describe the issue in a bit more detail.")
    .max(5000, "Keep the description under 5000 characters."),
  /** Filled automatically from the page the dialog was opened on. */
  pageUrl: z.string().trim().max(500).optional(),
});

export type TicketFormValues = z.infer<typeof ticketFormSchema>;

export const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

/** Statuses that count as "ongoing" in the admin Tickets view. */
export const ONGOING_TICKET_STATUSES: TicketStatus[] = ["open", "in_progress"];

export interface Ticket {
  id: string;
  createdAt: string;
  category: TicketCategory;
  urgency: TicketUrgency;
  subject: string;
  description: string;
  pageUrl: string | null;
  contactEmail: string | null;
  status: TicketStatus;
  submitter: { firstName: string; lastName: string; role: string } | null;
}
