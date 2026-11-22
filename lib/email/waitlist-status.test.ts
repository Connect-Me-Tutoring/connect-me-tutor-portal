import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake service-role client: each query records its table/op/filters and resolves
// through `respond`, which the tests configure per table.
type Call = { table: string; op: string; filters: [string, string, unknown][]; payload?: unknown };
let respond: (call: Call) => { data?: unknown; error?: unknown };
const calls: Call[] = [];

function builder(table: string) {
  const call: Call = { table, op: "select", filters: [] };
  calls.push(call);
  const b: Record<string, unknown> = {};
  for (const m of ["select", "single"]) b[m] = () => b;
  for (const m of ["eq", "gte", "lte", "in"]) {
    b[m] = (col: string, val: unknown) => {
      call.filters.push([m, col, val]);
      return b;
    };
  }
  for (const op of ["insert", "update", "delete"]) {
    b[op] = (payload?: unknown) => {
      call.op = op;
      call.payload = payload;
      return b;
    };
  }
  b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null, ...respond(call) }).then(resolve, reject);
  return b;
}

const sendMail = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: async () => ({ from: (t: string) => builder(t) }),
}));
vi.mock("@/lib/email/mailer", () => ({ sendMail: (...a: unknown[]) => sendMail(...a) }));
vi.mock("@/lib/posthog", () => ({ logError: vi.fn() }));

const { sendWaitlistStatusEmails, buildWaitlistStatusDescription } = await import(
  "./waitlist-status"
);

const student = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  first_name: "Sam",
  last_name: id,
  parent_name: "Pat Parent",
  parent_email: `${id}@parent.test`,
  email: `${id}@student.test`,
  ...extra,
});

describe("sendWaitlistStatusEmails", () => {
  let students: ReturnType<typeof student>[];
  let enrolled: string[];
  let alreadySent: string[];

  beforeEach(() => {
    calls.length = 0;
    sendMail.mockReset().mockResolvedValue({ data: { id: "msg-1" }, error: null });
    students = [];
    enrolled = [];
    alreadySent = [];
    respond = (call) => {
      if (call.table === "Profiles") return { data: students };
      if (call.table === "Enrollments")
        return { data: enrolled.map((student_id) => ({ student_id })) };
      if (call.table === "session_reminders" && call.op === "select")
        return { data: alreadySent.map((id) => ({ description: buildWaitlistStatusDescription(id) })) };
      if (call.table === "session_reminders" && call.op === "insert") return { data: { id: 99 } };
      return {};
    };
  });

  it("queries active students created between 7 and 4 days ago", async () => {
    const now = new Date("2026-11-22T15:00:00Z");
    await sendWaitlistStatusEmails(now);
    const profiles = calls.find((c) => c.table === "Profiles")!;
    expect(profiles.filters).toEqual([
      ["eq", "role", "Student"],
      ["eq", "status", "Active"],
      ["gte", "created_at", "2026-11-15T15:00:00.000Z"],
      ["lte", "created_at", "2026-11-18T15:00:00.000Z"],
    ]);
  });

  it("emails only unenrolled, not-yet-emailed students", async () => {
    students = [student("a"), student("c"), student("d")];
    enrolled = ["c"];
    alreadySent = ["d"];

    const result = await sendWaitlistStatusEmails();

    expect(result).toEqual({ checked: 3, sent: 1, skipped: 2, failed: 0 });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0]).toMatchObject({
      to: "a@parent.test",
      cc: ["archives@connectmego.org", "admissions-archive@connectmego.org"],
      subject: "Connect Me Tutoring Status",
    });
  });

  it("falls back to the student email when there is no parent email", async () => {
    students = [student("a", { parent_email: null })];
    await sendWaitlistStatusEmails();
    expect(sendMail.mock.calls[0][0].to).toBe("a@student.test");
  });

  it("releases the claim when the send fails so the next run retries", async () => {
    students = [student("a")];
    sendMail.mockResolvedValue({ data: null, error: new Error("resend down") });

    const result = await sendWaitlistStatusEmails();

    expect(result).toMatchObject({ sent: 0, failed: 1 });
    const del = calls.find((c) => c.table === "session_reminders" && c.op === "delete");
    expect(del?.filters).toEqual([["eq", "id", 99]]);
  });
});
