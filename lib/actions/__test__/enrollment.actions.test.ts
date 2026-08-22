import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
  createAdminClient: vi.fn().mockResolvedValue({ from: mockFrom }),
  createServerClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}));

vi.mock("../auth/authz.server", () => ({
  requireAdmin: vi.fn().mockResolvedValue({}),
  requireAuthenticatedProfile: vi.fn(),
  requireEnrollmentAccess: vi.fn(),
  requireTutorProfileAccess: vi.fn(),
}));

vi.mock("@/lib/posthog", () => ({
  logError: vi.fn().mockResolvedValue(undefined),
  logEvent: vi.fn().mockResolvedValue(undefined),
}));

const { getEnrollmentsWithMissingSEF } = await import("../enrollment/server.actions");

/** Mirrors the PostgREST builder chain the query walks, capturing the filters it applies. */
const mockQuery = (enrollments: unknown[]) => {
  const filters: Record<string, unknown[]> = {};
  const builder: Record<string, any> = {};

  for (const method of ["in", "gte", "lte"]) {
    builder[method] = vi.fn((...args: unknown[]) => {
      filters[method] = args;
      return builder;
    });
  }
  builder.throwOnError = vi.fn(() => builder);
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: enrollments, error: null }).then(resolve);

  mockSelect.mockReturnValue(builder);
  return filters;
};

describe("getEnrollmentsWithMissingSEF", () => {
  const DEADLINE = new Date("2026-07-09T12:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts only Unconfirmed sessions, so deliberate cancellations never trigger deletion", async () => {
    const filters = mockQuery([]);

    await getEnrollmentsWithMissingSEF(DEADLINE, 6);

    expect(mockFrom).toHaveBeenCalledWith("Enrollments");
    expect(filters.in).toEqual(["sessions.status", ["Unconfirmed"]]);
  });

  it("only looks at sessions between the deadline and now", async () => {
    const filters = mockQuery([]);

    await getEnrollmentsWithMissingSEF(DEADLINE, 6);

    expect(filters.gte).toEqual(["sessions.date", DEADLINE.toISOString()]);
    expect(filters.lte?.[0]).toBe("sessions.date");
  });

  it("keeps only enrollments at or past the missing-session threshold", async () => {
    mockQuery([
      { id: "under", sessions: [{ id: "a" }, { id: "b" }] },
      { id: "at", sessions: [{ id: "a" }, { id: "b" }, { id: "c" }] },
      { id: "over", sessions: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }] },
    ]);

    const result = await getEnrollmentsWithMissingSEF(DEADLINE, 3);

    expect(result.map((e: { id: string }) => e.id)).toEqual(["at", "over"]);
  });
});
