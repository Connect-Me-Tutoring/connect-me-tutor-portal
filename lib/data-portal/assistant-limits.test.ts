import { describe, expect, it, vi, beforeEach } from "vitest";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const { claimAssistantQuestion, fitHistory } = await import("./assistant-limits");

const createClientMock = createClient as ReturnType<typeof vi.fn>;

function stubRpc(result: { data?: unknown; error?: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  createClientMock.mockResolvedValue({ rpc });
  return rpc;
}

const user = (content: string) => ({ role: "user" as const, content });
const assistant = (content: string) => ({ role: "assistant" as const, content });

describe("fitHistory", () => {
  it("keeps everything that fits", () => {
    const messages = [user("a"), assistant("b"), user("c")];
    expect(fitHistory(messages, 100)).toEqual(messages);
  });

  it("drops the oldest messages first", () => {
    const messages = [
      user("x".repeat(50)),
      assistant("y".repeat(50)),
      user("q"),
      assistant("r"),
      user("s"),
    ];
    expect(fitHistory(messages, 60)).toEqual([user("q"), assistant("r"), user("s")]);
  });

  it("always keeps the question, even when it alone is over budget", () => {
    expect(fitHistory([assistant("a"), user("z".repeat(200))], 10)).toEqual([
      user("z".repeat(200)),
    ]);
  });

  it("never starts with an answer", () => {
    const messages = [user("x".repeat(50)), assistant("r"), user("s")];
    expect(fitHistory(messages, 10)).toEqual([user("s")]);
  });
});

describe("claimAssistantQuestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asks the database, with the caller's own session", async () => {
    const rpc = stubRpc({ data: { allowed: true, limit: null, retryAfterSeconds: 0 } });

    await expect(claimAssistantQuestion()).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("data_portal_assistant_claim");
  });

  it("reports which limit was hit and when it frees up", async () => {
    stubRpc({ data: { allowed: false, limit: "admin_daily", retryAfterSeconds: 120 } });

    await expect(claimAssistantQuestion()).resolves.toEqual({
      ok: false,
      reason: "limited",
      limit: "admin_daily",
      retryAfterSeconds: 120,
    });
  });

  it("treats the database's admin gate as a denial", async () => {
    stubRpc({ error: { message: "Admin access required" } });

    await expect(claimAssistantQuestion()).resolves.toEqual({ ok: false, reason: "denied" });
  });

  it("fails closed when the function is missing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubRpc({
      error: { message: "Could not find the function public.data_portal_assistant_claim" },
    });

    await expect(claimAssistantQuestion()).resolves.toEqual({ ok: false, reason: "unavailable" });
  });

  it("fails closed on a payload it does not recognise", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubRpc({ data: { allowed: "yes" } });

    await expect(claimAssistantQuestion()).resolves.toEqual({ ok: false, reason: "unavailable" });
  });
});
