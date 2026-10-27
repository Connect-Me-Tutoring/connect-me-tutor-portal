import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSessionSingle = vi.fn();
const mockTicketSingle = vi.fn();
const mockInsert = vi.fn(() => ({ select: () => ({ single: mockTicketSingle }) }));
const sessionsClient = {
  from: vi.fn(() => ({
    select: () => ({ eq: () => ({ single: mockSessionSingle }) }),
  })),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from: () => ({ insert: mockInsert }) }),
}));

const requireSessionAccessById = vi.fn();
vi.mock("../auth/authz.server", () => ({
  requireAdmin: vi.fn(),
  requireAuthenticatedProfile: vi.fn().mockResolvedValue({
    user: { id: "user-1", email: "tutor@example.com" },
    profile: { id: "profile-1", email: "tutor@example.com", firstName: "T", lastName: "R" },
  }),
  requireSessionAccessById: (...args: unknown[]) => requireSessionAccessById(...args),
}));

vi.mock("@/lib/email/mailer", () => ({
  sendMail: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("@/lib/posthog", () => ({
  logError: vi.fn().mockResolvedValue(undefined),
  logEvent: vi.fn().mockResolvedValue(undefined),
}));

const { requestSessionExitFormReopen } = await import("../ticket/server.actions");

const REASON = "The session happened but I missed the form deadline.";

describe("requestSessionExitFormReopen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionAccessById.mockResolvedValue(sessionsClient);
    mockTicketSingle.mockResolvedValue({ data: { id: "ticket-1" }, error: null });
  });

  it("files a sessions ticket naming the Unconfirmed session", async () => {
    mockSessionSingle.mockResolvedValue({
      data: {
        id: "session-1",
        date: "2026-10-20T20:00:00.000Z",
        status: "Unconfirmed",
        student: { first_name: "Sam", last_name: "Student" },
      },
      error: null,
    });

    const result = await requestSessionExitFormReopen("session-1", REASON, "/dashboard");

    expect(result).toEqual({ ok: true, ticketId: "ticket-1" });
    expect(requireSessionAccessById).toHaveBeenCalledWith("session-1");
    const [ticket] = mockInsert.mock.calls[0] as unknown[] as [Record<string, unknown>];
    expect(ticket.category).toBe("sessions");
    expect(ticket.subject).toContain("Reopen Session Exit Form: Sam Student");
    expect(ticket.description).toContain("Session ID: session-1");
    expect(ticket.description).toContain(REASON);
    expect(ticket.page_url).toBe("/dashboard");
  });

  it("refuses sessions that are not Unconfirmed", async () => {
    mockSessionSingle.mockResolvedValue({
      data: { id: "session-1", date: "2026-10-20T20:00:00.000Z", status: "Complete" },
      error: null,
    });

    const result = await requestSessionExitFormReopen("session-1", REASON);

    expect(result.ok).toBe(false);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("requires a reason before checking the session", async () => {
    const result = await requestSessionExitFormReopen("session-1", "  short ");

    expect(result.ok).toBe(false);
    expect(requireSessionAccessById).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
