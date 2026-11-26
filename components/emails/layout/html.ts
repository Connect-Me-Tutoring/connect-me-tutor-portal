import { getEmailFooterHtml } from "@/components/emails/email-footer";
import {
  DEFAULT_SIGNATURE,
  emailColors as c,
  emailFont,
  emailLogoUrl,
  emailTones,
  type EmailTone,
} from "@/components/emails/layout/tokens";

/*
 * String versions of the email building blocks in ./components.tsx, for templates that
 * return raw HTML instead of a React element. They produce the same table-based markup
 * and styles, so these emails look the same as the React ones.
 */

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape a value before interpolating it into HTML. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

const textStyle = `margin:0 0 16px;color:${c.black};font-size:15px;line-height:24px;`;

/** A body paragraph. `html` is inserted as-is: escape any user data in it. */
export function emailTextHtml(html: string): string {
  return `<p style="${textStyle}">${html}</p>`;
}

export function emailLinkHtml(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="color:${c.blue3};text-decoration:underline;">${label}</a>`;
}

export function emailBadgeHtml(label: string, tone: EmailTone = "info"): string {
  const t = emailTones[tone];
  return `<p style="display:inline-block;margin:0 0 16px;padding:2px 10px;border-radius:9999px;background-color:${t.background};border:1px solid ${t.border};color:${t.accent};font-size:12px;line-height:20px;font-weight:600;">● ${label}</p>`;
}

export function emailHeadingHtml(title: string, description?: string): string {
  return (
    `<h1 style="margin:${description ? "0 0 6px" : "0 0 24px"};font-size:22px;line-height:30px;font-weight:600;letter-spacing:-0.01em;color:${c.black};">${title}</h1>` +
    (description
      ? `<p style="margin:0 0 24px;color:${c.muted};font-size:14px;line-height:24px;">${description}</p>`
      : "")
  );
}

export function emailCalloutHtml({
  title,
  tone = "info",
  paragraphs = [],
}: {
  title?: string;
  tone?: EmailTone;
  paragraphs?: string[];
}): string {
  const t = emailTones[tone];
  const titleHtml = title
    ? `<p style="margin:${paragraphs.length ? "0 0 4px" : "0"};font-size:14px;line-height:22px;font-weight:600;color:${t.title};">${title}</p>`
    : "";
  const body = paragraphs
    .map(
      (p, i) =>
        `<p style="margin:${i < paragraphs.length - 1 ? "0 0 8px" : "0"};font-size:14px;line-height:22px;color:${t.text};">${p}</p>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;background-color:${t.background};border:1px solid ${t.border};border-left:4px solid ${t.accent};border-radius:8px;"><tr><td style="padding:14px 16px;">${titleHtml}${body}</td></tr></table>`;
}

export function emailButtonHtml(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px;"><tr><td style="border-radius:6px;background-color:${c.blue3};"><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 20px;font-size:14px;font-weight:600;color:${c.white};text-decoration:none;border-radius:6px;">${label}</a></td></tr></table>`;
}

export function emailSignatureHtml(closing = "Best regards,", name = DEFAULT_SIGNATURE): string {
  return `<hr style="border:none;border-top:1px solid ${c.border};margin:24px 0 16px;" /><p style="margin:0;font-size:14px;line-height:22px;color:${c.muted};">${escapeHtml(closing)}</p><p style="margin:0;font-size:14px;line-height:22px;font-weight:600;color:${c.black};">${escapeHtml(name)}</p>`;
}

/** Wrap content in the page, brand row and card with the shared footer. */
export function emailLayoutHtml({
  content,
  preview,
  footerTagline,
  logoUrl = emailLogoUrl,
}: {
  content: string;
  preview?: string;
  footerTagline?: string;
  logoUrl?: string;
}): string {
  const previewHtml = preview
    ? `<div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;">${escapeHtml(preview)}</div>`
    : "";
  // getEmailFooterHtml adds its own top margin; the footer here sits flush with the card.
  const footer = getEmailFooterHtml(footerTagline).replace("margin-top: 24px; ", "");
  return `<div style="margin:0;padding:0;background-color:${c.page};font-family:${emailFont};">${previewHtml}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${c.page};"><tr><td align="center" style="padding:32px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;"><tr><td style="padding:0 4px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="width:36px;"><img src="${escapeHtml(logoUrl)}" width="28" height="28" alt="Connect Me" style="display:block;" /></td><td><p style="margin:0;font-size:17px;font-weight:700;color:${c.black};">Connect Me</p></td></tr></table></td></tr><tr><td style="background-color:${c.card};border:1px solid ${c.border};border-radius:8px;box-shadow:0 1px 2px 0 rgba(0,0,0,0.05);"><div style="padding:28px;">${content}</div>${footer}</td></tr></table></td></tr></table></div>`;
}
