"use server";
import React from "react";
import { createClient } from "../../supabase/server";
import { Table } from "../../supabase/tables";
import { requireAdmin, requireAuthenticatedProfile } from "../auth/authz.server";
import { sendMail } from "@/lib/email/mailer";
import { withRetry } from "@/lib/utils";
import { logError, logEvent } from "@/lib/posthog";
import NewTicketNotificationEmail from "@/components/emails/tickets/new-ticket-notification";
import {
  TICKET_CATEGORY_LABELS,
  TICKET_STATUSES,
  type Ticket,
  type TicketCategory,
  type TicketStatus,
  type TicketUrgency,
  TICKET_URGENCY_LABELS,
  ticketFormSchema,
  type TicketFormValues,
} from "@/constants/tickets";

export type SubmitTicketResult = { ok: true; ticketId: string } | { ok: false; error: string };

/**
 * Stores a support ticket from the in-app "Report an Issue" form and notifies
 * the submitter with operations cc'd. The ticket is saved even if the email fails.
 */
export async function submitTicket(input: TicketFormValues): Promise<SubmitTicketResult> {
  const parsed = ticketFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid ticket." };
  }

  const { user, profile } = await requireAuthenticatedProfile();
  const values = parsed.data;
  const contactEmail = profile.email || user.email || "";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(Table.Tickets)
    .insert({
      user_id: user.id,
      profile_id: profile.id,
      category: values.category,
      urgency: values.urgency,
      subject: values.subject,
      description: values.description,
      page_url: values.pageUrl || null,
      contact_email: contactEmail || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Unable to create ticket", error);
    await logError(error, { user_id: user.id, category: values.category }, "ticket_error");
    return { ok: false, error: "We couldn't submit your ticket. Please try again." };
  }

  await logEvent("ticket_submitted", {
    ticket_id: data.id,
    category: values.category,
    urgency: values.urgency,
    role: profile.role,
  });

  try {
    await withRetry(
      async () => {
        const result = await sendMail({
          from: "Connect Me Portal <notifications@connectmego.app>",
          // The submitter gets a receipt with operations cc'd.
          // Without a contact email, fall back to notifying operations alone.
          to: contactEmail || process.env.OPERATIONS_EMAIL!,
          cc: contactEmail ? [process.env.OPERATIONS_EMAIL!] : undefined,
          subject: `[Ticket][${values.urgency.toUpperCase()}] ${values.subject}`,
          react: React.createElement(NewTicketNotificationEmail, {
            ticketId: data.id,
            submitterName: `${profile.firstName} ${profile.lastName}`.trim(),
            submitterRole: profile.role,
            contactEmail,
            category: TICKET_CATEGORY_LABELS[values.category],
            urgency: TICKET_URGENCY_LABELS[values.urgency].label,
            subject: values.subject,
            description: values.description,
            pageUrl: values.pageUrl,
          }),
        });
        if (result.error) throw result.error;
        return result;
      },
      {
        onRetry: async (error, attempt) => {
          console.error(`submitTicket email attempt ${attempt + 1} failed:`, error);
          await logError(error, { ticket_id: data.id, attempt }, "ticket_error");
        },
      },
    );
  } catch (emailError) {
    console.error("Unable to send ticket notification email", emailError);
    await logError(emailError, { ticket_id: data.id }, "ticket_error");
  }

  return { ok: true, ticketId: data.id };
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
