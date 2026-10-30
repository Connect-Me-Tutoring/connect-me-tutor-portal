import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockFrom = vi.fn((_table?: string): any => ({ select: mockSelect }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
  createAdminClient: vi.fn().mockResolvedValue({ from: mockFrom }),
  createServerClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}));

const requireEnrollmentAccess = vi.fn();
const logDestructiveActivity = vi.fn().mockResolvedValue(undefined);

vi.mock("../auth/authz.server", () => ({
  requireAdmin: vi.fn().mockResolvedValue({}),
  requireAuthenticatedProfile: vi.fn(),
  requireEnrollmentAccess: (...args: unknown[]) => requireEnrollmentAccess(...args),
  requireTutorProfileAccess: vi.fn(),
}));

vi.mock("@/lib/posthog", () => ({
  logError: vi.fn().mockResolvedValue(undefined),
  logEvent: vi.fn().mockResolvedValue(undefined),
  logDestructiveActivity: (...args: unknown[]) => logDestructiveActivity(...args),
  logDestructiveActivities: vi.fn().mockResolvedValue(undefined),
}));

const { getEnrollmentsWithMissingSEF, removeEnrollment } =
  await import("../enrollment/server.actions");

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

describe("removeEnrollment deletion audit", () => {
  const enrollmentRow = {
    id: "enrollment-1",
    student_id: "student-1",
    tutor_id: "tutor-1",
    start_date: "2026-02-01",
    day: "Monday",
    start_time: "16:00",
    end_time: "17:00",
    duration: 60,
    frequency: "weekly",
    paused: false,
  };
  const student = {
    id: "student-1",
    user_id: "student-user-1",
    first_name: "Sam",
    last_name: "Student",
    email: "student@example.com",
    phone_number: "555-0101",
    parent_name: "Pat Parent",
    parent_email: "parent@example.com",
    parent_phone: "555-0100",
  };
  const tutor = {
    id: "tutor-1",
    user_id: "tutor-user-1",
    first_name: "Taylor",
    last_name: "Tutor",
    email: "tutor@example.com",
    phone_number: "555-0200",
  };

  const query = (result: unknown, throwResult?: unknown) => {
    const builder: Record<string, any> = {};
    for (const method of [
      "select",
      "delete",
      "update",
      "eq",
      "single",
      "in",
      "not",
      "gte",
    ]) {
      builder[method] = vi.fn(() => builder);
    }
    builder.throwOnError = vi.fn().mockResolvedValue(throwResult ?? result);
    builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
    return builder;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    requireEnrollmentAccess.mockResolvedValue({
      user: { id: "auth-user-1" },
      profile: { id: "profile-1", role: "Admin" },
    });
  });

  it("logs enrollment schedule and related profile contact details", async () => {
    let enrollmentCall = 0;
    mockFrom.mockImplementation((table?: string) => {
      if (table === "Enrollments") {
        enrollmentCall += 1;
        return enrollmentCall === 1
          ? query(
              { data: { ...enrollmentRow, student, tutor }, error: null },
              { data: { ...enrollmentRow, student, tutor }, error: null },
            )
          : query({ data: enrollmentRow, error: null });
      }
      if (table === "Sessions") return query({ data: [], error: null }, { data: [] });
      return query({ error: null });
    });

    await removeEnrollment("enrollment-1");

    expect(logDestructiveActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: "enrollment",
        resourceId: "enrollment-1",
        deletedObject: expect.objectContaining({
          id: "enrollment-1",
          student: expect.objectContaining({ email: "student@example.com" }),
          tutor: expect.objectContaining({ email: "tutor@example.com" }),
        }),
        resourceProperties: expect.objectContaining({
          enrollment_date: "2026-02-01",
          enrollment_duration: 60,
          student_name: "Sam Student",
          student_email: "student@example.com",
          tutor_name: "Taylor Tutor",
          tutor_email: "tutor@example.com",
        }),
      }),
    );
  });
});
