import { Agent } from "@mastra/core/agent";
import { google } from "@ai-sdk/google";
import type { OverviewSection } from "./overview";

/**
 * The Data Portal's analyst.
 *
 * It answers from one thing only: the aggregate payload the page already
 * loaded. It is given no database access, no tools and no SQL, so the worst a
 * bad answer can be is wrong about numbers the admin can see for themselves
 * right above the chat.
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

Your source is the <figures> block in the system message. It is the same data
rendered on the page above the chat.

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
