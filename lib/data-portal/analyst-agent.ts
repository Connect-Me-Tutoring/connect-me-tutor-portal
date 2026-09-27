import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { google } from "@ai-sdk/google";
import { z } from "zod/v4";
import { ANALYSES, findAnalysis } from "@/lib/analysis/catalog";
import { runAnalysis } from "@/lib/analysis/runner";
import type { OverviewSection } from "./overview";

/**
 * The analyses the model may run, as a tool.
 *
 * The id is an enum built from the allow list, so the model cannot name a
 * script that is not on it. Running one exports current data and executes the
 * real analysis, which takes tens of seconds; the instructions tell the model
 * to say it is doing that rather than sit silent.
 */
const runAnalysisTool = createTool({
  id: "run_analysis",
  description: [
    "Run one of Connect Me's analysis scripts over current data and return what it produced.",
    "Use this when the question needs a measure the figures on the page do not already answer.",
    "Available:",
    ...ANALYSES.map((analysis) => `  ${analysis.id}: ${analysis.question}`),
  ].join("\n"),
  inputSchema: z.object({
    analysisId: z
      .enum(ANALYSES.map((analysis) => analysis.id) as [string, ...string[]])
      .describe("Which analysis to run."),
  }),
  execute: async ({ context }) => {
    const spec = findAnalysis(context.analysisId);
    if (!spec) return { ok: false, error: "That analysis is not available." };

    const result = await runAnalysis(context.analysisId);
    if (!result.ok) return { ok: false, error: result.error };

    return {
      ok: true,
      title: result.title,
      rowsRead: result.rowsRead,
      // Flattened to text: the model reads it, it is not rendered from here.
      output: result.sections
        .map((section) =>
          section.kind === "text"
            ? `${section.title}:\n${section.body}`
            : `${section.title}:\n${[section.columns.join("\t"), ...section.rows.map((row) => row.join("\t"))].join("\n")}`,
        )
        .join("\n\n")
        .slice(0, 12000),
      limitations: result.limitations,
    };
  },
});

/**
 * The Data Portal's analyst.
 *
 * It answers from the aggregates the page already loaded, and it can run one of
 * Connect Me's analysis scripts when a question needs more than those. It has
 * no database access and no SQL: the only thing it can reach is an analysis on
 * the allow list, which reads and returns but never writes.
 *
 * The instructions lean hard on the limitations each section carries, because
 * those are what stop a reasonable-sounding sentence from being false: tutor
 * headcount is not capacity, a partial period is not a period, correlation is
 * not causation.
 */
export const dataAnalystAgent = new Agent({
  id: "data-portal-analyst",
  name: "Data Portal Analyst",
  instructions: `
You help a Connect Me administrator read the Data Portal's figures.

Connect Me is a nonprofit that pairs K-8 students with volunteer tutors for
free one-to-one sessions.

You have two sources.

The <figures> block in the system message holds the aggregates already on the
page. Answer from it when it is enough.

When the question needs something those figures do not cover, run the analysis
that answers it with the run_analysis tool. These are Connect Me's own scripts,
run over current data. The tool's own description lists which ids exist. A run takes tens of seconds,
so say you are running it before you call it, and report what it returned along
with the limitations it comes back with. If a run fails, say so and what you
could not answer. Never fill the gap with a guess.

Rules you do not break:
- Answer only from the figures given. If a question needs something that is
  not there, say what is missing and stop. Never estimate a number that was
  not provided.
- Every section carries a limitations list. Those are not decoration. If a
  limitation bears on the answer, say it in your own words as part of the
  answer, not as a footnote.
- A period marked partial is not comparable with a full one and is excluded
  from totals. Never compare a partial period against a complete one.
- Tutor headcount is not capacity. Subject demand supports a ratio of students
  to tutors and nothing stronger. It does not say how many students go
  unserved.
- An undefined value, shown as a dash, means there is no value for that row.
  It is not zero.
- Describe associations, never causes. You are reading counts over time, not
  running an experiment.
- These are children. Never invent, guess at, or ask for anything about an
  individual student, tutor or family. The figures are aggregates and your
  answers stay aggregate.

Style:
- Lead with the answer, then the reasoning.
- Markdown. Short paragraphs, bullets for lists of findings.
- Put a number in a sentence only when it changes what the reader does.
- Do not use em dashes.
- When the data is too thin to support a conclusion, say so plainly. That is a
  useful answer.
  `,
  model: google("gemini-2.5-flash"),
  tools: { run_analysis: runAnalysisTool },
});

/**
 * Renders the loaded sections as the grounding block.
 *
 * Tagged rather than fenced so that a subject name cannot close the block and
 * start writing instructions.
 */
export function renderFigures(sections: OverviewSection[], generatedAt: string): string {
  const body = sections
    .map((section) => {
      const results = section.results
        .map((result) => {
          switch (result.kind) {
            case "metric":
              return `  ${result.label}: ${result.value}${result.unit ? ` ${result.unit}` : ""}`;
            case "series":
              return `  ${result.label}:\n${result.points
                .map((point) => `    ${point.label}: ${point.value}`)
                .join("\n")}`;
            case "funnel":
              return `  ${result.label}:\n${result.stages
                .map((stage) => `    ${stage.label}: ${stage.count}`)
                .join("\n")}`;
            case "breakdown":
              return `  ${result.label}:\n    columns: ${result.columns.join(", ")}\n${result.rows
                .map(
                  (row) =>
                    `    ${row.label}: ${row.values
                      .map((value) => (value === null ? "no value" : value))
                      .join(", ")}`,
                )
                .join("\n")}`;
            default:
              return "";
          }
        })
        .filter(Boolean)
        .join("\n");

      const limitations = section.limitations.map((line) => `  - ${line}`).join("\n");
      const empty = section.results.length === 0 ? `  ${section.emptyNote ?? "No data."}\n` : "";

      return `<section name="${section.title}" records_read="${section.sourceRows}">\n${empty}${results}\n  limitations:\n${limitations}\n</section>`;
    })
    .join("\n\n");

  return `<figures generated_at="${generatedAt}">\n${body}\n</figures>`;
}
