"use server";
import { endOfWeek, startOfWeek, subDays } from "date-fns";
import { createClient } from "../../supabase/server";
import { Table } from "../../supabase/tables";
import { requireAdmin } from "../auth/authz.server";
import { logError } from "@/lib/posthog";
import { ONGOING_TICKET_STATUSES } from "@/constants/tickets";
import { hasTutorOrientationAccess } from "@/lib/orientation/config.server";

export interface AdminDashboardSummary {
  ongoingTickets: number;
  highUrgencyTickets: number;
  pairingQueue: number;
  unloggedSessionsLast7Days: number;
  sessionsThisWeek: number;
  tutorsOrientationIncomplete: number;
  recentTickets: {
    id: string;
    subject: string;
    urgency: string;
    status: string;
    createdAt: string;
  }[];
}

/** Counts of work waiting on an admin, shown on the admin dashboard home. */
export async function getAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  await requireAdmin();
  const supabase = await createClient();
  const now = new Date();

  const [
    ongoingTickets,
    highUrgencyTickets,
    pairingQueue,
    unloggedSessions,
    sessionsThisWeek,
    tutorsOrientationIncomplete,
    recentTickets,
  ] = await Promise.all([
    supabase
      .from(Table.Tickets)
      .select("id", { count: "exact", head: true })
      .in("status", ONGOING_TICKET_STATUSES),
    supabase
      .from(Table.Tickets)
      .select("id", { count: "exact", head: true })
      .in("status", ONGOING_TICKET_STATUSES)
      .eq("urgency", "high"),
    // Matches the Pairing Queue page: pending requests not explicitly pulled from the queue.
    supabase
      .from(Table.PairingRequests)
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .or("in_queue.is.null,in_queue.eq.true"),
    // Sessions still Active 48h after their date are flipped to Unconfirmed,
    // i.e. the tutor never logged them.
    supabase
      .from(Table.Sessions)
      .select("id", { count: "exact", head: true })
      .eq("status", "Unconfirmed")
      .gte("date", subDays(now, 7).toISOString()),
    supabase
      .from(Table.Sessions)
      .select("id", { count: "exact", head: true })
      .neq("status", "Cancelled")
      .gte("date", startOfWeek(now).toISOString())
      .lte("date", endOfWeek(now).toISOString()),
    supabase
      .from(Table.Profiles)
      .select("id, email, role")
      .eq("role", "Tutor")
      .eq("status", "Active")
      .is("orientation_completed_at", null),
    supabase
      .from(Table.Tickets)
      .select("id, subject, urgency, status, created_at")
      .in("status", ONGOING_TICKET_STATUSES)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const firstError = [
    ongoingTickets,
    highUrgencyTickets,
    pairingQueue,
    unloggedSessions,
    sessionsThisWeek,
    tutorsOrientationIncomplete,
    recentTickets,
  ].find((result) => result?.error)?.error;

  if (firstError) {
    console.error("Unable to load admin dashboard summary", firstError);
    await logError(firstError, {}, "admin_dashboard_error");
    throw new Error("Unable to load admin dashboard summary");
  }

  const tutorsWithOrientationEnabled = await Promise.all(
    (tutorsOrientationIncomplete.data ?? []).map((tutor) => hasTutorOrientationAccess(tutor)),
  );

  return {
    ongoingTickets: ongoingTickets.count ?? 0,
    highUrgencyTickets: highUrgencyTickets.count ?? 0,
    pairingQueue: pairingQueue.count ?? 0,
    unloggedSessionsLast7Days: unloggedSessions.count ?? 0,
    sessionsThisWeek: sessionsThisWeek.count ?? 0,
    tutorsOrientationIncomplete: tutorsWithOrientationEnabled.filter(Boolean).length,
    recentTickets: (recentTickets.data ?? []).map((ticket) => ({
      id: ticket.id,
      subject: ticket.subject,
      urgency: ticket.urgency,
      status: ticket.status,
      createdAt: ticket.created_at,
    })),
  };
}
