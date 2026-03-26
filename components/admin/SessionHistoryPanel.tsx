"use client";

import React, { useState } from "react";
import { format, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Session } from "@/types";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scrollarea";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getSessionTimespan } from "@/lib/utils";

interface SessionHistoryPanelProps {
  sessions: Session[] | null;
  loading: boolean;
  title: string;
  subtitle?: string;
}

const INITIAL_SHOW = 5;
const LOAD_MORE_COUNT = 10;

const getStatusDot = (status: string) => {
  if (status === "Complete") return "bg-emerald-500";
  if (status === "Cancelled") return "bg-red-400";
  if (status === "Rescheduled") return "bg-amber-400";
  return "bg-slate-400";
};

export default function SessionHistoryPanel({
  sessions,
  loading,
  title,
  subtitle,
}: SessionHistoryPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_SHOW);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400 mb-3" />
        <p className="text-sm text-gray-400">loading...</p>
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <CalendarDays className="h-6 w-6 text-gray-300 mb-2" />
        <p className="text-sm text-gray-400">no sessions found</p>
      </div>
    );
  }

  const completedCount = sessions.filter((s) => s.status === "Complete").length;
  const cancelledCount = sessions.filter((s) => s.status === "Cancelled").length;
  const activeCount = sessions.filter((s) => s.status === "Active").length;
  const totalCount = sessions.length;

  const displayedSessions = showAll
    ? sessions.slice(0, visibleCount)
    : sessions.slice(0, INITIAL_SHOW);

  const hasMore = showAll
    ? visibleCount < totalCount
    : INITIAL_SHOW < totalCount;

  const handleShowFullHistory = () => {
    setShowAll(true);
    setVisibleCount(Math.max(INITIAL_SHOW, LOAD_MORE_COUNT));
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + LOAD_MORE_COUNT, totalCount));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-5">
        <h3 className="text-base font-medium tracking-tight text-gray-800">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
        )}
      </div>

      <div className="flex gap-4 mb-5 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-gray-600">
            {completedCount} completed
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <span className="text-gray-600">
            {cancelledCount} cancelled
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-slate-400" />
          <span className="text-gray-600">
            {activeCount} upcoming
          </span>
        </div>
      </div>

      <div className="text-[11px] text-gray-400 mb-3">
        showing {displayedSessions.length} of {totalCount}
      </div>

      <ScrollArea className="flex-1 -mx-1 px-1">
        <div className="space-y-1.5 pb-4">
          {displayedSessions.map((session) => {
            let formattedDate = "";
            let timespan = "";
            try {
              const zoned = toZonedTime(parseISO(session.date), "America/New_York");
              formattedDate = format(zoned, "MMM d, yyyy");
              timespan = getSessionTimespan(session.date, session.duration);
            } catch {
              formattedDate = "Invalid date";
            }

            return (
              <div
                key={session.id}
                className="flex items-center gap-3 rounded-md border border-gray-100 bg-white px-3 py-2.5 hover:bg-gray-50 transition-colors"
              >
                <div className={cn("w-2 h-2 rounded-full shrink-0", getStatusDot(session.status))} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-gray-800 truncate">
                      {session.tutor?.firstName} {session.tutor?.lastName}
                      <span className="text-gray-300 mx-1">/</span>
                      {session.student?.firstName} {session.student?.lastName}
                    </span>
                    <span className="text-[11px] text-gray-400 shrink-0 tabular-nums">
                      {formattedDate}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-gray-400">{timespan}</span>
                    <span className="text-[11px] text-gray-300">·</span>
                    <span className={cn(
                      "text-[11px]",
                      session.status === "Complete" && "text-emerald-600",
                      session.status === "Cancelled" && "text-red-500",
                      session.status === "Active" && "text-gray-500",
                      session.status === "Rescheduled" && "text-amber-600",
                    )}>
                      {session.status.toLowerCase()}
                    </span>
                  </div>

                  {session.summary && (
                    <p className="text-[11px] text-gray-400 mt-1 truncate">
                      {session.summary}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {!showAll && hasMore && (
          <div className="pb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShowFullHistory}
              className="w-full text-xs text-gray-500 hover:text-gray-700"
            >
              view full history ({totalCount} sessions)
            </Button>
          </div>
        )}

        {showAll && hasMore && (
          <div className="pb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLoadMore}
              className="w-full text-xs text-gray-500 hover:text-gray-700 gap-1"
            >
              <ChevronDown className="h-3 w-3" />
              load more
            </Button>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
