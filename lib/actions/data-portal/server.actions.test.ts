import { describe, expect, it, vi, beforeEach } from "vitest";
import { requireAdmin } from "../auth/authz.server";
import { createClient } from "@/lib/supabase/server";

vi.mock("../auth/authz.server", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const { getDataPortalOverview } = await import("./server.actions");

const requireAdminMock = requireAdmin as ReturnType<typeof vi.fn>;
const createClientMock = createClient as ReturnType<typeof vi.fn>;

const VALID_PAYLOAD = {
  dateRange: "last-90-days",
  generatedAt: "2026-08-27T12:00:00Z",
  sessionsOverTime: {
    bucket: "week",
    points: [{ label: "Aug 24", value: 2, partial: true }],
  },
  signupFunnel: { windowDays: 30, signedUp: 10, matched: 5, completedFirstSession: 3 },
  subjectDemand: {
    rows: [{ subject: "Math", studentsRequesting: 4, tutorsAvailable: 2 }],
    reads: { requestsRead: 4, tutorsRead: 2 },
  },
  tutorRetention: {
    horizonDays: 90,
    activityDays: 45,
    cohorts: [{ label: "Mar 2026", cohortSize: 10, retained: 8 }],
    tutorsRead: 10,
  },
};

function stubRpc(result: { data?: unknown; error?: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  createClientMock.mockResolvedValue({ rpc });
  return rpc;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue({ user: { id: "admin-1" }, profile: { role: "Admin" } });
});

describe("getDataPortalOverview", () => {
  it("refuses before any database work when requireAdmin throws", async () => {
    requireAdminMock.mockRejectedValue(new Error("Admin access required"));
    const rpc = stubRpc({ data: VALID_PAYLOAD });

    const outcome = await getDataPortalOverview("last-90-days");

    expect(outcome).toEqual({ ok: false, error: "This panel is limited to administrators." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an unknown date range without calling the database", async () => {
    const rpc = stubRpc({ data: VALID_PAYLOAD });

    const outcome = await getDataPortalOverview("all-time");

    expect(outcome).toEqual({ ok: false, error: "Unknown date range." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps the database's own admin refusal to the same generic denial", async () => {
    stubRpc({ error: { message: "Admin access required" } });

    const outcome = await getDataPortalOverview("last-30-days");

    expect(outcome).toEqual({ ok: false, error: "This panel is limited to administrators." });
  });

  it("returns mapped sections for a payload that matches the contract", async () => {
    const rpc = stubRpc({ data: VALID_PAYLOAD });

    const outcome = await getDataPortalOverview("last-90-days");

    expect(rpc).toHaveBeenCalledWith("data_portal_overview", { p_date_range: "last-90-days" });
    if (!outcome.ok) throw new Error("expected success");
    expect(outcome.sections.map((section) => section.id)).toEqual([
      "sessions",
      "funnel",
      "subjects",
      "retention",
    ]);
    expect(outcome.generatedAt).toBe("2026-08-27T12:00:00Z");
  });

  it("treats an off-contract payload as an error, never a partial render", async () => {
    stubRpc({ data: { ...VALID_PAYLOAD, surprise: true } });

    const outcome = await getDataPortalOverview("last-90-days");

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toContain("could not be loaded");
  });
});
