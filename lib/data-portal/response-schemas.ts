import { z } from "zod/v4";
import { dateRangeSchema } from "./schemas";
import { analysisSources } from "./sources";

/**
 * Response contract for the data-portal boundary.
 *
 * Ported from `dataPortalWebsite/frontend/src/lib/data-analysis/response-schemas.ts`
 * — keep the two in step. This schema is the list of shapes the panel is
 * willing to draw; anything the analysis service sends that does not match is
 * discarded rather than passed to a component. Every object is strict, and
 * `zod/v4` numbers reject NaN and Infinity, so a non-finite value can never
 * reach a renderer.
 */

const sourceIds = analysisSources.map((source) => source.id) as [string, ...string[]];

const LABEL = z.string().min(1).max(200);
const SHORT_LABEL = z.string().min(1).max(120);

const metricResultSchema = z.strictObject({
  kind: z.literal("metric"),
  label: LABEL,
  value: z.number(),
  unit: z.string().max(40).nullable(),
  /** Period-over-period change as a proportion, when the tool computed one. */
  delta: z.number().nullable(),
});

const seriesResultSchema = z.strictObject({
  kind: z.literal("series"),
  label: LABEL,
  unit: z.string().max(40).nullable(),
  points: z
    .array(z.strictObject({ label: SHORT_LABEL, value: z.number() }))
    .min(1)
    .max(400),
});

const breakdownResultSchema = z
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
    // A ragged table renders as silently misaligned numbers — worse than an
    // error, because an analyst reads the wrong column as the right one.
    message: "Every breakdown row must match the column count.",
  });

const funnelResultSchema = z.strictObject({
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

const toolTraceSchema = z.strictObject({
  name: SHORT_LABEL,
  sourceIds: z.array(z.enum(sourceIds)).max(analysisSources.length),
  dateRange: dateRangeSchema,
  /** Aggregate buckets shown — table rows, series points, funnel stages. */
  groupCount: z.number().int().nonnegative(),
  /** Underlying records read to produce them. Not the same number. */
  sourceRowsRead: z.number().int().nonnegative(),
});

export const analysisResponseSchema = z.strictObject({
  requestId: z.string().min(1).max(64),
  /**
   * "fixtures" means every number in this response is illustrative. The panel
   * badges it; do not drop the badge while the backend can still return it.
   */
  dataMode: z.enum(["fixtures", "live"]),
  answer: z.string().min(1).max(8_000),
  results: z.array(analysisResultSchema).max(8),
  tool: toolTraceSchema.nullable(),
  /** Conditions of this run — fixture data in use, redaction fired. */
  warnings: z.array(z.string().max(400)).max(8),
  /**
   * What the numbers can and cannot support: measurement horizons, excluded
   * partial periods, quantities the data does not license deriving.
   */
  limitations: z.array(z.string().max(400)).max(8),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type MetricResult = z.infer<typeof metricResultSchema>;
export type SeriesResult = z.infer<typeof seriesResultSchema>;
export type BreakdownResult = z.infer<typeof breakdownResultSchema>;
export type FunnelResult = z.infer<typeof funnelResultSchema>;
export type ToolTrace = z.infer<typeof toolTraceSchema>;
export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;
