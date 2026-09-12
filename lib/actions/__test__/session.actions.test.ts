import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn(() => ({ select: mockSelect, update: mockUpdate }));

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

const { getCompletedSessionsCount, markUnconfirmedSEFCron } =
  await import("../session/server.actions");

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

/** Records every filter the action chains onto a builder, in order. */
const mockChain = (result: unknown) => {
  const calls: Array<[string, unknown[]]> = [];
  const builder: Record<string, any> = {};

  for (const method of ["eq", "lt", "gte", "lte", "in"]) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls.push([method, args]);
      return builder;
    });
  }
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);

  return { builder, calls };
};

describe("markUnconfirmedSEFCron", () => {
  const NOW = new Date("2026-08-20T12:00:00.000Z");
  const FORTY_EIGHT_HOURS_AGO = "2026-08-18T12:00:00.000Z";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks stale sessions Unconfirmed instead of cancelling them", async () => {
    const fetch = mockChain({ data: [{ id: "s1" }, { id: "s2" }], error: null });
    const update = mockChain({ error: null });
    mockSelect.mockReturnValue(fetch.builder);
    mockUpdate.mockReturnValue(update.builder);

    const result = await markUnconfirmedSEFCron();

    expect(mockUpdate).toHaveBeenCalledWith({ status: "Unconfirmed" });
    expect(result).toEqual({ success: true, error: undefined, unconfirmed: 2 });
  });

  it("only touches non-standalone Active sessions past the 48-hour cutoff", async () => {
    const fetch = mockChain({ data: [{ id: "s1" }], error: null });
    const update = mockChain({ error: null });
    mockSelect.mockReturnValue(fetch.builder);
    mockUpdate.mockReturnValue(update.builder);

    await markUnconfirmedSEFCron();

    expect(update.calls).toEqual([
      ["eq", ["status", "Active"]],
      ["eq", ["is_standalone", false]],
      ["lt", ["date", FORTY_EIGHT_HOURS_AGO]],
    ]);
    expect(fetch.calls).toEqual([
      ["eq", ["status", "Active"]],
      ["lt", ["date", FORTY_EIGHT_HOURS_AGO]],
    ]);
  });

  it("skips the update entirely when nothing is stale", async () => {
    mockSelect.mockReturnValue(mockChain({ data: [], error: null }).builder);

    const result = await markUnconfirmedSEFCron();

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, error: undefined, unconfirmed: 0 });
  });

  it("reports failure without updating when the fetch fails", async () => {
    mockSelect.mockReturnValue(
      mockChain({ data: null, error: { message: "connection reset" } }).builder,
    );

    const result = await markUnconfirmedSEFCron();

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, error: "connection reset", unconfirmed: 0 });
  });

  it("reports failure when the update fails", async () => {
    mockSelect.mockReturnValue(mockChain({ data: [{ id: "s1" }], error: null }).builder);
    mockUpdate.mockReturnValue(mockChain({ error: { message: "deadlock detected" } }).builder);

    const result = await markUnconfirmedSEFCron();

    expect(result).toEqual({ success: false, error: "deadlock detected", unconfirmed: 0 });
  });
});
