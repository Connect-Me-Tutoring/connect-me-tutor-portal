import "server-only";
import { createHash, randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { sendMail } from "@/lib/email/mailer";
import { provisionUser } from "@/lib/auth/provision-user.server";
import { logError } from "@/lib/posthog";
import ParentalConsentRequestEmail from "@/components/emails/consent/parental-consent-request-email";
import type { CreatedProfileData } from "@/types";
import type { Json } from "@/types/database.types";
import {
  CONSENT_REQUEST_TTL_DAYS,
  CONSENT_TEXT_VERSION,
  type ConsentRequestSummary,
  type PendingParentalConsent,
} from "./types";

const TABLE = "parental_consents";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Parks the student's profile data and emails the parent a consent link. No auth
 * user or Profiles row is created until the parent approves.
 */
export async function createConsentRequest(
  newProfileData: CreatedProfileData,
  requestedBy: string | null,
): Promise<PendingParentalConsent> {
  const parentEmail = newProfileData.parentEmail?.trim().toLowerCase();
  if (!parentEmail) {
    throw new Error("A parent/guardian email is required for students under 13");
  }

  const supabase = await createAdminClient();

  // Re-submitting for the same student replaces any earlier outstanding request.
  const { error: supersedeError } = await supabase
    .from(TABLE)
    .update({ status: "expired", pending_profile: null, resolved_at: new Date().toISOString() })
    .eq("status", "pending")
    .eq("pending_profile->>email", newProfileData.email);
  if (supersedeError) throw supersedeError;

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + CONSENT_REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000);

  // The temp password is not needed after approval (the student sets their own).
  const { password: _password, ...profileWithoutPassword } = newProfileData;

  const { data: row, error } = await supabase
    .from(TABLE)
    .insert({
      token_hash: hashToken(token),
      parent_email: parentEmail,
      parent_name: newProfileData.parentName || null,
      student_first_name: newProfileData.firstName,
      expires_at: expiresAt.toISOString(),
      pending_profile: profileWithoutPassword as unknown as Json,
      requested_by: requestedBy,
    })
    .select("id")
    .single();
  if (error) throw error;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.connectmego.app";
  const { error: mailError } = await sendMail({
    from: "Connect Me Free Tutoring & Mentoring <consent@connectmego.app>",
    to: parentEmail,
    subject: `Permission needed: ${newProfileData.firstName}'s Connect Me account`,
    react: ParentalConsentRequestEmail({
      parentName: newProfileData.parentName,
      studentFirstName: newProfileData.firstName,
      consentUrl: `${siteUrl}/parental-consent/${token}`,
      privacyUrl: `${siteUrl}/privacy`,
      expiresInDays: CONSENT_REQUEST_TTL_DAYS,
    }),
  });

  if (mailError) {
    // Don't leave a request nobody can act on.
    await supabase.from(TABLE).delete().eq("id", row.id);
    await logError(mailError, { action: "createConsentRequest" }, "email_error");
    throw new Error("Could not send the consent email to the parent/guardian");
  }

  return { status: "pending_parental_consent", parentEmail };
}

type ConsentRow = {
  id: string;
  status: ConsentRequestSummary["status"] | "processing";
  expires_at: string;
  student_first_name: string;
  parent_name: string | null;
};

async function findByToken(token: string): Promise<ConsentRow | null> {
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, status, expires_at, student_first_name, parent_name")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error) throw error;
  return data as ConsentRow | null;
}

/** Safe-to-show details for the public consent page; null for an unknown token. */
export async function getConsentRequestSummary(
  token: string,
): Promise<ConsentRequestSummary | null> {
  const row = await findByToken(token);
  if (!row) return null;

  const expired = row.status === "pending" && new Date(row.expires_at) < new Date();
  return {
    studentFirstName: row.student_first_name,
    parentName: row.parent_name,
    status: expired ? "expired" : row.status === "processing" ? "pending" : row.status,
  };
}

export type ResolveResult = "approved" | "declined" | "expired" | "invalid" | "already_resolved";

export async function resolveConsentRequest(
  token: string,
  decision: "approve" | "decline",
  meta: { ip: string | null; userAgent: string | null },
): Promise<ResolveResult> {
  const supabase = await createAdminClient();
  const nowIso = new Date().toISOString();

  // The conditional update claims the request, so a double-click or a retried
  // request cannot provision the student twice.
  const { data: claimed, error } = await supabase
    .from(TABLE)
    .update({
      status: "processing",
      resolved_at: nowIso,
      consent_text_version: CONSENT_TEXT_VERSION,
      resolved_ip: meta.ip,
      resolved_user_agent: meta.userAgent,
    })
    .eq("token_hash", hashToken(token))
    .eq("status", "pending")
    .gt("expires_at", nowIso)
    .select("id, pending_profile")
    .maybeSingle();
  if (error) throw error;

  if (!claimed) {
    const existing = await findByToken(token);
    if (!existing) return "invalid";
    if (existing.status === "pending" || existing.status === "expired") return "expired";
    return "already_resolved";
  }

  const profileData = claimed.pending_profile as CreatedProfileData | null;

  if (decision === "decline" || !profileData) {
    await supabase
      .from(TABLE)
      .update({ status: "declined", pending_profile: null })
      .eq("id", claimed.id);
    return "declined";
  }

  try {
    const profile = await provisionUser(profileData);
    await supabase
      .from(TABLE)
      .update({ status: "approved", pending_profile: null, profile_id: profile.id })
      .eq("id", claimed.id);
    return "approved";
  } catch (provisionError) {
    // Release the claim so the parent can retry from the same link.
    await supabase
      .from(TABLE)
      .update({
        status: "pending",
        resolved_at: null,
        consent_text_version: null,
        resolved_ip: null,
        resolved_user_agent: null,
      })
      .eq("id", claimed.id);
    await logError(provisionError, { action: "resolveConsentRequest" }, "auth_error");
    throw provisionError;
  }
}
