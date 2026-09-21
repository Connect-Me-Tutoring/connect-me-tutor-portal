"use client";

import { useEffect, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "./data-portal.module.css";

/**
 * Runs one of the analysis scripts and shows what it printed.
 *
 * These are the real scripts from the analysis repository, not a reimplementation
 * of them in SQL, so the wait is a Python process reading the dataset and doing
 * the work. Tens of seconds is normal.
 */

type Section =
  | { kind: "text"; title: string; body: string }
  | { kind: "table"; title: string; columns: string[]; rows: string[][] };

type Result = {
  id: string;
  title: string;
  ranAt: string;
  durationMs: number;
  rowsRead: Record<string, number>;
  sections: Section[];
  limitations: string[];
};

type Catalog = {
  ready: boolean;
  reason: string | null;
  analyses: { id: string; title: string; question: string }[];
};

export function AnalysisRunner() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/data-portal/analysis")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setCatalog(data);
      })
      .catch(() => {
        if (!cancelled) setCatalog({ ready: false, reason: null, analyses: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const runOne = async (id: string) => {
    setRunning(id);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/admin/data-portal/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "The analysis could not be run.");
        return;
      }
      setResult(payload as Result);
    } catch {
      setError("The analysis could not be run.");
    } finally {
      setRunning(null);
    }
  };

  const rowsSummary = result
    ? Object.entries(result.rowsRead)
        .filter(([, count]) => count > 0)
        .map(([table, count]) => `${count.toLocaleString()} ${table.toLowerCase()}`)
        .join(", ")
    : "";

  return (
    <section aria-labelledby="dp-analyses-heading" className={styles.card}>
      <div className={styles.cardHead}>
        <h2 id="dp-analyses-heading" className={styles.cardTitle}>
          Run an analysis
        </h2>
        <span className={styles.cardMeta}>the analysis scripts, over current data</span>
      </div>

      {catalog === null ? (
        <p className={styles.emptyNote}>Loading.</p>
      ) : !catalog.ready ? (
        <p className={styles.emptyNote}>
          {catalog.reason ?? "The analysis backend is not available on this environment."}
        </p>
      ) : (
        <ul className={styles.analysisList}>
          {catalog.analyses.map((analysis) => (
            <li key={analysis.id} className={styles.analysisItem}>
              <div>
                <div className={styles.analysisTitle}>{analysis.title}</div>
                <div className={styles.analysisQuestion}>{analysis.question}</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 shrink-0 gap-1.5 border-black/15 bg-white/60"
                disabled={running !== null}
                onClick={() => void runOne(analysis.id)}
              >
                {running === analysis.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Run
              </Button>
            </li>
          ))}
        </ul>
      )}

      {running ? (
        <p className={styles.analysisRunning}>
          Reading the data and running the script. This takes a moment.
        </p>
      ) : null}

      {error ? <p className={styles.chatError}>{error}</p> : null}

      {result ? (
        <div className={styles.analysisResult}>
          <div className={styles.analysisResultHead}>
            <strong>{result.title}</strong>
            <span className={styles.cardMeta}>
              {rowsSummary ? `${rowsSummary} read, ` : ""}
              {(result.durationMs / 1000).toFixed(1)}s
            </span>
          </div>

          {result.sections.map((section, index) =>
            section.kind === "text" ? (
              <figure key={index} className={styles.figure}>
                <figcaption className={styles.figcaption}>{section.title}</figcaption>
                <pre className={styles.analysisPre}>{section.body}</pre>
              </figure>
            ) : (
              <figure key={index} className={styles.figure}>
                <figcaption className={styles.figcaption}>{section.title}</figcaption>
                <div className={styles.tableScroll}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        {section.columns.map((column) => (
                          <th scope="col" key={column}>
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </figure>
            ),
          )}

          <ul className={styles.limitations}>
            {result.limitations.map((limitation, index) => (
              <li key={index}>{limitation}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
