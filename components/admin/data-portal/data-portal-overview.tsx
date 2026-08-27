"use client";

import { Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DATE_RANGE_OPTIONS, type OverviewSection } from "@/lib/data-portal/overview";
import { AnalysisResults } from "./analysis-results";
import styles from "./data-portal.module.css";

/**
 * The Data Portal page body: every analysis, loaded at once, laid out as
 * hairline cards on the ported paper-and-ink surface. Presentational —
 * `data-portal-page.tsx` owns the data and loading.
 *
 * Each section renders its numbers, then its limitations. The limitations
 * are not decoration: they are what the numbers can and cannot support, and
 * a caveat an admin cannot see is a caveat nobody acts on.
 */

export type OverviewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; generatedAt: string; sections: OverviewSection[] };

type DataPortalOverviewProps = {
  state: OverviewState;
  dateRange: string;
  onDateRangeChange: (value: string) => void;
  onReload: () => void;
};

function SectionCard({ section }: { section: OverviewSection }) {
  return (
    <section aria-labelledby={`dp-section-${section.id}`} className={styles.card}>
      <div className={styles.cardHead}>
        <h2 id={`dp-section-${section.id}`} className={styles.cardTitle}>
          {section.title}
        </h2>
        <span className={styles.cardMeta}>
          {section.sourceRows.toLocaleString()} records read
        </span>
      </div>

      {section.results.length > 0 ? (
        <AnalysisResults results={section.results} />
      ) : (
        <p className={styles.emptyNote}>
          {section.emptyNote ?? "Nothing to report in this window."}
        </p>
      )}

      <ul className={styles.limitations}>
        {section.limitations.map((limitation, index) => (
          <li key={index}>{limitation}</li>
        ))}
      </ul>
    </section>
  );
}

export function DataPortalOverview({
  state,
  dateRange,
  onDateRangeChange,
  onReload,
}: DataPortalOverviewProps) {
  return (
    <>
      <div className={styles.toolbar}>
        <Select value={dateRange} onValueChange={onDateRangeChange}>
          <SelectTrigger className="h-9 w-44 border-black/15 bg-white/60 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGE_OPTIONS.map((range) => (
              <SelectItem key={range.value} value={range.value}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 border-black/15 bg-white/60"
          onClick={onReload}
          disabled={state.status === "loading"}
        >
          {state.status === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCw className="h-4 w-4" />
          )}
          Refresh
        </Button>

        {state.status === "ready" && (
          <span className={styles.loadedAt}>
            loaded {new Date(state.generatedAt).toLocaleString()}
          </span>
        )}
      </div>

      {state.status === "loading" ? (
        <div className={styles.grid}>
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className={styles.skeletonCard}>
              <div className={styles.skeletonLine} style={{ height: "1rem", width: "10rem" }} />
              <div className={styles.skeletonLine} style={{ height: "9rem" }} />
              <div className={styles.skeletonLine} style={{ height: "0.75rem", width: "75%" }} />
            </div>
          ))}
        </div>
      ) : state.status === "error" ? (
        <div className={styles.errorBox}>
          <p>{state.message}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 border-black/15 bg-white/60"
            onClick={onReload}
          >
            Try again
          </Button>
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            {state.sections.map((section) => (
              <SectionCard key={section.id} section={section} />
            ))}
          </div>
          <p className={styles.footNote}>
            Read-only aggregates; no individual records are shown or retrievable here.
          </p>
        </>
      )}
    </>
  );
}
