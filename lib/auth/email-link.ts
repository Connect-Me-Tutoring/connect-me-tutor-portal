import type { EmailOtpType } from "@supabase/supabase-js";

const EMAIL_LINK_TYPES: readonly EmailOtpType[] = [
  "invite",
  "signup",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

export function parseEmailLinkType(value: unknown): EmailOtpType | null {
  return typeof value === "string" && (EMAIL_LINK_TYPES as readonly string[]).includes(value)
    ? (value as EmailOtpType)
    : null;
}

/**
 * Where to send the user after an email link is confirmed. Only same-site paths are
 * allowed so a crafted link can't bounce a freshly signed-in user to another site.
 */
export function safeNextPath(next: unknown, fallback = "/"): string {
  if (typeof next !== "string" || !next.startsWith("/") || /^\/[/\\]/.test(next)) {
    return fallback;
  }
  try {
    const base = "http://connect-me.invalid";
    const url = new URL(next, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
