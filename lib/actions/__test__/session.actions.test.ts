import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
  createAdminClient: vi.fn().mockResolvedValue({ from: mockFrom }),
  createServerClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}));

const requireAdmin = vi.fn().mockResolvedValue({});
vi.mock("../auth/authz.server", () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
  requireAuthenticatedProfile: vi.fn(),
  requireEnrollmentAccess: vi.fn(),
  requireSessionAccess: vi.fn(),
  requireStudentProfileAccess: vi.fn(),
  requireTutorProfileAccess: vi.fn(),
  applySessionScope: vi.fn(),
}));

vi.mock("@/lib/posthog", () => ({
  logError: vi.fn().mockResolvedValue(undefined),
  logEvent: vi.fn().mockResolvedValue(undefined),
}));

const { getCompletedSessionsCount } = await import("../session/server.actions");

const START = "2026-08-02T04:00:00.000Z";
const END = "2026-08-09T03:59:59.999Z";

/** Mirrors the PostgREST builder chain the action walks, capturing the filters it applies. */
const mockCountQuery = (result: { count: number | null; error: unknown }) => {
  const filters: Record<string, unknown[]> = {};
  const builder: Record<string, any> = {};

  for (const method of ["eq", "gte", "lte"]) {
    builder[method] = vi.fn((...args: unknown[]) => {
      filters[method] = args;
      return builder;
    });
  }
  // awaiting the builder resolves the query
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);

  mockSelect.mockReturnValue(builder);
  return filters;
};

describe("getCompletedSessionsCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdmin.mockResolvedValue({});
  });

  it("counts only Complete sessions inside the requested timeframe", async () => {
    const filters = mockCountQuery({ count: 12, error: null });

    const count = await getCompletedSessionsCount(START, END);

    expect(count).toBe(12);
    expect(mockFrom).toHaveBeenCalledWith("Sessions");
    expect(filters.eq).toEqual(["status", "Complete"]);
    expect(filters.gte).toEqual(["date", START]);
    expect(filters.lte).toEqual(["date", END]);
  });

  it("asks the database for a head-only exact count", async () => {
    mockCountQuery({ count: 3, error: null });

    await getCompletedSessionsCount(START, END);

    const [selection, options] = mockSelect.mock.calls[0];
    expect(options).toEqual({ count: "exact", head: true });
    // inner joins keep orphaned sessions out, matching the schedule's own session list
    expect(selection).toContain("student:Profiles!student_id!inner(id)");
    expect(selection).toContain("tutor:Profiles!tutor_id!inner(id)");
  });

  it("returns 0 when the range has no completed sessions", async () => {
    mockCountQuery({ count: null, error: null });

    await expect(getCompletedSessionsCount(START, END)).resolves.toBe(0);
  });

  it("requires an admin before querying", async () => {
    mockCountQuery({ count: 5, error: null });
    requireAdmin.mockRejectedValue(new Error("Admin access required"));

    await expect(getCompletedSessionsCount(START, END)).rejects.toThrow("Admin access required");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("propagates query errors instead of reporting a wrong count", async () => {
    mockCountQuery({ count: null, error: new Error("connection reset") });

    await expect(getCompletedSessionsCount(START, END)).rejects.toThrow("connection reset");
  });
});
