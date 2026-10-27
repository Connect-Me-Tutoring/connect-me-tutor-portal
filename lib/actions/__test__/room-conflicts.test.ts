import { describe, it, expect, vi, beforeEach } from "vitest";

/** Thenable PostgREST builder: records chained calls and resolves to the queued result. */
const results: unknown[] = [];
const calls: Array<{ table: string; chain: Array<[string, unknown[]]> }> = [];

const mockFrom = vi.fn((table: string) => {
  const chain: Array<[string, unknown[]]> = [];
  calls.push({ table, chain });
  const result = results.shift();
  const builder: Record<string, any> = {};
  for (const method of [
    "select",
    "eq",
    "neq",
    "lt",
    "gt",
    "gte",
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

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}));

const { assertRoomFreeForEnrollment, assertRoomFreeForSession, ROOM_TAKEN_MESSAGE } =
  await import("../meeting/room-conflicts.server");

const ROOM = "room-1";
const room = (name: string) => ({ data: { name }, error: null });
const rows = (data: unknown[]) => ({ data, error: null });

describe("assertRoomFreeForEnrollment", () => {
  const slot = { meetingId: ROOM, day: "Monday", startTime: "16:00", endTime: "17:00" };

  beforeEach(() => {
    vi.clearAllMocks();
    results.length = 0;
    calls.length = 0;
  });

  it("rejects a slot that overlaps another enrollment in the room", async () => {
    results.push(room("Zoom Link B"), rows([{ id: "other" }]), rows([]));

    await expect(assertRoomFreeForEnrollment(slot)).rejects.toThrow(ROOM_TAKEN_MESSAGE);
  });

  it("rejects a slot that overlaps a weekly meeting in the room", async () => {
    results.push(room("Zoom Link B"), rows([]), rows([{ id: "biweekly-meeting" }]));

    await expect(assertRoomFreeForEnrollment(slot)).rejects.toThrow(ROOM_TAKEN_MESSAGE);
  });

  it("checks only the same room and day, with strict overlap, excluding the edited enrollment", async () => {
    results.push(room("Zoom Link B"), rows([]), rows([]));

    await assertRoomFreeForEnrollment(slot, "self");

    const enrollmentQuery = calls.find((c) => c.table === "Enrollments")!.chain;
    expect(enrollmentQuery).toEqual(
      expect.arrayContaining([
        ["eq", ["meetingId", ROOM]],
        ["eq", ["day", "Monday"]],
        ["lt", ["start_time", "17:00"]],
        ["gt", ["end_time", "16:00"]],
        ["neq", ["id", "self"]],
      ]),
    );
  });

  it("never blocks the shared HQ room", async () => {
    results.push(room("Zoom Link HQ"));

    await expect(assertRoomFreeForEnrollment(slot)).resolves.toBeUndefined();
    expect(calls.map((c) => c.table)).toEqual(["Meetings"]);
  });
});

describe("assertRoomFreeForSession", () => {
  // Wed Oct 28 2026, 5pm ET.
  const slot = { meetingId: ROOM, date: "2026-10-28T21:00:00.000Z", durationHours: 1 };

  beforeEach(() => {
    vi.clearAllMocks();
    results.length = 0;
    calls.length = 0;
  });

  const session = (date: string, extra: Record<string, unknown> = {}) => ({
    id: date,
    date,
    duration: 1,
    enrollment_id: "e1",
    is_standalone: false,
    ...extra,
  });

  it("rejects an overlapping live session in the room", async () => {
    results.push(room("Zoom Link B"), rows([session("2026-10-28T20:30:00.000Z")]));

    await expect(assertRoomFreeForSession(slot)).rejects.toThrow(ROOM_TAKEN_MESSAGE);
  });

  it("allows back-to-back sessions", async () => {
    results.push(room("Zoom Link B"), rows([session("2026-10-28T20:00:00.000Z")]));

    await expect(assertRoomFreeForSession(slot)).resolves.toBeUndefined();
  });

  it("ignores orphaned sessions left behind by deleted enrollments", async () => {
    results.push(
      room("Zoom Link B"),
      rows([session("2026-10-28T21:00:00.000Z", { enrollment_id: null })]),
    );

    await expect(assertRoomFreeForSession(slot)).resolves.toBeUndefined();
  });

  it("still counts standalone sessions, which have no enrollment by design", async () => {
    results.push(
      room("Zoom Link B"),
      rows([session("2026-10-28T21:00:00.000Z", { enrollment_id: null, is_standalone: true })]),
    );

    await expect(assertRoomFreeForSession(slot)).rejects.toThrow(ROOM_TAKEN_MESSAGE);
  });

  it("excludes the session being rescheduled and cancelled sessions", async () => {
    results.push(room("Zoom Link B"), rows([]));

    await assertRoomFreeForSession(slot, "self");

    const sessionQuery = calls.find((c) => c.table === "Sessions")!.chain;
    expect(sessionQuery).toEqual(
      expect.arrayContaining([
        ["neq", ["id", "self"]],
        ["not", ["status", "in", "(Cancelled,Rescheduled)"]],
      ]),
    );
  });
});
