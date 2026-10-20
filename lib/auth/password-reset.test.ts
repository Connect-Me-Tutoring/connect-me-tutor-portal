import { AuthApiError, createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/database.types";
import {
  passwordResetError,
  resetCodeSchema,
  resetEmailSchema,
  sendPasswordResetCode,
  verifyPasswordResetCode,
  withAuthTimeout,
} from "./password-reset";

function authClient(body: unknown, status = 200) {
  const fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", "X-Supabase-Api-Version": "2024-01-01" },
    }),
  );
  const client = createClient<Database>("http://127.0.0.1:54321", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch },
  });
  return { client, fetch };
}

function requestBody(fetch: ReturnType<typeof vi.fn>) {
  return JSON.parse(fetch.mock.calls[0][1].body);
}

afterEach(() => vi.useRealTimers());

describe("password reset codes", () => {
  it("accepts email whitespace and pasted code whitespace without losing leading zeros", () => {
    expect(resetEmailSchema.parse({ email: " tutor@example.com " }).email).toBe(
      "tutor@example.com",
    );
    expect(resetCodeSchema.parse({ token: " 012 345\n" }).token).toBe("012345");
    for (const token of ["12345", "1234567", "abcdef", "12-345"]) {
      expect(resetCodeSchema.safeParse({ token }).success).toBe(false);
    }
  });

  it("sends an OTP without creating an account", async () => {
    const { client, fetch } = authClient({});
    await sendPasswordResetCode(client, "tutor@example.com");
    expect(fetch.mock.calls[0][0]).toBe("http://127.0.0.1:54321/auth/v1/otp");
    expect(requestBody(fetch)).toMatchObject({ email: "tutor@example.com", create_user: false });
  });

  it.each(["otp_disabled", "signup_disabled"])("keeps %s responses private", async (code) => {
    const { client } = authClient({ code, msg: "Account not found" }, 400);
    await expect(sendPasswordResetCode(client, "unknown@example.com")).resolves.toBeUndefined();
  });

  it("reports send failures instead of showing the verification form", async () => {
    const { client } = authClient({ code: "over_email_send_rate_limit", msg: "Rate limited" }, 429);
    await expect(sendPasswordResetCode(client, "tutor@example.com")).rejects.toMatchObject({
      status: 429,
    });
  });

  it("verifies the same email OTP type and persists a successful session", async () => {
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
    const { client, fetch } = authClient({
      access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`,
      refresh_token: "test-refresh",
      token_type: "bearer",
      expires_in: 3600,
      user: { id: "test-user" },
    });
    await verifyPasswordResetCode(client, "tutor@example.com", "012345");
    expect(requestBody(fetch)).toMatchObject({
      email: "tutor@example.com",
      token: "012345",
      type: "email",
    });
    expect((await client.auth.getSession()).data.session?.user.id).toBe("test-user");
  });

  it("rejects an invalid or expired code and gives recovery guidance", async () => {
    const { client } = authClient(
      { code: "otp_expired", msg: "Token has expired or is invalid" },
      403,
    );
    const result = verifyPasswordResetCode(client, "tutor@example.com", "123456");
    await expect(result).rejects.toMatchObject({ code: "otp_expired" });
    expect(passwordResetError(await result.catch((error) => error), "Verification failed")).toMatch(
      /latest email.*request a new code/,
    );
  });

  it("does not proceed without a session, even if verification returns no error", async () => {
    const { client } = authClient({ user: { id: "test-user" } });
    await expect(verifyPasswordResetCode(client, "tutor@example.com", "123456")).rejects.toThrow(
      /Request a new code/,
    );
  });

  it("shows a retry message for rate limits and hides unexpected server details", () => {
    expect(
      passwordResetError(
        new AuthApiError("Too many requests", 429, "over_request_rate_limit"),
        "Failed",
      ),
    ).toMatch(/wait a minute/);
    expect(passwordResetError(new Error("internal details"), "Please try again")).toBe(
      "Please try again",
    );
  });
});

describe("auth loading timeout", () => {
  it("releases a stalled request after 20 seconds", async () => {
    vi.useFakeTimers();
    const request = withAuthTimeout(new Promise<never>(() => {}));
    const assertion = expect(request).rejects.toThrow(/timed out.*try again/);
    await vi.advanceTimersByTimeAsync(20_000);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cleans up its timer on success and failure", async () => {
    vi.useFakeTimers();
    await expect(withAuthTimeout(Promise.resolve("done"))).resolves.toBe("done");
    await expect(withAuthTimeout(Promise.reject(new Error("offline")))).rejects.toThrow("offline");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores late completion after a timeout", async () => {
    vi.useFakeTimers();
    let complete!: (value: string) => void;
    const request = withAuthTimeout(new Promise<string>((resolve) => (complete = resolve)));
    const onSuccess = vi.fn();
    const result = request.then(onSuccess).catch(() => {});
    await vi.advanceTimersByTimeAsync(20_000);
    complete("late session");
    await result;
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
