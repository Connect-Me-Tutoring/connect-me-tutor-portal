import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { createServerClient, createAdminClient, logError } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  createAdminClient: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/posthog", () => ({ logError }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient, createAdminClient }));

const routeModule = await import("./route");
const { POST } = routeModule;

const ORIGIN = "https://portal.example.com";

function post(fields: Record<string, string>) {
  return new NextRequest(`${ORIGIN}/auth/confirm/verify`, {
    method: "POST",
    body: new URLSearchParams(fields),
  });
}

let verifyOtp: ReturnType<typeof vi.fn>;
let getUser: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  verifyOtp = vi.fn().mockResolvedValue({ error: null });
  getUser = vi.fn().mockResolvedValue({ data: { user: null } });
  createServerClient.mockResolvedValue({ auth: { verifyOtp, getUser } });
});

describe("/auth/confirm/verify", () => {
  it("has no GET handler, so link scanners can't spend the token", () => {
    expect(routeModule).not.toHaveProperty("GET");
    expect(routeModule).not.toHaveProperty("HEAD");
  });

  it("verifies the token and sends an invited user on to set a password", async () => {
    const res = await POST(post({ token_hash: "hash-1", type: "invite", next: "/set-password" }));

    expect(verifyOtp).toHaveBeenCalledWith({ type: "invite", token_hash: "hash-1" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/set-password");
  });

  it("keeps the query string on next", async () => {
    const res = await POST(
      post({ token_hash: "hash-1", type: "magiclink", next: "/dashboard?tab=schedule" }),
    );
    expect(res.headers.get("location")).toBe("/dashboard?tab=schedule");
  });

  it.each(["//evil.example.com", "https://evil.example.com", "/\\evil.example.com", "dashboard"])(
    "won't redirect off-site for next=%s",
    async (next) => {
      const res = await POST(post({ token_hash: "hash-1", type: "invite", next }));
      expect(res.headers.get("location")).toBe("/");
    },
  );

  it("sends an expired or already-used token to the error page", async () => {
    verifyOtp.mockResolvedValue({
      error: { message: "Email link is invalid or has expired", code: "otp_expired" },
    });

    const res = await POST(post({ token_hash: "used", type: "invite", next: "/set-password" }));

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/auth/auth-code-error");
    expect(logError).toHaveBeenCalledWith(
      expect.anything(),
      { type: "invite", code: "otp_expired" },
      "auth_confirm_error",
    );
  });

  it.each<{ name: string; fields: Record<string, string> }>([
    { name: "missing token", fields: { type: "invite" } },
    { name: "missing type", fields: { token_hash: "hash-1" } },
    { name: "unknown type", fields: { token_hash: "hash-1", type: "admin" } },
  ])("rejects a $name without calling Supabase", async ({ fields }) => {
    const res = await POST(post(fields));

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("/auth/auth-code-error");
  });

  it("copies a confirmed email change onto the profiles", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "new@example.com" } } });
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    createAdminClient.mockResolvedValue({ from: vi.fn(() => ({ update })) });

    const res = await POST(
      post({ token_hash: "hash-1", type: "email_change", next: "/dashboard/settings" }),
    );

    expect(update).toHaveBeenCalledWith({ email: "new@example.com" });
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(res.headers.get("location")).toBe("/dashboard/settings");
  });
});
