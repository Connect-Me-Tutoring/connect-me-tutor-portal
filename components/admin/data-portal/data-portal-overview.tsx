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
import { Skeleton } from "@/components/ui/skeleton";
import { DATE_RANGE_OPTIONS, type OverviewSection } from "@/lib/data-portal/overview";
import { AnalysisResults } from "./analysis-results";

/**
 * The Data Portal page body: every analysis, loaded at once, laid out as
 * cards. Presentational — `data-portal-page.tsx` owns the data and loading.
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
    <section aria-labelledby={`dp-section-${section.id}`} className="rounded-lg border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={`dp-section-${section.id}`} className="text-sm font-semibold">
          {section.title}
        </h2>
        <span className="text-[11px] text-muted-foreground">
          {section.sourceRows.toLocaleString()} records read
        </span>
      </div>

      {section.results.length > 0 ? (
        <AnalysisResults results={section.results} />
      ) : (
        <p className="mt-3 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
          {section.emptyNote ?? "Nothing to report in this window."}
        </p>
      )}

      <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={dateRange} onValueChange={onDateRangeChange}>
          <SelectTrigger className="h-9 w-44 text-sm">
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
          className="h-9 gap-1.5"
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
          <span className="text-xs text-muted-foreground">
            Loaded {new Date(state.generatedAt).toLocaleString()}
          </span>
        )}
      </div>

      {state.status === "loading" ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="space-y-3 rounded-lg border p-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-40 w-full rounded-md" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      ) : state.status === "error" ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
          <p>{state.message}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={onReload}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          <div className="grid items-start gap-6 xl:grid-cols-2">
            {state.sections.map((section) => (
              <SectionCard key={section.id} section={section} />
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Read-only aggregates; no individual records are shown or retrievable here.
          </p>
        </>
      )}
    </div>
  );
}
