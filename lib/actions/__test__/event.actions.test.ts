import { describe, it, expect, vi, beforeEach } from "vitest";

const results: Record<string, { data: unknown; error: unknown }> = {};
const calls: Record<string, { method: string; args: unknown[] }[]> = {};

/** A PostgREST builder stand-in: every filter chains, and awaiting it yields the table's result. */
const builderFor = (table: string) => {
  const builder: Record<string, any> = {};
  for (const method of ["select", "eq", "order"]) {
    builder[method] = vi.fn((...args: unknown[]) => {
      (calls[table] ??= []).push({ method, args });
      return builder;
    });
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve(results[table]));
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(results[table]).then(resolve);
  return builder;
};

const mockFrom = vi.fn((table: string) => builderFor(table));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}));

const mockRequireTutorProfileAccess = vi.fn();
vi.mock("../auth/authz.server", () => ({
  requireTutorProfileAccess: (...args: unknown[]) => mockRequireTutorProfileAccess(...args),
}));

vi.mock("@/lib/posthog", () => ({
  logError: vi.fn().mockResolvedValue(undefined),
  logEvent: vi.fn().mockResolvedValue(undefined),
}));

const { getTutorEventHistory } = await import("../event/server.actions");

const TUTOR_ID = "11111111-1111-4111-8111-111111111111";

describe("getTutorEventHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(calls)) delete calls[key];
    mockRequireTutorProfileAccess.mockResolvedValue({});
    results.Profiles = {
      data: { id: TUTOR_ID, first_name: "Ada", last_name: "Lovelace", email: "ada@example.com" },
      error: null,
    };
    results.Events = {
      data: [
        {
          id: "e1",
          created_at: "2026-10-02T00:00:00Z",
          date: "2026-10-01T00:00:00Z",
          summary: "Covered a session",
          tutor_id: TUTOR_ID,
          hours: 1.5,
          type: "Sub Hotline",
        },
      ],
      error: null,
    };
  });

  it("checks the caller may see this tutor before querying", async () => {
    mockRequireTutorProfileAccess.mockRejectedValue(new Error("Unauthorized"));

    await expect(getTutorEventHistory(TUTOR_ID)).rejects.toThrow("Unauthorized");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns the tutor and every event with its type, newest first", async () => {
    const history = await getTutorEventHistory(TUTOR_ID);

    expect(history).toEqual({
      tutor: { id: TUTOR_ID, firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
      events: [
        {
          id: "e1",
          createdAt: "2026-10-02T00:00:00Z",
          date: "2026-10-01T00:00:00Z",
          summary: "Covered a session",
          tutorId: TUTOR_ID,
          hours: 1.5,
          type: "Sub Hotline",
        },
      ],
    });
    expect(calls.Events).toContainEqual({ method: "eq", args: ["tutor_id", TUTOR_ID] });
    expect(calls.Events).toContainEqual({
      method: "order",
      args: ["date", { ascending: false, nullsFirst: false }],
    });
    expect(calls.Events?.find((c) => c.method === "select")?.args[0]).toContain("type");
  });

  it("returns null when the id is not a tutor", async () => {
    results.Profiles = { data: null, error: null };

    expect(await getTutorEventHistory(TUTOR_ID)).toBeNull();
    expect(calls.Profiles).toContainEqual({ method: "eq", args: ["role", "Tutor"] });
  });

  it("throws when a query fails", async () => {
    results.Events = { data: null, error: new Error("boom") };

    await expect(getTutorEventHistory(TUTOR_ID)).rejects.toThrow("boom");
  });
});
