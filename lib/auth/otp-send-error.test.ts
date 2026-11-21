import { describe, it, expect } from "vitest";
import { classifyOtpSendError, otpSendErrorMessage } from "./otp-send-error";

describe("classifyOtpSendError", () => {
  it("treats no error and unknown emails as sent", () => {
    expect(classifyOtpSendError(null)).toEqual({ kind: "sent" });
    expect(classifyOtpSendError({ code: "otp_disabled" })).toEqual({ kind: "sent" });
    expect(classifyOtpSendError({ code: "signup_disabled" })).toEqual({ kind: "sent" });
  });

  it("reads the wait from the per-user interval limit", () => {
    const outcome = classifyOtpSendError({
      code: "over_email_send_rate_limit",
      status: 429,
      message: "For security purposes, you can only request this after 42 seconds.",
    });
    expect(outcome).toEqual({ kind: "recently_sent", waitSeconds: 42 });
    expect(otpSendErrorMessage(outcome)).toContain("wait 42 seconds");
  });

  it("treats project and network limits as rate limited", () => {
    expect(
      classifyOtpSendError({
        code: "over_email_send_rate_limit",
        status: 429,
        message: "Email rate limit exceeded",
      }),
    ).toEqual({ kind: "rate_limited" });
    expect(classifyOtpSendError({ code: "over_request_rate_limit", status: 429 })).toEqual({
      kind: "rate_limited",
    });
  });

  it("falls back to failed", () => {
    expect(classifyOtpSendError({ code: "unexpected_failure", status: 500 })).toEqual({
      kind: "failed",
    });
  });
});
