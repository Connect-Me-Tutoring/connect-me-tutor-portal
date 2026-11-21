import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase/server";
import { Table } from "@/lib/supabase/tables";
import { logError } from "@/lib/posthog";
import { parseEmailLinkType, safeNextPath } from "@/lib/auth/email-link";

/**
 * Uses up the one-time token from an email link. POST only: school and work mail
 * filters (Microsoft Safe Links, Barracuda, Mimecast...) and some antivirus tools
 * open every link in an email before the person does. A GET that verified the
 * token let those scanners spend it, so the real click landed on "link expired".
 * The /auth/confirm page shows a Continue button that posts here instead.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const token_hash = form?.get("token_hash");
  const type = parseEmailLinkType(form?.get("type"));
  const next = safeNextPath(form?.get("next"));

  if (typeof token_hash === "string" && token_hash && type) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      if (type === "email_change") {
        await syncConfirmedEmail(supabase);
      }
      return redirect(next);
    } else {
      console.error("Auth Error", error);
      await logError(error, { type, code: error.code }, "auth_confirm_error");
    }
  }

  // return the user to an error page with some instructions
  return redirect("/auth/auth-code-error");
}

// 303 so the browser follows the POST with a GET. The Location is relative on purpose:
// CSP form-action 'self' also covers the redirect after a form post, and the host the
// server sees (nextUrl) can differ from the one in the address bar (localhost vs
// 127.0.0.1 in dev, www vs apex or a proxy in prod), which the browser then blocks.
function redirect(path: string) {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
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
