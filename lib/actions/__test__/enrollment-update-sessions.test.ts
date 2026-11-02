import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/** Thenable PostgREST builder: records chained calls and resolves to the next result queued for its table. */
const results: Record<string, unknown[]> = {};
const calls: Array<{ table: string; chain: Array<[string, unknown[]]> }> = [];

const mockFrom = vi.fn((table: string) => {
  const chain: Array<[string, unknown[]]> = [];
  calls.push({ table, chain });
  const result = results[table]?.shift() ?? { data: [], error: null };
  const builder: Record<string, any> = new Proxy(
    {},
    {
      get(_, method: string) {
        if (method === "then") {
          return (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
        }
        return (...args: unknown[]) => {
          chain.push([method, args]);
          return builder;
        };
      },
    },
  );
  return builder;
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
  createAdminClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}));
vi.mock("../auth/authz.server", () => ({
  requireAdmin: vi.fn().mockResolvedValue({}),
  requireAuthenticatedProfile: vi.fn(),
  requireEnrollmentAccess: vi.fn(),
  requireTutorProfileAccess: vi.fn(),
}));
vi.mock("../meeting/room-conflicts.server", () => ({
  assertRoomFreeForEnrollment: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/posthog", () => ({
  logError: vi.fn().mockResolvedValue(undefined),
  logEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/email/mailer", () => ({ sendMail: vi.fn() }));

const { updateEnrollment } = await import("../enrollment/server.actions");

const queue = (table: string, ...data: unknown[]) => {
  results[table] = [...(results[table] ?? []), ...data.map((d) => ({ data: d, error: null }))];
};
const upsertedRows = () =>
  calls.flatMap((c) => c.chain).find(([method]) => method === "upsert")?.[1][0] as Array<
    Record<string, unknown>
  >;

// Enrollment moving from Monday 4–5pm ET in room-1 to Wednesday 5–6pm ET in room-2.
const enrollment = {
  id: "e1",
  createdAt: "",
  student: { id: "student" },
  tutor: { id: "tutor" },
  summary: "",
  startDate: "2026-09-01T04:00:00.000Z",
  endDate: null,
  day: "Wednesday",
  startTime: "17:00",
  endTime: "18:00",
  meetingId: "room-2",
  paused: false,
  duration: 1,
  frequency: "weekly",
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  for (const table of Object.keys(results)) delete results[table];
  calls.length = 0;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-02T12:00:00.000Z"));
});
afterEach(() => vi.useRealTimers());

describe("updateEnrollment → upcoming sessions", () => {
  const queueEnrollmentReads = () =>
    queue(
      "Enrollments",
      [], // no duplicate enrollment
      { meetingId: "room-1", day: "Monday", start_time: "16:00:00", end_time: "17:00:00" },
      { id: "e1" }, // the update itself
    );

  it("moves sessions on the old slot and leaves rescheduled ones where they are", async () => {
    queueEnrollmentReads();
    queue("Sessions", [
      // Mon Nov 9, 4pm ET: on the old weekly slot.
      { id: "regular", date: "2026-11-09T21:00:00.000Z", meeting_id: "room-1", duration: 1 },
      // Thu Nov 5, 7pm ET in room-3: rescheduled off the slot.
      { id: "moved", date: "2026-11-06T00:00:00.000Z", meeting_id: "room-3", duration: 1.5 },
    ]);

    await updateEnrollment(enrollment);

    expect(upsertedRows()).toEqual([
      {
        id: "regular",
        student_id: "student",
        tutor_id: "tutor",
        meeting_id: "room-2",
        duration: 1,
        // Wed Nov 11, 5pm ET.
        date: "2026-11-11T22:00:00.000Z",
      },
      {
        id: "moved",
        student_id: "student",
        tutor_id: "tutor",
        meeting_id: "room-3",
        duration: 1.5,
        date: "2026-11-06T00:00:00.000Z",
      },
    ]);
  });

  it("does not snap a rescheduled session back on an edit that leaves the schedule alone", async () => {
    queue(
      "Enrollments",
      [],
      { meetingId: "room-2", day: "Wednesday", start_time: "17:00:00", end_time: "18:00:00" },
      { id: "e1" },
    );
    queue("Sessions", [
      // Thu Nov 12, 5pm ET: moved a day later than the Wednesday slot.
      { id: "moved", date: "2026-11-12T22:00:00.000Z", meeting_id: "room-2", duration: 1 },
    ]);

    await updateEnrollment(enrollment);

    expect(upsertedRows()).toEqual([
      expect.objectContaining({ id: "moved", date: "2026-11-12T22:00:00.000Z" }),
    ]);
  });
});
