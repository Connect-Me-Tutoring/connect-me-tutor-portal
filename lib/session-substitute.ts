import type { Session } from "@/types";

/** Google Form tutors fill out so the operations team can find a substitute. */
export const SUBSTITUTE_REQUEST_FORM_URL = "https://forms.gle/AC4an7K6NSNumDwKA";

/** Statuses that put a session in the past bucket: it has happened and needs no more action. */
export const PAST_SESSION_STATUSES: Session["status"][] = [
  "Complete",
  "Cancelled",
  "Unconfirmed",
  "Student Did Not Attend",
];

const isUpcoming = (session: Session, now: Date) => new Date(session.date) > now;

/**
 * A Sub-Request session is still on the calendar (a substitute teaches it), so it stays with
 * the upcoming sessions until it starts and then moves to past sessions. It never needs an
 * exit form, and hours only count Complete sessions, so its tutor gets no hours for it.
 */
export const isActiveDashboardSession = (session: Session, now: Date = new Date()) =>
  session.status === "Active" || (session.status === "Sub-Request" && isUpcoming(session, now));

export const isPastDashboardSession = (session: Session, now: Date = new Date()) =>
  PAST_SESSION_STATUSES.includes(session.status) ||
  (session.status === "Sub-Request" && !isUpcoming(session, now));

/**
 * Opens the substitute request form in a new tab. Call it straight from the click handler,
 * before any await, so the browser still counts it as a user action and allows the tab.
 * Returns false when the tab was blocked, so the caller can navigate this tab instead.
 */
export function openSubstituteRequestForm(): boolean {
  const tab = window.open(SUBSTITUTE_REQUEST_FORM_URL, "_blank");
  if (!tab) return false;
  tab.opener = null;
  return true;
}
