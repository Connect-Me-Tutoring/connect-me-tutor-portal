"use server";

import { requireAdmin } from "@/lib/actions/auth/authz.server";
import { createAdminClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/posthog";
import { Table } from "@/lib/supabase/tables";

export async function sendSignInCode(profileId: string) {
  const { user } = await requireAdmin();
  const track = (event: string, properties?: Record<string, unknown>) =>
    logEvent(event, { source: "admin", profile_id: profileId, ...properties }, user.id).catch(
      (error) => console.error("Unable to track admin OTP event", error),
    );

  await track("auth_otp_send_requested");
  try {
    const result = await sendCodeForProfile(profileId);
    await track("auth_otp_send_completed", {
      outcome: result.ok ? "accepted" : "failed",
      failure_reason: result.ok ? undefined : result.error,
    });
    return result;
  } catch (error) {
    await track("auth_otp_send_completed", {
      outcome: "failed",
      failure_reason: "unexpected_error",
    });
    throw error;
  }
}

async function sendCodeForProfile(profileId: string) {
  const supabase = await createAdminClient();

  const { data: profile, error: profileError } = await supabase
    .from(Table.Profiles)
    .select("user_id")
    .eq("id", profileId)
    .maybeSingle();

  if (profileError) {
    console.error("Unable to look up profile for sign-in code", profileError);
    return { ok: false, error: "Could not look up the profile. Please try again." } as const;
  }
  if (!profile?.user_id) {
    return { ok: false, error: "This profile has no linked login." } as const;
  }

  // The auth email is authoritative. Profiles can share a login or have stale email copies.
  const { data, error: lookupError } = await supabase.auth.admin.getUserById(profile.user_id);
  if (lookupError && lookupError.code !== "user_not_found") {
    console.error("Unable to look up linked login for sign-in code", lookupError);
    return { ok: false, error: "Could not look up the linked login. Please try again." } as const;
  }
  const email = data?.user?.email;
  if (!email) {
    return { ok: false, error: "This profile has no linked login with an email address." } as const;
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  if (error?.code === "over_email_send_rate_limit" || error?.status === 429) {
    return {
      ok: false,
      error:
        "Email rate limit reached. Ask the user to check for a recent code or try again later.",
    } as const;
  }
  if (error) {
    console.error("Unable to send sign-in code", error);
    return { ok: false, error: "Could not send a sign-in code. Please try again." } as const;
  }

  return { ok: true, email } as const;
}
