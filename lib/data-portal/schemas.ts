import { z } from "zod/v4";
import { analysisSources } from "./sources";

/**
 * Request contract for the data-portal boundary.
 *
 * Ported from `dataPortalWebsite/frontend/src/lib/data-analysis/schemas.ts`,
 * which the analysis service's contract tests read — keep the two in step.
 * `zod/v4` (bundled inside the zod 3.25 package) is used deliberately: its
 * strict objects and finite-by-default numbers match the service's Pydantic
 * models, where v3's `z.number()` would admit Infinity.
 *
 * Every object is strict, so an unexpected field is a rejection rather than
 * something forwarded into a tool call.
 */

const MAX_MESSAGE_CHARS = 4_000;
const MAX_MESSAGES = 40;
/** Ceiling on the whole transcript, independent of the per-message limit. */
const MAX_TOTAL_CHARS = 60_000;

const sourceIds = analysisSources.map((source) => source.id) as [string, ...string[]];

export const dateRangeSchema = z.enum(["last-30-days", "last-90-days", "this-year"]);

export const analysisRequestSchema = z.strictObject({
  messages: z
    .array(
      z.strictObject({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
      }),
    )
    .min(1)
    .max(MAX_MESSAGES)
    .refine(
      (messages) =>
        messages.reduce((total, message) => total + message.content.length, 0) <= MAX_TOTAL_CHARS,
      { message: "Conversation exceeds the maximum supported length." },
    ),

  // Constrained to the ids the service actually knows, so a tampered id can
  // never reach it. Empty means "no restriction" and is the portal's default.
  sourceIds: z
    .array(z.enum(sourceIds))
    .max(analysisSources.length)
    .default([])
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "Duplicate source ids are not accepted.",
    }),

  dateRange: dateRangeSchema.default("last-90-days"),
});

export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;
export { MAX_MESSAGE_CHARS, MAX_MESSAGES };
