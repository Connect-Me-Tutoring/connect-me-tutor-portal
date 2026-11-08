import { describe, it, expect } from "vitest";
import type { Session } from "@/types";
import { isActiveDashboardSession, isPastDashboardSession } from "./session-substitute";

const NOW = new Date("2026-11-04T12:00:00.000Z");
const FUTURE = "2026-11-05T22:00:00.000Z";
const PAST = "2026-11-03T22:00:00.000Z";

const session = (status: Session["status"], date: string) => ({ status, date }) as Session;

describe("dashboard session buckets", () => {
  it("keeps an upcoming Sub-Request session with the active sessions", () => {
    expect(isActiveDashboardSession(session("Sub-Request", FUTURE), NOW)).toBe(true);
    expect(isPastDashboardSession(session("Sub-Request", FUTURE), NOW)).toBe(false);
  });

  it("moves a Sub-Request session to past sessions once it has started", () => {
    expect(isActiveDashboardSession(session("Sub-Request", PAST), NOW)).toBe(false);
    expect(isPastDashboardSession(session("Sub-Request", PAST), NOW)).toBe(true);
  });

  it("leaves the existing buckets as they were", () => {
    expect(isActiveDashboardSession(session("Active", PAST), NOW)).toBe(true);
    expect(isPastDashboardSession(session("Active", PAST), NOW)).toBe(false);

    for (const status of [
      "Complete",
      "Cancelled",
      "Unconfirmed",
      "Student Did Not Attend",
    ] as const) {
      expect(isActiveDashboardSession(session(status, FUTURE), NOW)).toBe(false);
      expect(isPastDashboardSession(session(status, FUTURE), NOW)).toBe(true);
    }

    expect(isActiveDashboardSession(session("Rescheduled", FUTURE), NOW)).toBe(false);
    expect(isPastDashboardSession(session("Rescheduled", PAST), NOW)).toBe(false);
  });
});
