import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { requireAdmin } from "@/lib/actions/auth/authz.server";
import { getDataPortalOverview } from "@/lib/actions/data-portal/server.actions";
import { streamAnswer } from "@/lib/data-portal/analyst-agent";
import { claimAssistantQuestion } from "@/lib/data-portal/assistant-limits";
import { __resetRateLimits } from "@/lib/security/rate-limit";

vi.mock("@/lib/actions/auth/authz.server", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/actions/data-portal/server.actions", () => ({
  getDataPortalOverview: vi.fn(),
}));

vi.mock("@/lib/data-portal/analyst-agent", () => ({
  streamAnswer: vi.fn(),
  renderFigures: () => "<figures></figures>",
}));

vi.mock("@/lib/data-portal/assistant-limits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data-portal/assistant-limits")>()),
  claimAssistantQuestion: vi.fn(),
}));

vi.mock("@/lib/posthog", () => ({
  logError: vi.fn(),
}));

const { POST } = await import("./route");

const requireAdminMock = requireAdmin as ReturnType<typeof vi.fn>;
const claimMock = claimAssistantQuestion as ReturnType<typeof vi.fn>;
const overviewMock = getDataPortalOverview as ReturnType<typeof vi.fn>;
const streamMock = streamAnswer as ReturnType<typeof vi.fn>;

function request(body: unknown) {
  return new Request("http://localhost/api/admin/data-portal/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const QUESTION = {
  messages: [{ role: "user", content: "Which subjects look worst staffed?" }],
  dateRange: "last-90-days",
};

describe("POST /api/admin/data-portal/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetRateLimits();
    vi.stubEnv("DATA_PORTAL_ANTHROPIC_API_KEY", "test-key");
    requireAdminMock.mockResolvedValue({ user: { id: "admin-1" } });
    claimMock.mockResolvedValue({ ok: true });
    overviewMock.mockResolvedValue({ ok: true, generatedAt: "2026-10-15T00:00:00Z", sections: [] });
    streamMock.mockImplementation(
      () =>
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("An answer."));
            controller.close();
          },
        }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("turns away a tutor before anything is counted or the model is called", async () => {
    requireAdminMock.mockRejectedValue(new Error("Admin access required"));

    const response = await POST(request(QUESTION));

    expect(response.status).toBe(401);
    expect(claimMock).not.toHaveBeenCalled();
    expect(streamMock).not.toHaveBeenCalled();
  });

  it("refuses without calling the model once a database limit is reached", async () => {
    claimMock.mockResolvedValue({
      ok: false,
      reason: "limited",
      limit: "global_daily",
      retryAfterSeconds: 3600,
    });

    const response = await POST(request(QUESTION));
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("3600");
    expect(json.error).toMatch(/daily limit across all admins/);
    expect(streamMock).not.toHaveBeenCalled();
  });

  it("fails closed when the count cannot be taken", async () => {
    claimMock.mockResolvedValue({ ok: false, reason: "unavailable" });

    const response = await POST(request(QUESTION));

    expect(response.status).toBe(503);
    expect(streamMock).not.toHaveBeenCalled();
  });

  it("refuses when the database does not see an admin, even past requireAdmin", async () => {
    claimMock.mockResolvedValue({ ok: false, reason: "denied" });

    const response = await POST(request(QUESTION));

    expect(response.status).toBe(401);
    expect(streamMock).not.toHaveBeenCalled();
  });

  it("does not count a question when no key is configured", async () => {
    vi.stubEnv("DATA_PORTAL_ANTHROPIC_API_KEY", "");

    const response = await POST(request(QUESTION));

    expect(response.status).toBe(503);
    expect(claimMock).not.toHaveBeenCalled();
  });

  it("does not count a malformed request", async () => {
    const response = await POST(
      request({ ...QUESTION, messages: [{ role: "user", content: "x".repeat(4001) }] }),
    );

    expect(response.status).toBe(400);
    expect(claimMock).not.toHaveBeenCalled();
  });

  it("sends only the newest history that fits the budget", async () => {
    const long = "y".repeat(9000);
    const response = await POST(
      request({
        dateRange: "last-90-days",
        messages: [
          { role: "user", content: "first question" },
          { role: "assistant", content: long },
          { role: "user", content: `second question ${"z".repeat(7000)}` },
          { role: "assistant", content: long },
          { role: "user", content: "third question" },
        ],
      }),
    );

    expect(response.status).toBe(200);
    const { messages, signal } = streamMock.mock.calls[0][0] as {
      messages: { role: string; content: string }[];
      signal: AbortSignal;
    };
    // The last answer fits but the question it answered does not, and an
    // answer is never sent without its question, so only the newest goes.
    expect(messages).toEqual([{ role: "user", content: "third question" }]);
    // Tied to the request, so a closed tab stops the model.
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it("answers an admin within the limits", async () => {
    const response = await POST(request(QUESTION));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("An answer.");
    expect(claimMock).toHaveBeenCalledTimes(1);
  });
});
