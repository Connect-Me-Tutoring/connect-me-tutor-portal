import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase/server";
import { Table } from "@/lib/supabase/tables";
import { logError } from "@/lib/posthog";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";
  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = next;

  if (token_hash && type) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      if (type === "email_change") {
        await syncConfirmedEmail(supabase);
      }
      return NextResponse.redirect(redirectTo);
    } else {
      console.error("Auth Error", error);
      await logError(error, { type }, "auth_confirm_error");
    }
  }

  // return the user to an error page with some instructions
  redirectTo.pathname = "/auth/auth-code-error";
  return NextResponse.redirect(redirectTo);
}

/**
 * Copies the confirmed login email onto every profile under the account
 * (profiles share one login). With double_confirm_changes the first link
 * leaves user.new_email set and the email unchanged, so this only writes
 * once the change has fully applied.
 */
async function syncConfirmedEmail(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || user.new_email) return;

  const admin = await createAdminClient();
  const { error } = await admin
    .from(Table.Profiles)
    .update({ email: user.email })
    .eq("user_id", user.id);
  if (error) {
    await logError(error, { userId: user.id }, "email_sync_error");
  }
}
