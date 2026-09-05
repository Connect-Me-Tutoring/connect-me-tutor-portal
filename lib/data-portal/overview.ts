import { z } from "zod/v4";
import type { AnalysisResult, BreakdownResult } from "./results";

/**
 * The contract with `public.data_portal_overview()` and the mapping from its
 * payload to renderable sections.
 *
 * The schema is strict on purpose: the database function and this file are
 * the two halves of one contract
 * (supabase/migrations/20260827000000_add_data_portal_overview.sql), and a
 * payload that does not match exactly is treated as an error rather than
 * partially rendered.
 *
 * The mapping carries the measurement honesty ported from the standalone
 * data portal's tools: partial periods are labelled and excluded from
 * totals, a subject with no tutors has an undefined ratio (an em dash, not
 * zero and not infinity), unstaffed subjects rank first, and every section
 * states what its numbers can and cannot support.
 */

const count = z.number().int().nonnegative();

export const dateRangeSchema = z.enum(["last-30-days", "last-90-days", "this-year"]);
export type DateRange = z.infer<typeof dateRangeSchema>;

export const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "last-30-days", label: "Last 30 days" },
  { value: "last-90-days", label: "Last 90 days" },
  { value: "this-year", label: "This year" },
];

export const overviewPayloadSchema = z.strictObject({
  dateRange: dateRangeSchema,
  generatedAt: z.string().min(1).max(40),
  sessionsOverTime: z.strictObject({
    bucket: z.enum(["week", "month"]),
    points: z
      .array(z.strictObject({ label: z.string().min(1).max(40), value: count, partial: z.boolean() }))
      .max(400),
  }),
  signupFunnel: z.strictObject({
    windowDays: z.number().int().positive(),
    signedUp: count,
    matched: count,
    completedFirstSession: count,
  }),
  subjectDemand: z.strictObject({
    rows: z
      .array(
        z.strictObject({
          subject: z.string().min(1),
          studentsRequesting: count,
          tutorsAvailable: count,
        }),
      )
      .max(200),
    reads: z.strictObject({ requestsRead: count, tutorsRead: count }),
  }),
  tutorRetention: z.strictObject({
    horizonDays: z.number().int().positive(),
    activityDays: z.number().int().positive(),
    cohorts: z
      .array(z.strictObject({ label: z.string().min(1).max(40), cohortSize: count, retained: count }))
      .max(400),
    tutorsRead: count,
  }),
});

export type OverviewPayload = z.infer<typeof overviewPayloadSchema>;

export type OverviewSection = {
  id: string;
  title: string;
  results: AnalysisResult[];
  /** Shown when `results` is empty: why there is nothing, in plain words. */
  emptyNote?: string;
  /** What these numbers can and cannot support. Not decoration. */
  limitations: string[];
  /** Underlying records read, for the "how much data is this" disclosure. */
  sourceRows: number;
};

const RANGE_LABEL: Record<DateRange, string> = {
  "last-30-days": "the last 30 days",
  "last-90-days": "the last 90 days",
  // "to date" matters: the year is not over, so this is not a full-year
  // figure and must not be compared with one.
  "this-year": "this year to date",
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function sessionsSection(payload: OverviewPayload): OverviewSection {
  const { bucket, points } = payload.sessionsOverTime;
  const complete = points.filter((point) => !point.partial);
  const partial = points.filter((point) => point.partial);
  const rangeLabel = RANGE_LABEL[payload.dateRange];

  const limitations = [
    `Completed sessions only, counted per calendar ${bucket}.`,
    ...(partial.length > 0
      ? [
          `${partial.map((point) => point.label).join(", ")} is still in progress — shown, but not comparable with a finished ${bucket} and excluded from the total.`,
        ]
      : []),
  ];

  return {
    id: "sessions",
    title: "Session volume",
    results: [
      {
        kind: "metric",
        label: `Sessions in completed ${bucket}s, ${rangeLabel}`,
        value: complete.reduce((total, point) => total + point.value, 0),
        unit: "sessions",
        delta: null,
      },
      {
        kind: "series",
        label: `Completed sessions per ${bucket}`,
        unit: "sessions",
        points: points.map((point) => ({
          label: point.partial ? `${point.label} (partial)` : point.label,
          value: point.value,
        })),
      },
    ],
    limitations,
    sourceRows: points.reduce((total, point) => total + point.value, 0),
  };
}

function funnelSection(payload: OverviewPayload): OverviewSection {
  const { windowDays, signedUp, matched, completedFirstSession } = payload.signupFunnel;
  const overall = signedUp > 0 ? completedFirstSession / signedUp : 0;

  return {
    id: "funnel",
    title: "Signup to first session",
    results: [
      {
        kind: "metric",
        label: `Signed up to first session within ${windowDays} days`,
        value: round1(overall * 100),
        unit: "%",
        delta: null,
      },
      {
        kind: "funnel",
        label: `Cohorts whose ${windowDays}-day window closed in ${RANGE_LABEL[payload.dateRange]}`,
        stages: [
          { label: "Signed up", count: signedUp },
          { label: "Matched with a tutor", count: matched },
          { label: "Completed a first session", count: completedFirstSession },
        ],
      },
    ],
    limitations: [
      `A student is counted where their ${windowDays}-day observation window closed, not where they signed up — students still inside their window are not counted as failures.`,
      "Stages are cumulative: each requires the ones before it.",
    ],
    sourceRows: signedUp,
  };
}

function demandSection(payload: OverviewPayload): OverviewSection {
  const rows = payload.subjectDemand.rows;
  const { requestsRead, tutorsRead } = payload.subjectDemand.reads;

  // Ratio, not subtraction: tutor headcount is not capacity, so nothing here
  // may claim an unmet-demand figure. A subject with no tutors has no ratio
  // at all — undefined, rendered as an em dash.
  const unstaffed = rows
    .filter((row) => row.tutorsAvailable <= 0)
    .sort((a, b) => b.studentsRequesting - a.studentsRequesting);
  const staffed = rows
    .filter((row) => row.tutorsAvailable > 0)
    .sort(
      (a, b) => b.studentsRequesting / b.tutorsAvailable - a.studentsRequesting / a.tutorsAvailable,
    );
  // No coverage is a worse position than any ratio, so unstaffed rows lead.
  const ranked = [...unstaffed, ...staffed];

  const breakdown: BreakdownResult = {
    kind: "breakdown",
    label: `Demand against tutor headcount, ${RANGE_LABEL[payload.dateRange]}`,
    columns: ["Students requesting", "Tutors available", "Students per tutor"],
    rows: ranked.map((row) => ({
      label: row.subject.slice(0, 200),
      values: [
        row.studentsRequesting,
        row.tutorsAvailable,
        row.tutorsAvailable > 0 ? round1(row.studentsRequesting / row.tutorsAvailable) : null,
      ],
    })),
  };

  return {
    id: "subjects",
    title: "Subject demand",
    results:
      ranked.length > 0
        ? [
            {
              kind: "metric",
              label: "Subjects with no tutors recorded",
              value: unstaffed.length,
              unit: "subjects",
              delta: null,
            },
            breakdown,
          ]
        : [],
    emptyNote: "No subject requests fall inside this window.",
    limitations: [
      "Tutor headcount is not capacity, so this supports a demand-to-supply ratio and nothing stronger — it does not say how many students go unserved.",
      "A tutor who teaches several subjects is counted in each, so tutor counts must not be summed across rows.",
    ],
    sourceRows: requestsRead + tutorsRead,
  };
}

function retentionSection(payload: OverviewPayload): OverviewSection {
  const { horizonDays, activityDays, cohorts, tutorsRead } = payload.tutorRetention;

  const latest = cohorts[cohorts.length - 1];

  return {
    id: "retention",
    title: "Tutor retention",
    results:
      cohorts.length > 0
        ? [
            ...(latest
              ? [
                  {
                    kind: "metric" as const,
                    label: `Most recent cohort (${latest.label}) retained at day ${horizonDays}`,
                    value: round1(
                      latest.cohortSize > 0 ? (latest.retained / latest.cohortSize) * 100 : 0,
                    ),
                    unit: "%",
                    delta: null,
                  },
                ]
              : []),
            {
              kind: "series" as const,
              label: `Retention at day ${horizonDays}, by signup cohort`,
              unit: "%",
              points: cohorts.map((cohort) => ({
                label: cohort.label,
                value: round1(
                  cohort.cohortSize > 0 ? (cohort.retained / cohort.cohortSize) * 100 : 0,
                ),
              })),
            },
          ]
        : [],
    emptyNote: `No cohort reached its day-${horizonDays} mark inside this window, so there is nothing comparable to report.`,
    limitations: [
      `Every cohort is measured at the same age — day ${horizonDays} — and appears in the window where it reached it. Younger cohorts are omitted, never shown as zero.`,
      `Retained means at least one completed session in the ${activityDays} days ending on day ${horizonDays}. Small cohorts move by whole percentage points per departure.`,
    ],
    sourceRows: tutorsRead,
  };
}

export function mapOverviewToSections(payload: OverviewPayload): OverviewSection[] {
  return [
    sessionsSection(payload),
    funnelSection(payload),
    demandSection(payload),
    retentionSection(payload),
  ];
}
