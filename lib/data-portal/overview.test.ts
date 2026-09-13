import { describe, expect, it } from "vitest";
import {
  mapOverviewToSections,
  overviewPayloadSchema,
  type OverviewPayload,
} from "./overview";

/**
 * The payload contract and the honesty rules in the mapping: partial periods
 * excluded from totals, undefined ratios stay undefined, unstaffed subjects
 * rank first, younger cohorts absent rather than zero.
 */

const PAYLOAD: OverviewPayload = {
  dateRange: "last-90-days",
  generatedAt: "2026-08-27T12:00:00Z",
  sessionsOverTime: {
    bucket: "week",
    points: [
      { label: "Aug 10", value: 5, partial: false },
      { label: "Aug 17", value: 0, partial: false },
      { label: "Aug 24", value: 2, partial: true },
    ],
  },
  signupFunnel: { windowDays: 30, signedUp: 200, matched: 120, completedFirstSession: 90 },
  subjectDemand: {
    rows: [
      { subject: "Algebra II", studentsRequesting: 40, tutorsAvailable: 10 },
      { subject: "Chemistry", studentsRequesting: 12, tutorsAvailable: 0 },
      { subject: "Geometry", studentsRequesting: 30, tutorsAvailable: 3 },
    ],
    reads: { requestsRead: 60, tutorsRead: 25 },
  },
  tutorRetention: {
    horizonDays: 90,
    activityDays: 45,
    cohorts: [
      { label: "Mar 2026", cohortSize: 40, retained: 30 },
      { label: "Apr 2026", cohortSize: 20, retained: 13 },
    ],
    tutorsRead: 60,
  },
};

describe("overviewPayloadSchema", () => {
  it("accepts the contract shape", () => {
    expect(overviewPayloadSchema.safeParse(PAYLOAD).success).toBe(true);
  });

  it("rejects unknown fields anywhere in the payload", () => {
    const withExtra = { ...PAYLOAD, surprise: true };
    expect(overviewPayloadSchema.safeParse(withExtra).success).toBe(false);

    const withNestedExtra = {
      ...PAYLOAD,
      signupFunnel: { ...PAYLOAD.signupFunnel, secret: 1 },
    };
    expect(overviewPayloadSchema.safeParse(withNestedExtra).success).toBe(false);
  });

  it("rejects negative counts and bad ranges", () => {
    const negative = {
      ...PAYLOAD,
      signupFunnel: { ...PAYLOAD.signupFunnel, signedUp: -1 },
    };
    expect(overviewPayloadSchema.safeParse(negative).success).toBe(false);

    expect(
      overviewPayloadSchema.safeParse({ ...PAYLOAD, dateRange: "last-week" }).success,
    ).toBe(false);
  });
});

describe("mapOverviewToSections", () => {
  const sections = mapOverviewToSections(PAYLOAD);
  const byId = Object.fromEntries(sections.map((section) => [section.id, section]));

  it("labels the running period and excludes it from the completed total", () => {
    const sessions = byId.sessions;
    const metric = sessions.results.find((result) => result.kind === "metric");
    const series = sessions.results.find((result) => result.kind === "series");

    expect(metric).toMatchObject({ value: 5 }); // 5 + 0, without the partial 2
    expect(series && series.kind === "series" ? series.points.map((p) => p.label) : []).toEqual([
      "Aug 10",
      "Aug 17",
      "Aug 24 (partial)",
    ]);
    expect(sessions.sourceRows).toBe(7);
  });

  it("computes the funnel conversion from its own stages", () => {
    const funnel = byId.funnel;
    const metric = funnel.results.find((result) => result.kind === "metric");
    expect(metric).toMatchObject({ value: 45, unit: "%" }); // 90 / 200

    const stages = funnel.results.find((result) => result.kind === "funnel");
    expect(stages && stages.kind === "funnel" ? stages.stages.map((s) => s.count) : []).toEqual([
      200, 120, 90,
    ]);
  });

  it("ranks unstaffed subjects first and leaves their ratio undefined", () => {
    const subjects = byId.subjects;
    const breakdown = subjects.results.find((result) => result.kind === "breakdown");
    if (!breakdown || breakdown.kind !== "breakdown") throw new Error("missing breakdown");

    // Chemistry (no tutors) leads; then Geometry (10/tutor) over Algebra (4).
    expect(breakdown.rows.map((row) => row.label)).toEqual(["Chemistry", "Geometry", "Algebra II"]);
    expect(breakdown.rows[0].values[2]).toBeNull();
    expect(breakdown.rows[1].values[2]).toBe(10);
    expect(breakdown.rows[2].values[2]).toBe(4);

    // requestsRead + tutorsRead — never the per-subject counts summed.
    expect(subjects.sourceRows).toBe(85);
  });

  it("reports retention as percentages with the latest cohort highlighted", () => {
    const retention = byId.retention;
    const series = retention.results.find((result) => result.kind === "series");
    expect(series && series.kind === "series" ? series.points.map((p) => p.value) : []).toEqual([
      75, 65,
    ]);

    const metric = retention.results.find((result) => result.kind === "metric");
    expect(metric).toMatchObject({ value: 65, unit: "%" });
    expect(metric?.label).toContain("Apr 2026");
  });

  it("shows honest empty states instead of zeros", () => {
    const empty = mapOverviewToSections({
      ...PAYLOAD,
      subjectDemand: { rows: [], reads: { requestsRead: 0, tutorsRead: 0 } },
      tutorRetention: { ...PAYLOAD.tutorRetention, cohorts: [], tutorsRead: 0 },
    });
    const byIdEmpty = Object.fromEntries(empty.map((section) => [section.id, section]));

    expect(byIdEmpty.subjects.results).toEqual([]);
    expect(byIdEmpty.subjects.emptyNote).toBeTruthy();
    expect(byIdEmpty.retention.results).toEqual([]);
    expect(byIdEmpty.retention.emptyNote).toContain("day-90");
  });

  it("every section states its limitations", () => {
    for (const section of sections) {
      expect(section.limitations.length).toBeGreaterThan(0);
    }
  });
});
