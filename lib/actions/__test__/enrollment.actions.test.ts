import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockFrom = vi.fn(() => ({ select: mockSelect, update: mockUpdate, delete: mockDelete }));

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

const mockSendMail = vi.fn();
vi.mock("@/lib/email/mailer", () => ({
  sendMail: (...args: unknown[]) => mockSendMail(...args),
}));

const { logError } = await import("@/lib/posthog");
const {
  getEnrollmentsWithMissingSEF,
  warnInactiveEnrollmentsEarly,
  warnInactiveEnrollments,
  deleteInactiveEnrollments,
} = await import("../enrollment/server.actions");

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

  // One Unconfirmed session per Eastern week (Mondays, 4pm ET).
  const weekly = (count: number) =>
    ["2026-06-15", "2026-06-22", "2026-06-29", "2026-07-06"]
      .slice(0, count)
      .map((day, i) => ({ id: `s${i}`, date: `${day}T20:00:00.000Z` }));

  it("keeps only enrollments at or past the missing-week threshold", async () => {
    mockQuery([
      { id: "under", sessions: weekly(2) },
      { id: "at", sessions: weekly(3) },
      { id: "over", sessions: weekly(4) },
    ]);

    const result = await getEnrollmentsWithMissingSEF(DEADLINE, 3);

    expect(result.map((e: { id: string }) => e.id)).toEqual(["at", "over"]);
  });

  it("counts two Unconfirmed sessions in the same week as one missed week", async () => {
    mockQuery([
      {
        id: "moved",
        sessions: [
          ...weekly(2),
          // Sat Jun 27 and Sun Jun 28 ET are different weeks; Mon Jun 22 + Sat Jun 27 are not.
          { id: "same-week", date: "2026-06-27T14:00:00.000Z" },
        ],
      },
    ]);

    const result = await getEnrollmentsWithMissingSEF(DEADLINE, 3);

    expect(result).toEqual([]);
  });
});

describe("inactivity warnings and deletion", () => {
  const NOW = new Date("2026-10-26T12:00:00.000Z");
  const COOLDOWN_START = "2026-10-12T12:00:00.000Z"; // 14 days before NOW

  /** A thenable builder that records every chained call and resolves to `result`. */
  const chain = (result: unknown) => {
    const calls: Array<[string, unknown[]]> = [];
    const builder: Record<string, any> = {};
    for (const method of ["in", "gte", "lte", "eq", "or", "not", "select", "throwOnError"]) {
      builder[method] = vi.fn((...args: unknown[]) => {
        calls.push([method, args]);
        return builder;
      });
    }
    builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
    return { builder, calls };
  };

  const missingSef = (ids: string[]) =>
    chain({
      data: ids.map((id) => ({
        id,
        // Five different Eastern weeks, enough for every threshold.
        sessions: [
          { id: "a", date: "2026-09-21T20:00:00.000Z" },
          { id: "b", date: "2026-09-28T20:00:00.000Z" },
          { id: "c", date: "2026-10-05T20:00:00.000Z" },
          { id: "d", date: "2026-10-12T20:00:00.000Z" },
          { id: "e", date: "2026-10-19T20:00:00.000Z" },
        ],
      })),
      error: null,
    });

  const enrollmentRows = (ids: string[]) =>
    chain({
      data: ids.map((id) => ({
        id,
        student: { id: `student-${id}`, first_name: "Sam", last_name: "Lee" },
        tutor: {
          id: `tutor-${id}`,
          first_name: "Tia",
          last_name: "Ng",
          email: `${id}@example.com`,
        },
      })),
      error: null,
    });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.stubEnv("OPERATIONS_EMAIL", "ops@example.com");
    mockSendMail.mockResolvedValue({ data: { id: "msg" }, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  /**
   * The claim: read the current stamps, the conditional UPDATE, then the read-back of rows
   * carrying this run's stamp. Queue the missing-SEF query before calling this.
   */
  const mockClaim = (
    ids: string[],
    claimedIds: string[],
    previous: Record<string, unknown> = {},
  ) => {
    const before = chain({
      data: ids.map((id) => ({
        id,
        inactivity_warning_sent_at: null,
        inactivity_warning_level: null,
        ...previous,
      })),
      error: null,
    });
    const update = chain({ error: null });
    const readBack = chain({ data: claimedIds.map((id) => ({ id })), error: null });
    mockSelect.mockReturnValueOnce(before.builder).mockReturnValueOnce(readBack.builder);
    mockUpdate.mockReturnValueOnce(update.builder);
    return { update, readBack };
  };

  it("claims enrollments outside the cooldown and emails only those", async () => {
    mockSelect.mockReturnValueOnce(missingSef(["e1", "e2"]).builder);
    const { update, readBack } = mockClaim(["e1", "e2"], ["e1"]);
    const details = enrollmentRows(["e1"]);
    mockSelect.mockReturnValueOnce(details.builder);

    const result = await warnInactiveEnrollmentsEarly();

    expect(mockUpdate).toHaveBeenCalledWith({
      inactivity_warning_sent_at: NOW.toISOString(),
      inactivity_warning_level: 3,
    });
    expect(update.calls).toContainEqual(["in", ["id", ["e1", "e2"]]]);
    expect(update.calls).toContainEqual([
      "or",
      [
        `inactivity_warning_sent_at.is.null,inactivity_warning_sent_at.lt.${COOLDOWN_START},inactivity_warning_level.lt.3`,
      ],
    ]);
    // .select() on the UPDATE would make PostgREST re-apply .or() and drop the stamped rows.
    expect(update.calls.map(([method]) => method)).not.toContain("select");
    expect(readBack.calls).toContainEqual([
      "eq",
      ["inactivity_warning_sent_at", NOW.toISOString()],
    ]);
    expect(details.calls).toContainEqual(["in", ["id", ["e1"]]]);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(result.map((e: { id: string }) => e.id)).toEqual(["e1"]);
  });

  it("lets the 4-week warning through an earlier 3-week stamp", async () => {
    mockSelect.mockReturnValueOnce(missingSef(["e1"]).builder);
    const { update } = mockClaim(["e1"], ["e1"]);
    mockSelect.mockReturnValueOnce(enrollmentRows(["e1"]).builder);

    await warnInactiveEnrollments();

    expect(mockUpdate).toHaveBeenCalledWith({
      inactivity_warning_sent_at: NOW.toISOString(),
      inactivity_warning_level: 4,
    });
    expect(update.calls).toContainEqual([
      "or",
      [
        `inactivity_warning_sent_at.is.null,inactivity_warning_sent_at.lt.${COOLDOWN_START},inactivity_warning_level.lt.4`,
      ],
    ]);
  });

  it("sends nothing when every enrollment was warned within the cooldown", async () => {
    mockSelect.mockReturnValueOnce(missingSef(["e1"]).builder);
    mockClaim(["e1"], []);

    const result = await warnInactiveEnrollmentsEarly();

    expect(mockSendMail).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("routes replies to operations", async () => {
    mockSelect.mockReturnValueOnce(missingSef(["e1"]).builder);
    mockClaim(["e1"], ["e1"]);
    mockSelect.mockReturnValueOnce(enrollmentRows(["e1"]).builder);

    await warnInactiveEnrollmentsEarly();

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "e1@example.com", replyTo: "ops@example.com" }),
    );
  });

  it("restores the previous stamp when an email fails, without stopping the others", async () => {
    const earlier = "2026-10-01T08:00:00.000Z";
    mockSelect.mockReturnValueOnce(missingSef(["e1", "e2"]).builder);
    mockClaim(["e1", "e2"], ["e1", "e2"], {
      inactivity_warning_sent_at: earlier,
      inactivity_warning_level: 3,
    });
    mockSelect.mockReturnValueOnce(enrollmentRows(["e1", "e2"]).builder);
    const release = chain({ error: null });
    mockUpdate.mockReturnValueOnce(release.builder);
    mockSendMail.mockImplementation(async ({ to }: { to: string }) => {
      if (to === "e1@example.com") throw new Error("resend down");
      return { data: { id: "msg" }, error: null };
    });

    const result = await warnInactiveEnrollments();

    expect(result.map((e: { id: string }) => e.id)).toEqual(["e2"]);
    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "e2@example.com" }));
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "resend down" }),
      expect.objectContaining({ enrollment_id: "e1" }),
      "enrollment_error",
    );
    expect(mockUpdate).toHaveBeenLastCalledWith({
      inactivity_warning_sent_at: earlier,
      inactivity_warning_level: 3,
    });
    // Only undo our own claim, never a newer run's.
    expect(release.calls).toEqual(
      expect.arrayContaining([
        ["eq", ["id", "e1"]],
        ["eq", ["inactivity_warning_sent_at", NOW.toISOString()]],
      ]),
    );
  });

  it("releases the claim when Resend reports an error without throwing", async () => {
    mockSelect.mockReturnValueOnce(missingSef(["e1"]).builder);
    mockClaim(["e1"], ["e1"]);
    mockSelect.mockReturnValueOnce(enrollmentRows(["e1"]).builder);
    mockUpdate.mockReturnValueOnce(chain({ error: null }).builder);
    mockSendMail.mockResolvedValueOnce({ data: null, error: { message: "rate limited" } });

    await expect(warnInactiveEnrollmentsEarly()).resolves.toEqual([]);

    expect(mockUpdate).toHaveBeenLastCalledWith({
      inactivity_warning_sent_at: null,
      inactivity_warning_level: null,
    });
  });

  it("still deletes every inactive enrollment when one deletion notice fails", async () => {
    mockSelect
      .mockReturnValueOnce(missingSef(["e1", "e2"]).builder)
      .mockReturnValueOnce(enrollmentRows(["e1", "e2"]).builder)
      // removeFutureSessions: no future sessions to remove.
      .mockReturnValueOnce(chain({ data: [], error: null }).builder);
    const remove = chain({ error: null });
    mockDelete.mockReturnValueOnce(remove.builder);
    mockSendMail.mockImplementation(async ({ to, subject }: { to: string; subject: string }) => {
      if (to === "e1@example.com" && subject.startsWith("Inactivating")) {
        return { data: null, error: { message: "bounced" } };
      }
      return { data: { id: "msg" }, error: null };
    });

    const result = await deleteInactiveEnrollments();

    expect(result).toEqual({ success: true, error: undefined, deleted: 2 });
    expect(remove.calls).toContainEqual(["in", ["id", ["e1", "e2"]]]);
    // Deletion notices are not throttled, so nothing is claimed or released.
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
