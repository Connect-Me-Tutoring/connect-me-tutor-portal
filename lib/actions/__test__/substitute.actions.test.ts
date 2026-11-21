import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}));

const requireSessionAccessById = vi.fn().mockImplementation(async () => ({ from: mockFrom }));
vi.mock("../auth/authz.server", () => ({
  requireAuthenticatedProfile: vi.fn(),
  requireSessionAccessById: (...args: unknown[]) => requireSessionAccessById(...args),
  requireTutorProfileAccess: vi.fn(),
}));

vi.mock("@/lib/posthog", () => ({
  logError: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/email/session-reminders", () => ({
  removeSessionReminders: vi.fn(),
}));

const { requestSubstitute, undoSubstituteRequest } = await import("../tutor/actions");

const SESSION_ROW = {
  id: "session-1",
  date: "2026-11-10T22:00:00.000Z",
  status: "Sub-Request",
  duration: 1,
  tutor: { id: "tutor-1", first_name: "Tia", last_name: "Tutor" },
  student: { id: "student-1", first_name: "Sam", last_name: "Student" },
  meeting: null,
};

/** Mirrors the update().eq().eq().select().maybeSingle() chain, capturing what it was given. */
const mockUpdateChain = (result: { data: unknown; error: unknown }) => {
  const calls = { update: [] as unknown[], eq: [] as unknown[][] };
  const builder: Record<string, any> = {
    eq: vi.fn((...args: unknown[]) => {
      calls.eq.push(args);
      return builder;
    }),
    select: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  mockFrom.mockReturnValue({
    update: vi.fn((values: unknown) => {
      calls.update.push(values);
      return builder;
    }),
  });
  return calls;
};

describe("requestSubstitute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionAccessById.mockImplementation(async () => ({ from: mockFrom }));
  });

  it("marks only an Active session Sub-Request and returns the saved session", async () => {
    const calls = mockUpdateChain({ data: SESSION_ROW, error: null });

    const result = await requestSubstitute("session-1");

    expect(requireSessionAccessById).toHaveBeenCalledWith("session-1");
    expect(mockFrom).toHaveBeenCalledWith("Sessions");
    expect(calls.update).toEqual([{ status: "Sub-Request" }]);
    expect(calls.eq).toEqual([
      ["id", "session-1"],
      ["status", "Active"],
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.id).toBe("session-1");
      expect(result.session.status).toBe("Sub-Request");
    }
  });

  it("reports not_allowed when the session isn't Active anymore", async () => {
    mockUpdateChain({ data: null, error: null });

    await expect(requestSubstitute("session-1")).resolves.toEqual({
      ok: false,
      reason: "not_allowed",
    });
  });

  it("reports an error instead of throwing when the write fails", async () => {
    mockUpdateChain({ data: null, error: new Error("db down") });

    await expect(requestSubstitute("session-1")).resolves.toEqual({ ok: false, reason: "error" });
  });

  it("reports an error when the caller can't access the session", async () => {
    requireSessionAccessById.mockRejectedValueOnce(new Error("Forbidden"));

    await expect(requestSubstitute("session-1")).resolves.toEqual({ ok: false, reason: "error" });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("rejects an empty session id without querying", async () => {
    await expect(requestSubstitute("")).resolves.toEqual({ ok: false, reason: "not_allowed" });
    expect(requireSessionAccessById).not.toHaveBeenCalled();
  });
});

describe("undoSubstituteRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionAccessById.mockImplementation(async () => ({ from: mockFrom }));
  });

  it("puts only a Sub-Request session back to Active", async () => {
    const calls = mockUpdateChain({ data: { ...SESSION_ROW, status: "Active" }, error: null });

    const result = await undoSubstituteRequest("session-1");

    expect(calls.update).toEqual([{ status: "Active" }]);
    expect(calls.eq).toEqual([
      ["id", "session-1"],
      ["status", "Sub-Request"],
    ]);
    expect(result.ok && result.session.status).toBe("Active");
  });

  it("reports not_allowed when the session is no longer Sub-Request", async () => {
    mockUpdateChain({ data: null, error: null });

    await expect(undoSubstituteRequest("session-1")).resolves.toEqual({
      ok: false,
      reason: "not_allowed",
    });
  });
});
