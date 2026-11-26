/**
 * Design tokens for transactional emails.
 *
 * Email clients ignore CSS variables and Tailwind classes, so the portal's design tokens
 * are inlined here as hex values. Brand colors mirror tailwind.config.ts; neutrals mirror
 * the shadcn tokens in app/globals.css. Change them here, not in individual templates.
 */
export const emailColors = {
  // Brand palette (tailwind.config.ts)
  blue1: "#B7E2F2",
  blue2: "#6AB2D7",
  blue3: "#0E5B94",
  blue4: "#104A75",
  blue5: "#0B3967",
  gray1: "#8494A8",
  gray2: "#495860",
  gray3: "#30302F",
  black: "#040405",
  // shadcn neutrals (app/globals.css)
  page: "#FAFAFA", // --sidebar-background
  card: "#FFFFFF", // --card
  border: "#E5E5E5", // --border
  muted: "#737373", // --muted-foreground
  subtle: "#F5F5F5", // --muted
  // A light wash of connect-me-blue-1, like the portal's active nav item.
  tint: "#EEF7FB",
  white: "#FFFFFF",
} as const;

export const emailFont =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export type EmailTone = "info" | "warning" | "danger" | "success" | "neutral";

/** Colors for badges and callouts, by tone. */
export const emailTones: Record<
  EmailTone,
  { background: string; border: string; accent: string; title: string; text: string }
> = {
  info: {
    background: emailColors.tint,
    border: emailColors.blue1,
    accent: emailColors.blue3,
    title: emailColors.blue5,
    text: emailColors.gray2,
  },
  warning: {
    background: "#FFFBEB",
    border: "#FDE68A",
    accent: "#D97706",
    title: "#92400E",
    text: "#78350F",
  },
  danger: {
    background: "#FEF2F2",
    border: "#FECACA",
    accent: "#DC2626",
    title: "#991B1B",
    text: "#7F1D1D",
  },
  success: {
    background: "#F0FDF4",
    border: "#BBF7D0",
    accent: "#16A34A",
    title: "#166534",
    text: "#14532D",
  },
  neutral: {
    background: emailColors.subtle,
    border: emailColors.border,
    accent: emailColors.gray2,
    title: emailColors.black,
    text: emailColors.gray2,
  },
};

export const emailSiteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.connectmego.app")
  .trim()
  .replace(/^(["'])(.*)\1$/, "$2")
  .replace(/\/$/, "");

/** Absolute URL of the logo; email clients cannot load relative paths. */
export const emailLogoUrl = `${emailSiteUrl}/logo.png`;

export const DEFAULT_SIGNATURE = "Connect Me Free Tutoring & Mentoring";
