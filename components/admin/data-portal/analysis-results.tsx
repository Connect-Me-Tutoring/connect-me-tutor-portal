"use client";

import { Fragment } from "react";
import type {
  AnalysisResult,
  BreakdownResult,
  FunnelResult,
  MetricResult,
  SeriesResult,
} from "@/lib/data-portal/results";
import styles from "./data-portal.module.css";

/**
 * Renderers for the closed set of result shapes the data portal renders,
 * ported — structure and styling both — from the standalone data portal
 * (`dataPortalWebsite`: analysis-result.tsx and data-analysis.css).
 *
 * The `never` case in `renderResult` is load-bearing: adding a shape to the
 * result union without a renderer here is a type error, so "render only known
 * structures" cannot be satisfied on one side and forgotten on the other.
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
    <div className={styles.metric}>
      <span className={styles.metricLabel}>{result.label}</span>
      <strong className={styles.metricValue}>
        {formatValue(result.value, result.unit, result.delta !== null)}
      </strong>
    </div>
  );
}

function Series({ result }: { result: SeriesResult }) {
  const peak = Math.max(...result.points.map((point) => point.value), 0);

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.figcaption}>{result.label}</figcaption>

      <div className={styles.series} aria-hidden="true">
        {result.points.map((point, index) => {
          const partial = point.label.endsWith("(partial)");
          return (
            <div className={styles.seriesColumn} key={`${point.label}-${index}`}>
              <div className={styles.seriesTrack}>
                <div
                  className={
                    partial ? `${styles.seriesBar} ${styles.seriesBarPartial}` : styles.seriesBar
                  }
                  style={{ height: `${peak > 0 ? (point.value / peak) * 100 : 0}%` }}
                />
              </div>
              <span className={styles.seriesLabel}>{point.label}</span>
            </div>
          );
        })}
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
    <figure className={styles.figure}>
      <figcaption className={styles.figcaption}>{result.label}</figcaption>

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Item</span>
              </th>
              {result.columns.map((column) => (
                <th scope="col" key={column}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, index) => (
              <tr key={`${row.label}-${index}`}>
                <th scope="row">{row.label}</th>
                {row.values.map((value, valueIndex) => (
                  <td key={result.columns[valueIndex] ?? valueIndex}>
                    {value === null ? (
                      // Undefined, not zero. A ratio with no denominator has
                      // no value, and printing 0 would read as a measurement.
                      <span className={styles.undefinedCell} title="No value for this row">
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
    <figure className={styles.figure}>
      <figcaption className={styles.figcaption}>{result.label}</figcaption>

      <ol className={styles.funnel}>
        {result.stages.map((stage, index) => {
          const previous = index > 0 ? result.stages[index - 1].count : null;
          const lost = previous === null ? null : previous - stage.count;
          const lostShare = previous && previous > 0 && lost !== null ? lost / previous : null;

          return (
            <li key={`${stage.label}-${index}`}>
              <div className={styles.funnelHead}>
                <span>{stage.label}</span>
                <strong>{numberFormat.format(stage.count)}</strong>
              </div>

              <div className={styles.funnelTrack} aria-hidden="true">
                <div
                  className={styles.funnelFill}
                  style={{ width: `${entered > 0 ? (stage.count / entered) * 100 : 0}%` }}
                />
              </div>

              {lost !== null && lostShare !== null ? (
                <span className={styles.funnelDrop}>
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
    <div className={styles.results}>
      {metrics.length > 0 ? (
        <div className={styles.metrics}>
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
