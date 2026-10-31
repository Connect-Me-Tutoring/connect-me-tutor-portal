import { describe, it, expect, vi, beforeEach } from "vitest";

/** Thenable PostgREST builder: records chained calls and resolves to the next result queued for its table. */
const results: Record<string, unknown[]> = {};
const calls: Array<{ table: string; chain: Array<[string, unknown[]]> }> = [];

const mockFrom = vi.fn((table: string) => {
  const chain: Array<[string, unknown[]]> = [];
  calls.push({ table, chain });
  const result = results[table]?.shift() ?? { data: [], error: null };
  const builder: Record<string, any> = {};
  for (const method of [
    "select",
    "eq",
    "neq",
    "in",
    "or",
    "lt",
    "gt",
    "gte",
    "lte",
    "not",
    "limit",
    "maybeSingle",
    "throwOnError",
  ]) {
    builder[method] = vi.fn((...args: unknown[]) => {
      chain.push([method, args]);
      return builder;
    });
  }
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}));

const { assertRoomFreeForEnrollment, assertRoomFreeForSession, ROOM_TAKEN_MESSAGE } =
  await import("../meeting/room-conflicts.server");

const ROOM = "room-1";
const queue = (table: string, ...data: unknown[]) => {
  results[table] = [...(results[table] ?? []), ...data.map((d) => ({ data: d, error: null }))];
};
const room = (name: string) => queue("Meetings", { name });
const chainFor = (table: string) => calls.find((c) => c.table === table)!.chain;

const enrollmentRow = (overrides: Record<string, unknown> = {}) => ({
  id: "other",
  meetingId: ROOM,
  day: "Monday",
  start_time: "16:30:00",
  end_time: "17:30:00",
  start_date: "2026-09-01T04:00:00.000Z",
  frequency: "weekly",
  paused: false,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  for (const table of Object.keys(results)) delete results[table];
  calls.length = 0;
});

describe("assertRoomFreeForEnrollment", () => {
  const slot = { meetingId: ROOM, day: "Monday", startTime: "16:00", endTime: "17:00" };

  it("rejects a slot that overlaps another enrollment in the room", async () => {
    room("Zoom Link B");
    queue("Enrollments", [enrollmentRow()]);

    await expect(assertRoomFreeForEnrollment(slot)).rejects.toThrow(ROOM_TAKEN_MESSAGE);
  });

  it("rejects a slot that overlaps a weekly meeting in the room", async () => {
    room("Zoom Link B");
    queue("weekly_meeting_schedules", [
      { day_of_week: "Monday", start_time: "16:45:00", end_time: "18:00:00" },
    ]);

    await expect(assertRoomFreeForEnrollment(slot)).rejects.toThrow(ROOM_TAKEN_MESSAGE);
  });

  it("allows back-to-back slots, other days, and the enrollment being edited", async () => {
    room("Zoom Link B");
    queue("Enrollments", [
      enrollmentRow({ id: "before", start_time: "15:00:00", end_time: "16:00:00" }),
      enrollmentRow({ id: "other-day", day: "Tuesday" }),
      enrollmentRow({ id: "self" }),
    ]);

    await expect(assertRoomFreeForEnrollment(slot, "self")).resolves.toBeUndefined();
  });

  it("only counts enrollments in this room that have not ended", async () => {
    room("Zoom Link B");

    await assertRoomFreeForEnrollment(slot);

    expect(chainFor("Enrollments")).toEqual(
      expect.arrayContaining([
        ["eq", ["meetingId", ROOM]],
        ["or", [expect.stringMatching(/^end_date\.is\.null,end_date\.gte\./)]],
      ]),
    );
  });

  it("never blocks the shared HQ room", async () => {
    room("Zoom Link HQ");

    await expect(assertRoomFreeForEnrollment(slot)).resolves.toBeUndefined();
    expect(calls.map((c) => c.table)).toEqual(["Meetings"]);
  });
});

describe("assertRoomFreeForSession", () => {
  // Wed Oct 28 2026, 5pm ET.
  const slot = { meetingId: ROOM, date: "2026-10-28T21:00:00.000Z", durationHours: 1 };

  const session = (date: string, extra: Record<string, unknown> = {}) => ({
    id: date,
    meeting_id: ROOM,
    date,
    duration: 1,
    enrollment_id: "e1",
    is_standalone: false,
    ...extra,
  });

  // An enrollment holding Wednesday 5pm in this room every week.
  const wednesday = (overrides: Record<string, unknown> = {}) =>
    enrollmentRow({ day: "Wednesday", start_time: "17:00:00", end_time: "18:00:00", ...overrides });

  it("rejects an overlapping live session in the room", async () => {
    room("Zoom Link B");
    queue("Sessions", [session("2026-10-28T20:30:00.000Z")]);

    await expect(assertRoomFreeForSession(slot)).rejects.toThrow(ROOM_TAKEN_MESSAGE);
  });

  it("allows back-to-back sessions", async () => {
    room("Zoom Link B");
    queue("Sessions", [session("2026-10-28T20:00:00.000Z")]);

    await expect(assertRoomFreeForSession(slot)).resolves.toBeUndefined();
  });

  it("ignores orphaned sessions left behind by deleted enrollments", async () => {
    room("Zoom Link B");
    queue("Sessions", [session("2026-10-28T21:00:00.000Z", { enrollment_id: null })]);

    await expect(assertRoomFreeForSession(slot)).resolves.toBeUndefined();
  });

  it("still counts standalone sessions, which have no enrollment by design", async () => {
    room("Zoom Link B");
    queue("Sessions", [
      session("2026-10-28T21:00:00.000Z", { enrollment_id: null, is_standalone: true }),
    ]);

    await expect(assertRoomFreeForSession(slot)).rejects.toThrow(ROOM_TAKEN_MESSAGE);
  });

  it("excludes the session being rescheduled and cancelled sessions", async () => {
    room("Zoom Link B");
    queue("Sessions", [session("2026-10-28T21:00:00.000Z", { id: "self" })]);

    await expect(assertRoomFreeForSession(slot, { sessionId: "self" })).resolves.toBeUndefined();
    expect(chainFor("Sessions")).toEqual(
      expect.arrayContaining([
        ["eq", ["meeting_id", ROOM]],
        ["not", ["status", "in", "(Cancelled,Rescheduled)"]],
      ]),
    );
  });

  it("rejects a weekly meeting held in the room at that Eastern day and time", async () => {
    room("Zoom Link B");
    queue("weekly_meeting_schedules", [
      { day_of_week: "Wednesday", start_time: "17:30:00", end_time: "18:30:00" },
    ]);

    await expect(assertRoomFreeForSession(slot)).rejects.toThrow(ROOM_TAKEN_MESSAGE);
  });

  it("rejects an enrollment's weekly slot when that week's session is not generated yet", async () => {
    room("Zoom Link B");
    queue("Enrollments", [wednesday()]);
    queue("Sessions", [], []); // nothing in the room, and no session yet for "other" that week

    await expect(assertRoomFreeForSession(slot)).rejects.toThrow(ROOM_TAKEN_MESSAGE);
    const generatedQuery = calls.filter((c) => c.table === "Sessions")[1].chain;
    expect(generatedQuery).toEqual(
      expect.arrayContaining([
        ["in", ["enrollment_id", ["other"]]],
        // Sun Oct 25 – Sat Oct 31 2026, Eastern.
        ["gte", ["date", "2026-10-25T04:00:00.000Z"]],
        ["lte", ["date", "2026-11-01T03:59:59.999Z"]],
      ]),
    );
  });

  it("leaves a generated week to the session check, so a moved session frees the slot", async () => {
    room("Zoom Link B");
    queue("Enrollments", [wednesday()]);
    queue("Sessions", [], [{ enrollment_id: "other" }]);

    await expect(assertRoomFreeForSession(slot)).resolves.toBeUndefined();
  });

  it("ignores the session's own enrollment, paused ones, and biweekly off-weeks", async () => {
    room("Zoom Link B");
    queue("Enrollments", [
      wednesday({ id: "own" }),
      wednesday({ id: "paused", paused: true }),
      // Week of Oct 18 is one week before Oct 25: an off week.
      wednesday({ id: "biweekly", frequency: "biweekly", start_date: "2026-10-21T04:00:00.000Z" }),
    ]);

    await expect(
      assertRoomFreeForSession(slot, { sessionId: "s1", enrollmentId: "own" }),
    ).resolves.toBeUndefined();
    expect(calls.filter((c) => c.table === "Sessions")).toHaveLength(1);
  });

  it("never blocks the shared HQ room", async () => {
    room("Zoom Link HQ");

    await expect(assertRoomFreeForSession(slot)).resolves.toBeUndefined();
    expect(calls.map((c) => c.table)).toEqual(["Meetings"]);
  });
});
