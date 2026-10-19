export const PARENTAL_CONSENT_AGE_LIMIT = 13;

/**
 * Students under 13 need verifiable parental consent (COPPA) before an account
 * exists. Profiles.age is free text, so anything we cannot read as a whole
 * number counts as requiring consent rather than silently skipping the gate.
 */
export function requiresParentalConsent(role: string, age: string | null | undefined): boolean {
  if (role.toLowerCase() !== "student") return false;

  const trimmed = (age ?? "").trim();
  if (!/^\d{1,3}$/.test(trimmed)) return true;

  return Number(trimmed) < PARENTAL_CONSENT_AGE_LIMIT;
}
