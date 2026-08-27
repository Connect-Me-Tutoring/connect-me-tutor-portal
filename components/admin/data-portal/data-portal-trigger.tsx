"use client";

import { useRef, useState } from "react";
import { Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getDataPortalOverview } from "@/lib/actions/data-portal/server.actions";
import { DataPortalOverview, type OverviewState } from "./data-portal-overview";

/**
 * Sidebar entry for the data portal: a click opens a side panel and loads
 * every analysis at once — one database call, made through the caller's own
 * session against an admin-gated function.
 *
 * Rendering this inside the admin-only nav block is presentation, not
 * enforcement — the database function re-checks the caller's active-profile
 * role on every load, so the panel without the role is just a panel that
 * says no.
 *
 * Loaded data lives here rather than in the panel body, so closing and
 * reopening shows what was already fetched; Refresh and the range picker
 * are the two ways to fetch again.
 */
export function DataPortalTrigger({ isOpen }: { isOpen: boolean }) {
  const [open, setOpen] = useState(false);
  const [dateRange, setDateRange] = useState("last-90-days");
  const [state, setState] = useState<OverviewState>({ status: "idle" });
  const requestSerial = useRef(0);

  const load = async (range: string) => {
    const serial = ++requestSerial.current;
    setState({ status: "loading" });

    const outcome = await getDataPortalOverview(range);
    // A stale response (range changed mid-flight) must not overwrite the
    // newer request's state.
    if (serial !== requestSerial.current) return;

    setState(
      outcome.ok
        ? { status: "ready", generatedAt: outcome.generatedAt, sections: outcome.sections }
        : { status: "error", message: outcome.error },
    );
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && state.status === "idle") void load(dateRange);
  };

  const handleRangeChange = (next: string) => {
    setDateRange(next);
    void load(next);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start",
                open
                  ? "bg-blue-400/10 text-blue-500"
                  : "text-primary-dark hover:bg-muted hover:text-foreground",
                !isOpen && "justify-center px-2",
              )}
            >
              <Database className="h-5 w-5" />
              {isOpen && <span className="ml-3">Data Portal</span>}
            </Button>
          </SheetTrigger>
        </TooltipTrigger>
        {!isOpen && (
          <TooltipContent side="right">
            <p>Data Portal</p>
          </TooltipContent>
        )}
      </Tooltip>

      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-4 py-3 text-left">
          <SheetTitle>Data Portal</SheetTitle>
          <SheetDescription>
            Read-only aggregates over Connect Me&apos;s operational data.
          </SheetDescription>
        </SheetHeader>
        <DataPortalOverview
          state={state}
          dateRange={dateRange}
          onDateRangeChange={handleRangeChange}
          onReload={() => void load(dateRange)}
        />
      </SheetContent>
    </Sheet>
  );
}
