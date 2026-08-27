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
 * The panel body: every analysis, loaded at once. Presentational — the
 * trigger owns the data and the loading, so a closed-and-reopened panel
 * shows what was already fetched instead of fetching again.
 *
 * Each section renders its numbers, then its limitations. The limitations
 * are not decoration: they are what the numbers can and cannot support, and
 * a caveat an admin cannot see is a caveat nobody acts on.
 */

export type OverviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; generatedAt: string; sections: OverviewSection[] };

type DataPortalOverviewProps = {
  state: OverviewState;
  dateRange: string;
  onDateRangeChange: (value: string) => void;
  onReload: () => void;
};

function SectionView({ section }: { section: OverviewSection }) {
  return (
    <section aria-labelledby={`dp-section-${section.id}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={`dp-section-${section.id}`} className="text-sm font-semibold">
          {section.title}
        </h3>
        <span className="text-[11px] text-muted-foreground">
          {section.sourceRows.toLocaleString()} records read
        </span>
      </div>

      {section.results.length > 0 ? (
        <AnalysisResults results={section.results} />
      ) : (
        <p className="mt-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
          {section.emptyNote ?? "Nothing to report in this window."}
        </p>
      )}

      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
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
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
        <Select value={dateRange} onValueChange={onDateRangeChange}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGE_OPTIONS.map((range) => (
              <SelectItem key={range.value} value={range.value} className="text-xs">
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-xs text-muted-foreground"
          onClick={onReload}
          disabled={state.status === "loading"}
        >
          {state.status === "loading" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4">
        {state.status === "loading" || state.status === "idle" ? (
          <div className="space-y-6">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-28 w-full rounded-md" />
              </div>
            ))}
          </div>
        ) : state.status === "error" ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
            <p>{state.message}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={onReload}>
              Try again
            </Button>
          </div>
        ) : (
          <>
            {state.sections.map((section) => (
              <SectionView key={section.id} section={section} />
            ))}
            <p className="text-[11px] text-muted-foreground">
              Read-only aggregates; no individual records are shown or retrievable here. Loaded{" "}
              {new Date(state.generatedAt).toLocaleString()}.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
