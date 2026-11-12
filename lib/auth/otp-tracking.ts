import posthog from "posthog-js";

type OtpEvent =
  | "auth_otp_send_requested"
  | "auth_otp_send_completed"
  | "auth_otp_verify_requested"
  | "auth_otp_verify_completed";

export function trackOtpEvent(
  event: OtpEvent,
  {
    source,
    email,
    outcome,
    error,
  }: {
    source: "login" | "password_reset";
    email: string;
    outcome?: "accepted" | "verified" | "failed";
    error?: unknown;
  },
) {
  const authError = error as { code?: unknown; status?: unknown } | null;
  try {
    posthog.capture(
      event,
      {
        source,
        email_domain: email.split("@")[1]?.toLowerCase(),
        outcome,
        error_code: typeof authError?.code === "string" ? authError.code : undefined,
        error_status: typeof authError?.status === "number" ? authError.status : undefined,
        // Auth URLs can contain email addresses or tokens. Keep only the page path.
        $current_url: window.location.origin + window.location.pathname,
        $referrer: document.referrer.split(/[?#]/)[0],
      },
      { transport: "sendBeacon", send_instantly: true },
    );
  } catch (captureError) {
    console.error("Unable to track OTP event", captureError);
  }
}
