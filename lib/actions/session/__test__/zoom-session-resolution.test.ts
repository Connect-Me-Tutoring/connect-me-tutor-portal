import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression test for the Zoom webhook session-matching bug: shared Zoom
 * meeting links (reused across many enrollments) accumulate far-future
 * scheduled sessions. The old query ordered candidates `date DESC LIMIT 40`
 * with no upper bound, so once >40 future sessions existed for one meeting
 * link, the currently-happening session was crowded out of the result set
 * and never matched.
 */

type MeetingRow = { id: string; meeting_id: string };
type SessionRow = {
  id: string;
  date: string;
  duration: number;
  status: string;
  meeting_id: string;
};

let meetingsTable: MeetingRow[] = [];
let sessionsTable: SessionRow[] = [];

function makeMeetingsBuilder() {
  return {
    select: () => ({
      eq: (_col: string, val: string) => ({
        maybeSingle: async () => {
          const row = meetingsTable.find((m) => m.meeting_id === val) ?? null;
          return { data: row, error: null };
        },
      }),
    }),
  };
}

function makeSessionsBuilder() {
  const filters: Array<{ col: string; op: "eq" | "gte" | "lte" | "not_null"; val?: unknown }> = [];
  let orderCol: string | null = null;
  let ascending = true;
  let limitN: number | null = null;

  const builder: any = {
    select: () => builder,
    eq: (col: string, val: unknown) => {
      filters.push({ col, op: "eq", val });
      return builder;
    },
    not: (col: string, _op: string, _val: unknown) => {
      filters.push({ col, op: "not_null" });
      return builder;
    },
    gte: (col: string, val: unknown) => {
      filters.push({ col, op: "gte", val });
      return builder;
    },
    lte: (col: string, val: unknown) => {
      filters.push({ col, op: "lte", val });
      return builder;
    },
    order: (col: string, opts: { ascending: boolean }) => {
      orderCol = col;
      ascending = opts.ascending;
      return builder;
    },
    limit: (n: number) => {
      limitN = n;
      return builder;
    },
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
      let rows = sessionsTable.filter((row) =>
        filters.every((f) => {
          const v = (row as any)[f.col];
          if (f.op === "eq") return v === f.val;
          if (f.op === "gte") return v >= (f.val as string);
          if (f.op === "lte") return v <= (f.val as string);
          if (f.op === "not_null") return v !== null && v !== undefined;
          return true;
        }),
      );

      if (orderCol) {
        rows = [...rows].sort((a, b) => {
          const av = (a as any)[orderCol as string];
          const bv = (b as any)[orderCol as string];
          return ascending ? (av < bv ? -1 : 1) : av > bv ? -1 : 1;
        });
      }
      if (limitN !== null) rows = rows.slice(0, limitN);

      return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
    },
  };
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(async () => ({
    from: (table: string) => (table === "Meetings" ? makeMeetingsBuilder() : makeSessionsBuilder()),
  })),
  createClient: vi.fn(async () => ({
    from: (table: string) => (table === "Meetings" ? makeMeetingsBuilder() : makeSessionsBuilder()),
  })),
}));

const { resolvePortalSessionForZoomMeetingNumber } = await import("../server.actions");

describe("resolvePortalSessionForZoomMeetingNumber", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meetingsTable = [{ id: "meeting-row-id", meeting_id: "959 3901 3265" }];
    sessionsTable = [];
  });

  it("finds the currently active session even when 40+ future sessions share the same meeting link", async () => {
    const now = new Date();

    // The session actually happening right now.
    const currentSession: SessionRow = {
      id: "current-session-id",
      date: new Date(now.getTime() - 10 * 60 * 1000).toISOString(), // started 10 min ago
      duration: 1, // 1 hour
      status: "Active",
      meeting_id: "meeting-row-id",
    };

    // Simulate a heavily-shared Zoom link: 45 sessions scheduled weeks/months
    // into the future for other enrollments reusing the same link.
    const futureSessions: SessionRow[] = Array.from({ length: 45 }, (_, i) => ({
      id: `future-session-${i}`,
      date: new Date(now.getTime() + (i + 1) * 7 * 24 * 60 * 60 * 1000).toISOString(),
      duration: 1,
      status: "Active",
      meeting_id: "meeting-row-id",
    }));

    sessionsTable = [...futureSessions, currentSession];

    const result = await resolvePortalSessionForZoomMeetingNumber("95939013265");

    expect(result?.sessionId).toBe("current-session-id");
  });
});
