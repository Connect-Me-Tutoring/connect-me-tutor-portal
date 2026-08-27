"use client";

import { Fragment } from "react";
import type {
  AnalysisResult,
  BreakdownResult,
  FunnelResult,
  MetricResult,
  SeriesResult,
} from "@/lib/data-portal/response-schemas";

/**
 * Renderers for the closed set of result shapes the analysis service returns.
 * Ported from the standalone data portal
 * (`dataPortalWebsite/frontend/src/components/data-analysis/analysis-result.tsx`)
 * and restyled with Tailwind.
 *
 * The `never` case in `renderResult` is load-bearing: adding a shape to
 * `analysisResponseSchema` without a renderer here is a type error, so
 * "render only known structures" cannot be satisfied on one side and
 * forgotten on the other.
 *
 * Nothing here interpolates HTML. Every value arrives as a React child and is
 * escaped, and every number has already been checked finite by the schema.
 */

const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

function formatValue(value: number, unit: string | null, signed = false): string {
  const sign = signed && value > 0 ? "+" : "";
  const formatted = `${sign}${numberFormat.format(value)}`;

  if (unit === "%") return `${formatted}%`;
  if (unit === "pp") return `${formatted} pp`;
  return unit ? `${formatted} ${unit}` : formatted;
}

function Metric({ result }: { result: MetricResult }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <span className="block text-xs text-muted-foreground">{result.label}</span>
      <strong className="text-base font-semibold tabular-nums">
        {formatValue(result.value, result.unit, result.delta !== null)}
      </strong>
    </div>
  );
}

function Series({ result }: { result: SeriesResult }) {
  const peak = Math.max(...result.points.map((point) => point.value), 0);

  return (
    <figure className="rounded-md border p-3">
      <figcaption className="mb-2 text-xs font-medium text-muted-foreground">
        {result.label}
      </figcaption>

      <div className="flex h-28 items-end gap-1 overflow-x-auto" aria-hidden="true">
        {result.points.map((point, index) => (
          <div
            className="flex min-w-6 flex-1 flex-col items-center gap-1 self-stretch"
            key={`${point.label}-${index}`}
          >
            <div className="flex w-full flex-1 items-end rounded-sm bg-muted/40">
              <div
                className="w-full rounded-sm bg-blue-500/80"
                style={{ height: `${peak > 0 ? (point.value / peak) * 100 : 0}%` }}
              />
            </div>
            <span className="max-w-full truncate text-[10px] leading-tight text-muted-foreground">
              {point.label}
            </span>
          </div>
        ))}
      </div>

      {/* The bars are decorative; this is the actual reading of the data. */}
      <ul className="sr-only">
        {result.points.map((point, index) => (
          <li key={`${point.label}-${index}`}>
            {point.label}: {formatValue(point.value, result.unit)}
          </li>
        ))}
      </ul>
    </figure>
  );
}

function Breakdown({ result }: { result: BreakdownResult }) {
  return (
    <figure className="rounded-md border p-3">
      <figcaption className="mb-2 text-xs font-medium text-muted-foreground">
        {result.label}
      </figcaption>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="py-1 pr-3 font-medium">
                <span className="sr-only">Item</span>
              </th>
              {result.columns.map((column) => (
                <th scope="col" key={column} className="py-1 pr-3 text-right font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, index) => (
              <tr key={`${row.label}-${index}`} className="border-b last:border-0">
                <th scope="row" className="py-1 pr-3 text-left font-normal">
                  {row.label}
                </th>
                {row.values.map((value, valueIndex) => (
                  <td
                    key={result.columns[valueIndex] ?? valueIndex}
                    className="py-1 pr-3 text-right tabular-nums"
                  >
                    {value === null ? (
                      // Undefined, not zero. A ratio with no denominator has
                      // no value, and printing 0 would read as a measurement.
                      <span className="text-muted-foreground" title="No value for this row">
                        —<span className="sr-only">not applicable</span>
                      </span>
                    ) : (
                      numberFormat.format(value)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

function Funnel({ result }: { result: FunnelResult }) {
  const entered = result.stages[0]?.count ?? 0;

  return (
    <figure className="rounded-md border p-3">
      <figcaption className="mb-2 text-xs font-medium text-muted-foreground">
        {result.label}
      </figcaption>

      <ol className="space-y-2">
        {result.stages.map((stage, index) => {
          const previous = index > 0 ? result.stages[index - 1].count : null;
          const lost = previous === null ? null : previous - stage.count;
          const lostShare = previous && previous > 0 && lost !== null ? lost / previous : null;

          return (
            <li key={`${stage.label}-${index}`}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span>{stage.label}</span>
                <strong className="tabular-nums">{numberFormat.format(stage.count)}</strong>
              </div>

              <div className="mt-1 h-2 rounded-full bg-muted/40" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-blue-500/80"
                  style={{ width: `${entered > 0 ? (stage.count / entered) * 100 : 0}%` }}
                />
              </div>

              {lost !== null && lostShare !== null ? (
                <span className="text-xs text-muted-foreground">
                  {numberFormat.format(lost)} lost ({Math.round(lostShare * 100)}%)
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

function renderResult(result: AnalysisResult) {
  switch (result.kind) {
    case "metric":
      return <Metric result={result} />;
    case "series":
      return <Series result={result} />;
    case "breakdown":
      return <Breakdown result={result} />;
    case "funnel":
      return <Funnel result={result} />;
    default: {
      // Adding a result shape to the schema without a renderer fails here.
      const unhandled: never = result;
      return unhandled;
    }
  }
}

export function AnalysisResults({ results }: { results: AnalysisResult[] }) {
  if (results.length === 0) return null;

  const metrics = results.filter((result): result is MetricResult => result.kind === "metric");
  const figures = results.filter((result) => result.kind !== "metric");

  return (
    <div className="mt-3 space-y-3">
      {metrics.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {metrics.map((result, index) => (
            <Metric result={result} key={`${result.label}-${index}`} />
          ))}
        </div>
      ) : null}

      {figures.map((result, index) => (
        <Fragment key={`${result.kind}-${index}`}>{renderResult(result)}</Fragment>
      ))}
    </div>
  );
}
