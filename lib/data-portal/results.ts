import { z } from "zod/v4";

/**
 * The closed set of result shapes the data portal is willing to render.
 *
 * Originating in the standalone data portal's response contract, now the
 * render contract for the in-portal panel: the overview mapping in
 * `overview.ts` may only produce these shapes, and the renderers in
 * `components/admin/data-portal/analysis-results.tsx` switch over them
 * exhaustively — a new shape without a renderer is a type error.
 *
 * `zod/v4` (bundled inside the zod 3.25 package) is used deliberately: its
 * strict objects reject unknown fields and its numbers reject NaN and
 * Infinity, so a malformed value can never reach a renderer.
 */

const LABEL = z.string().min(1).max(200);
const SHORT_LABEL = z.string().min(1).max(120);

export const metricResultSchema = z.strictObject({
  kind: z.literal("metric"),
  label: LABEL,
  value: z.number(),
  unit: z.string().max(40).nullable(),
  /** Period-over-period change as a proportion, when one was computed. */
  delta: z.number().nullable(),
});

export const seriesResultSchema = z.strictObject({
  kind: z.literal("series"),
  label: LABEL,
  unit: z.string().max(40).nullable(),
  points: z
    .array(z.strictObject({ label: SHORT_LABEL, value: z.number() }))
    .min(1)
    .max(400),
});

export const breakdownResultSchema = z
  .strictObject({
    kind: z.literal("breakdown"),
    label: LABEL,
    columns: z.array(SHORT_LABEL).min(1).max(8),
    rows: z
      .array(
        z.strictObject({
          label: LABEL,
          /**
           * `null` is an undefined cell — a quantity with genuinely no value
           * for this row, such as a ratio whose denominator is zero. It
           * renders as an em dash; `0` in its place would read as a
           * measurement.
           */
          values: z.array(z.number().nullable()).max(8),
        }),
      )
      .max(200),
  })
  .refine((result) => result.rows.every((row) => row.values.length === result.columns.length), {
    message: "Every breakdown row must match the column count.",
  });

export const funnelResultSchema = z.strictObject({
  kind: z.literal("funnel"),
  label: LABEL,
  stages: z
    .array(z.strictObject({ label: SHORT_LABEL, count: z.number().int().nonnegative() }))
    .min(2)
    .max(12),
});

export const analysisResultSchema = z.discriminatedUnion("kind", [
  metricResultSchema,
  seriesResultSchema,
  breakdownResultSchema,
  funnelResultSchema,
]);

export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type MetricResult = z.infer<typeof metricResultSchema>;
export type SeriesResult = z.infer<typeof seriesResultSchema>;
export type BreakdownResult = z.infer<typeof breakdownResultSchema>;
export type FunnelResult = z.infer<typeof funnelResultSchema>;
