"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { resolveConsentRequest, type ResolveResult } from "@/lib/consent/parental-consent.server";

/**
 * Public on purpose: the unguessable emailed token is the credential. The change
 * happens on POST (not when the page loads) so email link scanners that prefetch
 * the URL cannot approve on a parent's behalf.
 */
export async function respondToConsentRequest(
  token: string,
  decision: "approve" | "decline",
): Promise<ResolveResult> {
  const h = await headers();
  const result = await resolveConsentRequest(token, decision, {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
  });
  revalidatePath(`/parental-consent/${token}`);
  return result;
}
