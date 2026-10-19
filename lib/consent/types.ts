/** Bump when the consent page wording or the privacy policy changes materially. */
export const CONSENT_TEXT_VERSION = "2026-10-19";

export const CONSENT_REQUEST_TTL_DAYS = 7;

/** Returned by createUser instead of a Profile when the student needs parental consent first. */
export type PendingParentalConsent = {
  status: "pending_parental_consent";
  parentEmail: string;
};

export function isPendingParentalConsent(result: unknown): result is PendingParentalConsent {
  return (
    typeof result === "object" &&
    result !== null &&
    (result as { status?: unknown }).status === "pending_parental_consent"
  );
}

export type ConsentRequestSummary = {
  studentFirstName: string;
  parentName: string | null;
  status: "pending" | "approved" | "declined" | "expired";
};
