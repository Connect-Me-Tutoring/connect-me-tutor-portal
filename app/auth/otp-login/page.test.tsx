// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import OTPForm from "./page";

const { signInWithOtp, verifyOtp, capture } = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  capture: vi.fn(),
  verifyOtp: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
}));

vi.mock("posthog-js", () => ({ default: { capture } }));

vi.mock("react-hot-toast", () => ({
  default: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
  Toaster: () => null,
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithOtp, verifyOtp } }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  verifyOtp.mockResolvedValue({ data: { session: null }, error: null });
});

it("lets someone verify an existing code without sending a replacement", async () => {
  render(<OTPForm />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "login@example.org" } });
  fireEvent.click(screen.getByRole("button", { name: "I already have a code" }));

  fireEvent.change(await screen.findByLabelText("One-Time Password"), {
    target: { value: "123456" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Verify OTP & Login" }));

  await waitFor(() =>
    expect(verifyOtp).toHaveBeenCalledWith({
      email: "login@example.org",
      token: "123456",
      type: "email",
    }),
  );
  expect(signInWithOtp).not.toHaveBeenCalled();
});

it("tracks an expired-code error without including credentials or URL query parameters", async () => {
  window.history.replaceState(
    {},
    "",
    "/auth/otp-login?email=login@example.org&token_hash=private-hash",
  );
  verifyOtp.mockResolvedValue({
    data: { session: null },
    error: { code: "otp_expired", status: 403, message: "Token has expired or is invalid" },
  });
  render(<OTPForm />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "login@example.org" } });
  fireEvent.click(screen.getByRole("button", { name: "I already have a code" }));
  fireEvent.change(await screen.findByLabelText("One-Time Password"), {
    target: { value: "123456" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Verify OTP & Login" }));

  await waitFor(() =>
    expect(capture).toHaveBeenCalledWith(
      "auth_otp_verify_completed",
      expect.objectContaining({
        source: "login",
        outcome: "failed",
        email_domain: "example.org",
        error_code: "otp_expired",
        error_status: 403,
        $current_url: window.location.origin + "/auth/otp-login",
      }),
      expect.objectContaining({ send_instantly: true }),
    ),
  );
  const events = JSON.stringify(capture.mock.calls);
  expect(events).not.toContain("123456");
  expect(events).not.toContain("login@example.org");
  expect(events).not.toContain("private-hash");
});
