import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendSignInCode } from "./send-sign-in-code";

const { requireAdmin, createAdminClient, findProfile, getUserById, signInWithOtp, logEvent } =
  vi.hoisted(() => ({
    requireAdmin: vi.fn(),
    logEvent: vi.fn(),
    createAdminClient: vi.fn(),
    findProfile: vi.fn(),
    getUserById: vi.fn(),
    signInWithOtp: vi.fn(),
  }));

vi.mock("@/lib/actions/auth/authz.server", () => ({ requireAdmin }));
vi.mock("@/lib/posthog", () => ({ logEvent }));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient }));

describe("sendSignInCode", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdmin.mockResolvedValue({ user: { id: "admin-id" } });
    logEvent.mockResolvedValue(undefined);
    createAdminClient.mockResolvedValue({
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: findProfile }) }),
      }),
      auth: { admin: { getUserById }, signInWithOtp },
    });
    findProfile.mockResolvedValue({ data: { user_id: "auth-id" }, error: null });
    getUserById.mockResolvedValue({
      data: { user: { email: "login@example.org", email_confirmed_at: "2026-01-01" } },
      error: null,
    });
    signInWithOtp.mockResolvedValue({ error: null });
  });

  it("emails a code to the linked login even after it has been confirmed", async () => {
    expect(await sendSignInCode("profile-id")).toEqual({ ok: true, email: "login@example.org" });
    expect(getUserById).toHaveBeenCalledWith("auth-id");
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "login@example.org",
      options: { shouldCreateUser: false },
    });
  });

  it("records an admin request and its outcome against the admin's identity", async () => {
    await sendSignInCode("profile-id");
    expect(logEvent).toHaveBeenCalledWith(
      "auth_otp_send_requested",
      { source: "admin", profile_id: "profile-id" },
      "admin-id",
    );
    expect(logEvent).toHaveBeenCalledWith(
      "auth_otp_send_completed",
      {
        source: "admin",
        profile_id: "profile-id",
        outcome: "accepted",
        failure_reason: undefined,
      },
      "admin-id",
    );
    expect(JSON.stringify(logEvent.mock.calls)).not.toContain("login@example.org");
  });

  it("still sends the code when analytics is unavailable", async () => {
    logEvent.mockRejectedValue(new Error("Analytics unavailable"));
    expect(await sendSignInCode("profile-id")).toEqual({ ok: true, email: "login@example.org" });
  });

  it("requires admin access before using the service client", async () => {
    requireAdmin.mockRejectedValue(new Error("Admin access required"));
    await expect(sendSignInCode("profile-id")).rejects.toThrow("Admin access required");
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("reports a missing linked login without attempting to send", async () => {
    getUserById.mockResolvedValue({ data: { user: null }, error: { code: "user_not_found" } });
    expect(await sendSignInCode("profile-id")).toEqual({
      ok: false,
      error: "This profile has no linked login with an email address.",
    });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("reports throttling instead of telling the admin a code was sent", async () => {
    signInWithOtp.mockResolvedValue({ error: { code: "over_email_send_rate_limit" } });
    expect(await sendSignInCode("profile-id")).toEqual({
      ok: false,
      error: expect.stringContaining("rate limit"),
    });
  });
});
