import "server-only";
import { Resend } from "resend";
import nodemailer, { type Transporter } from "nodemailer";
import { render } from "@react-email/components";
import type { ReactElement } from "react";
import { createAdminClient } from "@/lib/supabase/server";
import { Table } from "@/lib/supabase/tables";
import { logError } from "@/lib/posthog";

type MailAddress = string | string[];

export type SendMailParams = {
  from: string;
  to: MailAddress;
  cc?: MailAddress;
  subject: string;
  html?: string;
  react?: ReactElement;
};

export type SendMailResult = { data: { id: string } | null; error: unknown };

/**
 * Set EMAIL_PROVIDER=mailpit in .env.local to route mail to a local Mailpit
 * container (docker compose up -d mailpit) instead of Resend's live API.
 */
function getEmailProvider(): "resend" | "mailpit" {
  return process.env.EMAIL_PROVIDER === "mailpit" ? "mailpit" : "resend";
}

let resendClient: Resend | null = null;
function getResendClient(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

let mailpitTransport: Transporter | null = null;
function getMailpitTransport(): Transporter {
  if (!mailpitTransport) {
    mailpitTransport = nodemailer.createTransport({ host: "localhost", port: 1025 });
  }
  return mailpitTransport;
}

async function resolveHtml(params: SendMailParams): Promise<string> {
  if (params.html) return params.html;
  if (params.react) return render(params.react);
  throw new Error("sendMail requires either html or react content");
}

async function sendViaMailpit(params: SendMailParams): Promise<SendMailResult> {
  const html = await resolveHtml(params);
  const info = await getMailpitTransport().sendMail({
    from: params.from,
    to: params.to,
    cc: params.cc,
    subject: params.subject,
    html,
  });

  return { data: { id: info.messageId }, error: null };
}

async function sendViaResend(params: SendMailParams): Promise<SendMailResult> {
  // Resend's own type requires at least one of html/react, which SendMailParams
  // (deliberately looser, to share a shape with the Mailpit path) can't express.
  return getResendClient().emails.send(params as Parameters<Resend["emails"]["send"]>[0]);
}

async function recordSentEmail(params: SendMailParams): Promise<void> {
  try {
    const html = await resolveHtml(params);
    const recipientEmail = Array.isArray(params.to) ? params.to.join(", ") : params.to;

    const supabase = await createAdminClient();
    const { error } = await supabase.from(Table.Emails).insert({
      recipient_email: recipientEmail,
      subject: params.subject,
      content: html,
    });

    if (error) {
      await logError(error, { to: params.to, subject: params.subject }, "email_record_error");
    }
  } catch (error) {
    await logError(error, { to: params.to, subject: params.subject }, "email_record_error");
  }
}

export async function sendMail(params: SendMailParams): Promise<SendMailResult> {
  if (getEmailProvider() === "mailpit") {
    return sendViaMailpit(params);
  }

  const result = await sendViaResend(params);
  if (!result.error) {
    await recordSentEmail(params);
  }
  return result;
}
