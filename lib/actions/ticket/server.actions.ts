"use server";
import { createClient } from "../../supabase/server";
import { Table } from "../../supabase/tables";
import { requireAdmin, requireAuthenticatedProfile } from "../auth/authz.server";
import { logError } from "@/lib/posthog";
import { insertTicket, sendTicketEmail, ticketContactEmail } from "@/lib/tickets/server";
import {
  TICKET_STATUSES,
  type Ticket,
  type TicketCategory,
  type TicketStatus,
  type TicketUrgency,
  ticketFormSchema,
  type TicketFormValues,
} from "@/constants/tickets";

export type SubmitTicketResult = { ok: true; ticketId: string } | { ok: false; error: string };

/**
 * Stores a support ticket from the in-app "Get Help" form and notifies
 * the submitter with operations cc'd. The ticket is saved even if the email fails.
 */
export async function submitTicket(input: TicketFormValues): Promise<SubmitTicketResult> {
  const parsed = ticketFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid ticket." };
  }

  const ctx = await requireAuthenticatedProfile();
  const ticket = parsed.data;
  const ticketId = await insertTicket(ctx, ticket, "get_help");
  if (!ticketId) {
    return { ok: false, error: "We couldn't submit your ticket. Please try again." };
  }

  // The submitter gets a receipt with operations cc'd.
  // Without a contact email, fall back to notifying operations alone.
  const contactEmail = ticketContactEmail(ctx);
  await sendTicketEmail(ctx, ticketId, ticket, {
    to: contactEmail || process.env.OPERATIONS_EMAIL!,
    cc: contactEmail ? [process.env.OPERATIONS_EMAIL!] : undefined,
  });

  return { ok: true, ticketId };
}

/** All tickets, newest first, with the submitting profile's name and role. Admin only. */
export async function getTickets(): Promise<Ticket[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(Table.Tickets)
    .select(
      `id, created_at, category, urgency, subject, description, page_url, contact_email, status,
       submitter:Profiles!tickets_profile_id_fkey(first_name, last_name, role)`,
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Unable to fetch tickets", error);
    await logError(error, {}, "ticket_error");
    throw new Error("Unable to fetch tickets");
  }

  return data.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    category: row.category as TicketCategory,
    urgency: row.urgency as TicketUrgency,
    subject: row.subject,
    description: row.description,
    pageUrl: row.page_url,
    contactEmail: row.contact_email,
    status: row.status as TicketStatus,
    submitter: row.submitter
      ? {
          firstName: row.submitter.first_name,
          lastName: row.submitter.last_name,
          role: row.submitter.role ?? "",
        }
      : null,
  }));
}

/** Moves a ticket between open / in progress / resolved / closed. Admin only. */
export async function updateTicketStatus(ticketId: string, status: TicketStatus): Promise<void> {
  await requireAdmin();
  if (!TICKET_STATUSES.includes(status)) {
    throw new Error("Invalid ticket status");
  }

  const supabase = await createClient();
  const { error } = await supabase.from(Table.Tickets).update({ status }).eq("id", ticketId);

  if (error) {
    console.error("Unable to update ticket status", error);
    await logError(error, { ticket_id: ticketId, status }, "ticket_error");
    throw new Error("Unable to update ticket status");
  }
}
