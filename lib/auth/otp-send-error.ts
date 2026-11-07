interface OtpSendError {
  code?: string;
  message?: string;
  status?: number;
}

export type OtpSendOutcome =
  /** Sent, or hidden as sent so the page doesn't reveal which emails have accounts. */
  | { kind: "sent" }
  /** A code went to this email moments ago and still works; Supabase won't send another yet. */
  | { kind: "recently_sent"; waitSeconds: number | null }
  /** Project-wide or per-network limit (e.g. a whole school sharing one IP). */
  | { kind: "rate_limited" }
  | { kind: "failed" };

/** Sorts the error from signInWithOtp({ shouldCreateUser: false }). */
export function classifyOtpSendError(error: OtpSendError | null | undefined): OtpSendOutcome {
  if (!error) return { kind: "sent" };
  // An unknown email is rejected (otp_disabled, or signup_disabled when signups are off
  // project-wide).
  if (error.code === "otp_disabled" || error.code === "signup_disabled") return { kind: "sent" };

  // Per-user minimum interval: "For security purposes, you can only request this after 42 seconds."
  const wait = error.message?.match(/after (\d+) seconds?/i);
  if (wait) return { kind: "recently_sent", waitSeconds: Number(wait[1]) };

  if (
    error.code === "over_email_send_rate_limit" ||
    error.code === "over_request_rate_limit" ||
    error.status === 429
  ) {
    return { kind: "rate_limited" };
  }
  return { kind: "failed" };
}

export function otpSendErrorMessage(outcome: OtpSendOutcome): string | null {
  switch (outcome.kind) {
    case "sent":
      return null;
    case "recently_sent":
      return outcome.waitSeconds
        ? `We just sent a code to this email. Enter that code, or wait ${outcome.waitSeconds} seconds to get a new one.`
        : "We just sent a code to this email. Enter that code, or wait a minute to get a new one.";
    case "rate_limited":
      return "Too many code requests right now. Please wait a few minutes and try again.";
    case "failed":
      return "We couldn't send a code right now. Please try again in a minute.";
  }
}
