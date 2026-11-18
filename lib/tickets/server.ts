import "server-only";
import React from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { Table } from "@/lib/supabase/tables";
import { sendMail } from "@/lib/email/mailer";
import { withRetry } from "@/lib/utils";
import { logError, logEvent } from "@/lib/posthog";
import NewTicketNotificationEmail from "@/components/emails/tickets/new-ticket-notification";
import {
  TECH_TEAM_EMAIL,
  TICKET_CATEGORY_LABELS,
  TICKET_URGENCY_LABELS,
  type TicketCategory,
  type TicketUrgency,
} from "@/constants/tickets";
import type { Profile } from "@/types";

const TICKET_FROM = "Connect Me Portal <notifications@connectmego.app>";

export interface NewTicket {
  category: TicketCategory;
  urgency: TicketUrgency;
  subject: string;
  description: string;
  pageUrl?: string | null;
}

interface TicketContext {
  user: User;
  profile: Profile;
}

export function ticketContactEmail({ user, profile }: TicketContext): string {
  return profile.email || user.email || "";
}

/**
 * Inserts a ticket as the signed-in user (RLS requires user_id = auth.uid()).
 * Returns the new id, or null if the insert failed; the error is already logged.
 */
export async function insertTicket(
  ctx: TicketContext,
  ticket: NewTicket,
  source: "get_help" | "session_exit_form",
): Promise<string | null> {
  const { user, profile } = ctx;
  const contactEmail = ticketContactEmail(ctx);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(Table.Tickets)
    .insert({
      user_id: user.id,
      profile_id: profile.id,
      category: ticket.category,
      urgency: ticket.urgency,
      subject: ticket.subject,
      description: ticket.description,
      page_url: ticket.pageUrl || null,
      contact_email: contactEmail || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Unable to create ticket", error);
    await logError(error, { user_id: user.id, category: ticket.category, source }, "ticket_error");
    return null;
  }

  await logEvent("ticket_submitted", {
    ticket_id: data.id,
    category: ticket.category,
    urgency: ticket.urgency,
    role: profile.role,
    source,
  });

  return data.id;
}

/**
 * Sends the ticket notification email with retries. Never throws: the ticket is
 * already saved, so a mail failure is logged and swallowed.
 */
export async function sendTicketEmail(
  ctx: TicketContext,
  ticketId: string,
  ticket: NewTicket,
  recipients: { to: string | string[]; cc?: string[]; replyTo?: string },
  intro?: string,
): Promise<void> {
  const { profile } = ctx;
  const contactEmail = ticketContactEmail(ctx);
  try {
    await withRetry(
      async () => {
        const result = await sendMail({
          from: TICKET_FROM,
          to: recipients.to,
          cc: recipients.cc,
          replyTo: recipients.replyTo,
          subject: `[Ticket][${ticket.urgency.toUpperCase()}] ${ticket.subject}`,
          react: React.createElement(NewTicketNotificationEmail, {
            ticketId,
            submitterName: `${profile.firstName} ${profile.lastName}`.trim(),
            submitterRole: profile.role,
            contactEmail,
            category: TICKET_CATEGORY_LABELS[ticket.category],
            urgency: TICKET_URGENCY_LABELS[ticket.urgency].label,
            subject: ticket.subject,
            description: ticket.description,
            pageUrl: ticket.pageUrl ?? undefined,
            intro,
          }),
        });
        if (result.error) throw result.error;
        return result;
      },
      {
        onRetry: async (error, attempt) => {
          console.error(`Ticket email attempt ${attempt + 1} failed:`, error);
          await logError(error, { ticket_id: ticketId, attempt }, "ticket_error");
        },
      },
    );
  } catch (emailError) {
    console.error("Unable to send ticket notification email", emailError);
    await logError(emailError, { ticket_id: ticketId }, "ticket_error");
  }
}

/**
 * A Session Exit Form concern in the "technical" category also becomes a support
 * ticket, and the tech team is emailed. Best-effort: the concern is already recorded
 * in the sheet, so failures here are logged and never surface to the form.
 */
export async function createSessionExitFormTechTicket(
  ctx: TicketContext,
  concern: { formContent: string; tutorName?: string; studentName?: string },
): Promise<string | null> {
  try {
    const between = [concern.tutorName, concern.studentName].filter(Boolean).join(" / ");
    const subject = `Session Exit Form technical issue${between ? ` (${between})` : ""}`.slice(
      0,
      200,
    );
    const ticket: NewTicket = {
      category: "technical",
      urgency: "medium",
      subject,
      description: concern.formContent.slice(0, 5000),
      pageUrl: null,
    };

    const ticketId = await insertTicket(ctx, ticket, "session_exit_form");
    if (!ticketId) return null;

    await sendTicketEmail(
      ctx,
      ticketId,
      ticket,
      { to: TECH_TEAM_EMAIL, replyTo: ticketContactEmail(ctx) || undefined },
      "A technical issue was reported through a Session Exit Form. A ticket has been opened in the admin Tickets view.",
    );
    return ticketId;
  } catch (error) {
    console.error("Unable to create Session Exit Form tech ticket", error);
    await logError(error, { user_id: ctx.user.id, source: "session_exit_form" }, "ticket_error");
    return null;
  }
}
