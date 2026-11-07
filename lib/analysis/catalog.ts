/**
 * The analyses the portal is allowed to run.
 *
 * An allow list, not a lookup into the analysis repo's registry, for two
 * reasons. Only an id that appears here can ever reach a subprocess, so a
 * request cannot name an arbitrary script. And each entry carries the argument
 * mapping that analysis actually needs: the repo's runner advertises
 * ANALYSIS_INPUT_DIR and ANALYSIS_OUTPUT_DIR but no script reads them yet, so
 * the flags have to be spelled out here until they do.
 *
 * Two analyses in that repo write to a shared Google Sheet. They are absent on
 * purpose and must stay absent: a reporting page should not mutate a
 * spreadsheet as a side effect of someone reading it.
 */

export type AnalysisOutput =
  | { kind: "table"; file: string; title: string }
  | { kind: "text"; file: string; title: string }
  | { kind: "stdout"; title: string };

export type AnalysisSpec = {
  id: string;
  title: string;
  /** What question it answers, in the admin's words. */
  question: string;
  /** Flags to pass, built from the run's input and output directories. */
  args: (io: { inputDir: string; outputDir: string }) => string[];
  outputs: AnalysisOutput[];
  /** What the numbers cannot support. Rendered with the result, never dropped. */
  limitations: string[];
};

export const ANALYSES: AnalysisSpec[] = [
  {
    id: "impact_retention_correlation",
    title: "What relates to tutors staying",
    question: "Which tutor activity measures move together with staying or leaving?",
    args: ({ inputDir, outputDir }) => ["--data-dir", inputDir, "--output-dir", outputDir],
    outputs: [
      { kind: "text", file: "impact_retention_summary.txt", title: "Summary" },
      {
        kind: "table",
        file: "impact_retention_correlations.csv",
        title: "Correlation by measure",
      },
    ],
    limitations: [
      "These are associations, not causes. Nothing here says one thing produced another.",
      "Retention is inferred from observed session activity, so a tutor with very short tenure is weakly characterised and can pull the coefficients around.",
      "With few tutors in the window the script reports that it cannot compute correlations rather than guessing.",
    ],
  },
  {
    id: "session_span_forgotten_pairs",
    title: "How long pairings last, and which went quiet",
    question: "How long do pairings run, and which have stopped meeting?",
    args: ({ inputDir }) => ["--csv", `${inputDir}/Sessions_rows.csv`],
    outputs: [{ kind: "stdout", title: "Per tutor" }],
    limitations: [
      "Quiet means no completed session inside the window printed at the top of the result. A different window gives a different count, so the two are only meaningful together.",
      "A pairing that started recently has a short span by definition. Span is not a quality measure.",
    ],
  },
  {
    id: "profile_population_metrics",
    title: "Headcount and ratios",
    question: "How many students and tutors are there, and what is the ratio?",
    args: ({ inputDir }) => ["--csv", `${inputDir}/Profiles_rows.csv`],
    outputs: [{ kind: "stdout", title: "Population" }],
    limitations: [
      "This script was written against an older export whose columns differ from the portal's. Where a column is missing it reports zero rather than failing, so a zero here means check the input before believing it.",
    ],
  },
];

export function findAnalysis(id: string): AnalysisSpec | undefined {
  return ANALYSES.find((analysis) => analysis.id === id);
}
