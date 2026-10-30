import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ select: mockSelect, update: mockUpdate, insert: mockInsert }));

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

const { getCompletedSessionsCount, markUnconfirmedSEFCron, addSessionsForCron } =
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

describe("addSessionsForCron", () => {
  // Sun Oct 25 – Sat Oct 31 2026 in America/New_York (EDT, UTC-4).
  const WEEK_START = "2026-10-25T04:00:00.000Z";
  const WEEK_END = "2026-11-01T03:59:59.999Z";

  const enrollment = (overrides: Record<string, unknown>) =>
    ({
      id: "e1",
      student: { id: "student-1" },
      tutor: { id: "tutor-1" },
      day: "Monday",
      startTime: "16:00",
      endTime: "17:00",
      meetingId: "m1",
      summary: "Math",
      startDate: "2026-09-01T04:00:00.000Z",
      duration: 1,
      paused: false,
      ...overrides,
    }) as any;

  const captureInsert = () => {
    const select = vi.fn().mockResolvedValue({ data: [], error: null });
    mockInsert.mockReturnValue({ select });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates the week's sessions when run before the week starts", async () => {
    vi.setSystemTime(new Date("2026-10-25T00:00:00.000Z")); // Sat Oct 24, 8pm ET
    captureInsert();

    await addSessionsForCron(WEEK_START, WEEK_END, [enrollment({})], []);

    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({ enrollment_id: "e1", date: "2026-10-26T20:00:00.000Z" }),
    ]);
  });

  it("does not backfill slots that have already passed", async () => {
    vi.setSystemTime(new Date("2026-10-28T12:00:00.000Z")); // Wed Oct 28
    captureInsert();

    await addSessionsForCron(
      WEEK_START,
      WEEK_END,
      [
        enrollment({ id: "past", day: "Monday" }),
        enrollment({ id: "future", day: "Saturday", startTime: "10:00", endTime: "11:00" }),
      ],
      [],
    );

    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert.mock.calls[0][0]).toEqual([
      expect.objectContaining({ enrollment_id: "future", date: "2026-10-31T14:00:00.000Z" }),
    ]);
  });

  it("skips the off week of a biweekly enrollment", async () => {
    vi.setSystemTime(new Date("2026-10-25T00:00:00.000Z"));
    captureInsert();

    // Mon Oct 26 is 8 weeks after Mon Sep 28 (on week) and 7 weeks after Mon Oct 5 (off week).
    await addSessionsForCron(
      WEEK_START,
      WEEK_END,
      [
        enrollment({ id: "on", frequency: "biweekly", startDate: "2026-09-28T04:00:00.000Z" }),
        enrollment({
          id: "off",
          student: { id: "student-2" },
          frequency: "biweekly",
          startDate: "2026-10-05T04:00:00.000Z",
        }),
      ],
      [],
    );

    expect(mockInsert.mock.calls[0][0]).toEqual([
      expect.objectContaining({ enrollment_id: "on", date: "2026-10-26T20:00:00.000Z" }),
    ]);
  });

  it("inserts nothing when every slot in the week has passed", async () => {
    vi.setSystemTime(new Date("2026-11-01T00:00:00.000Z")); // Sat Oct 31, 8pm ET

    const result = await addSessionsForCron(WEEK_START, WEEK_END, [enrollment({})], []);

    expect(mockInsert).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
